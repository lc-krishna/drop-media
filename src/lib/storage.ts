export type FileStatus = "uploading" | "done" | "failed";
export type SessionStatus = "pending" | "done" | "partial" | "failed";

export type UploadSession = {
  id: string;
  timestamp: number;
  park: string;
  folderPath: string;
  fileCount: number;
  status: SessionStatus;
  files: { name: string; driveFileId?: string; status: FileStatus }[];
};

const HISTORY_KEY = "upload_history";
const SA_KEY = "sa_json_b64";

// Fallback: service account JSON baked in at build time via VITE_SA_JSON_B64 env var.
// Set this in .env locally or in the Netlify / Vercel dashboard.
function envSA(): string | null {
  const b64 = import.meta.env.VITE_SA_JSON_B64 as string | undefined;
  if (!b64) return null;
  try {
    return atob(b64);
  } catch {
    return null;
  }
}

export const storage = {
  getHistory(): UploadSession[] {
    if (typeof localStorage === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    } catch {
      return [];
    }
  },
  saveHistory(h: UploadSession[]) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(h));
  },
  upsertSession(s: UploadSession) {
    const h = storage.getHistory();
    const idx = h.findIndex((x) => x.id === s.id);
    if (idx >= 0) h[idx] = s;
    else h.unshift(s);
    storage.saveHistory(h);
  },
  clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
  },
  getServiceAccount(): string | null {
    if (typeof localStorage === "undefined") return envSA();
    const v = localStorage.getItem(SA_KEY);
    if (!v) return envSA();
    try {
      return atob(v);
    } catch {
      return envSA();
    }
  },
  setServiceAccount(json: string) {
    localStorage.setItem(SA_KEY, btoa(json));
  },
  clearServiceAccount() {
    localStorage.removeItem(SA_KEY);
  },
};
