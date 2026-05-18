import { importPKCS8, SignJWT } from "jose";
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

  if (!res.ok) {
    const details = await res.text();
    if (details.includes("Invalid JWT Signature")) {
      throw new Error(
        "Token exchange failed: the service account key is invalid, revoked, or does not match the client email. Clear Settings and paste a fresh JSON key, or update VITE_SA_JSON_B64 in Vercel.",
      );
    }
    throw new Error(`Token exchange failed: ${details}`);
  }

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
