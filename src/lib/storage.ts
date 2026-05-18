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

async function driveApi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/drive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? "Upload history request failed.");
  }
  return data;
}

type SheetHistoryRow = {
  serialNo: string;
  date: string;
  noOfFiles: number;
  filesName: string;
  status: string;
};

function statusFromSheet(status: string): SessionStatus {
  const normalized = status.toLowerCase();
  if (normalized === "done" || normalized === "partial" || normalized === "failed") {
    return normalized;
  }
  return "done";
}

function sheetRowToSession(row: SheetHistoryRow): UploadSession {
  const fileNames = row.filesName
    .split(/\r?\n|,\s*/)
    .map((name) => name.trim())
    .filter(Boolean);
  const timestamp = row.date ? Date.parse(row.date) : Number.NaN;

  return {
    id: `sheet-${row.serialNo || row.date || row.filesName}`,
    timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
    park: `Upload #${row.serialNo || "?"}`,
    folderPath: fileNames[0]
      ? `${row.noOfFiles} file(s) - ${fileNames[0]}`
      : `${row.noOfFiles} file(s)`,
    fileCount: row.noOfFiles || fileNames.length,
    status: statusFromSheet(row.status),
    files: fileNames.map((name) => ({
      name,
      status: statusFromSheet(row.status) === "failed" ? "failed" : "done",
    })),
  };
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
  async fetchHistory(): Promise<UploadSession[]> {
    const data = await driveApi<{ history: SheetHistoryRow[] }>({
      action: "getUploadHistory",
    });
    return data.history.map(sheetRowToSession);
  },
  async appendHistory(session: UploadSession): Promise<void> {
    await driveApi<{ ok: true }>({
      action: "appendUploadHistory",
      date: new Date(session.timestamp).toISOString(),
      files: session.files.map((file) => file.name),
      status: session.status,
    });
  },
  async clearRemoteHistory(): Promise<void> {
    await driveApi<{ ok: true }>({ action: "clearUploadHistory" });
  },
};
