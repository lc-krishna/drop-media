import { storage } from "./storage";

type ServiceAccount = {
  client_email: string;
  private_key: string;
  private_key_id: string;
  token_uri?: string;
};

let cachedToken: { token: string; expiresAt: number } | null = null;

function getSA(): ServiceAccount {
  const raw = storage.getServiceAccount();
  if (!raw) throw new Error("No service account configured. Open Settings to paste your JSON key.");
  const sa = JSON.parse(raw) as ServiceAccount;
  if (!sa.client_email || !sa.private_key) throw new Error("Invalid service account JSON");
  return sa;
}

// base64url-encode a binary string
function b64url(binary: string): string {
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// base64url-encode a UTF-8 JSON object
function jsonB64url(obj: object): string {
  const bytes = new TextEncoder().encode(JSON.stringify(obj));
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return b64url(binary);
}

async function signJWT(sa: ServiceAccount): Promise<string> {
  // Normalise PEM — handles both real newlines and escaped "\n" strings
  const pem = sa.private_key.includes("\\n")
    ? sa.private_key.replace(/\\n/g, "\n")
    : sa.private_key;

  // Strip PEM envelope and decode to raw DER bytes
  const b64 = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");
  const keyBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

  // Import with native Web Crypto — no jose dependency
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: { name: "SHA-256" } },
    false,
    ["sign"],
  );

  const now = Math.floor(Date.now() / 1000);
  const header = jsonB64url({ alg: "RS256", typ: "JWT", kid: sa.private_key_id });
  const payload = jsonB64url({
    iss: sa.client_email,
    aud: sa.token_uri ?? "https://oauth2.googleapis.com/token",
    scope: "https://www.googleapis.com/auth/drive",
    iat: now,
    exp: now + 3600,
  });

  const signingInput = `${header}.${payload}`;
  const sigBuffer = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signingInput),
  );
  const sig = b64url(
    Array.from(new Uint8Array(sigBuffer), (b) => String.fromCharCode(b)).join(""),
  );

  return `${signingInput}.${sig}`;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) return cachedToken.token;

  const sa = getSA();
  const jwt = await signJWT(sa);

  const res = await fetch(sa.token_uri ?? "https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${await res.text()}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cachedToken = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cachedToken.token;
}

export function isConfigured(): boolean {
  return !!storage.getServiceAccount();
}

export function clearTokenCache() {
  cachedToken = null;
}
