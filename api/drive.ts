import { importPKCS8, SignJWT } from "jose";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  private_key_id?: string;
  token_uri?: string;
};

type VercelRequest = {
  method?: string;
  body?: unknown;
};

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

type DriveFolder = { id: string; name: string };

const BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

let cachedToken: { token: string; expiresAt: number } | null = null;

function getServiceAccount(): ServiceAccount {
  const b64 = process.env.SA_JSON_B64;
  if (!b64) throw new Error("SA_JSON_B64 is not configured on the server.");

  const raw = Buffer.from(b64, "base64").toString("utf8");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) {
    throw new Error("SA_JSON_B64 does not contain a valid service account JSON key.");
  }
  return sa;
}

async function signJWT(sa: ServiceAccount): Promise<string> {
  const pem = sa.private_key.includes("\\n")
    ? sa.private_key.replace(/\\n/g, "\n")
    : sa.private_key;
  const now = Math.floor(Date.now() / 1000);
  const key = await importPKCS8(pem, "RS256");

  return new SignJWT({
    iss: sa.client_email,
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT", kid: sa.private_key_id })
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);
}

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }

  const sa = getServiceAccount();
  const jwt = await signJWT(sa);
  const tokenResponse = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!tokenResponse.ok) {
    const details = await tokenResponse.text();
    throw new Error(
      details.includes("Invalid JWT Signature")
        ? "The server service account key is invalid, revoked, or does not match the client email."
        : `Token exchange failed: ${details}`,
    );
  }

  const data = (await tokenResponse.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + data.expires_in * 1000,
  };
  return cachedToken.token;
}

async function authHeaders(extra?: Record<string, string>) {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...(extra || {}) };
}

function parseBody(body: unknown): Record<string, unknown> {
  if (!body) return {};
  if (typeof body === "string") return JSON.parse(body) as Record<string, unknown>;
  if (typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  return {};
}

function requireString(body: Record<string, unknown>, key: string): string {
  const value = body[key];
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Missing ${key}.`);
  }
  return value;
}

async function listFolders(parentId: string): Promise<DriveFolder[]> {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `${BASE}/files?q=${encodeURIComponent(
    q,
  )}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000&orderBy=name`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`listFolders failed: ${await res.text()}`);
  const data = (await res.json()) as { files?: DriveFolder[] };
  return data.files || [];
}

async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
  const res = await fetch(`${BASE}/files?supportsAllDrives=true`, {
    method: "POST",
    headers: await authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    }),
  });
  if (!res.ok) throw new Error(`createFolder failed: ${await res.text()}`);
  const data = (await res.json()) as DriveFolder;
  return { id: data.id, name: data.name };
}

async function createUploadSession(body: Record<string, unknown>) {
  const filename = requireString(body, "filename");
  const parentId = requireString(body, "parentId");
  const mimeType =
    typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
  const fileSize = typeof body.fileSize === "number" ? body.fileSize : undefined;

  const initRes = await fetch(
    `${UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: await authHeaders({
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": mimeType,
        ...(fileSize ? { "X-Upload-Content-Length": String(fileSize) } : {}),
      }),
      body: JSON.stringify({ name: filename, parents: [parentId] }),
    },
  );

  if (!initRes.ok) throw new Error(`Resumable init failed: ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No resumable upload URL returned by Google Drive.");
  return { uploadUrl };
}

export default async function handler(request: VercelRequest, response: VercelResponse) {
  response.setHeader("Cache-Control", "no-store");

  if (request.method !== "POST") {
    response.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const body = parseBody(request.body);
    const action = requireString(body, "action");

    if (action === "listFolders") {
      response.status(200).json({ folders: await listFolders(requireString(body, "parentId")) });
      return;
    }

    if (action === "createFolder") {
      response.status(200).json({
        folder: await createFolder(requireString(body, "name"), requireString(body, "parentId")),
      });
      return;
    }

    if (action === "createUploadSession") {
      response.status(200).json(await createUploadSession(body));
      return;
    }

    response.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (error) {
    response.status(500).json({ error: (error as Error).message });
  }
}
