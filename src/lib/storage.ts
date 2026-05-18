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
};
