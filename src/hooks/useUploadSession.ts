import { useCallback, useEffect, useState } from "react";
import { storage, type UploadSession } from "@/lib/storage";
import { uploadFile } from "@/lib/drive";
import { buildFilename } from "@/lib/naming";
import type { StagedFile } from "@/components/FileGrid";
import type { UploadItem } from "@/components/UploadProgress";

const MAX_PARALLEL = 3;

export function useUploadSession() {
  const [history, setHistory] = useState<UploadSession[]>([]);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setHistory(storage.getHistory());
  }, []);

  useEffect(() => {
    if (!uploading) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [uploading]);

  const refresh = useCallback(() => setHistory(storage.getHistory()), []);

  const start = useCallback(
    async (opts: {
      files: StagedFile[];
      applyAll: boolean;
      bulkName: string;
      userName: string;
      park: string;
      folderId: string;
      folderPath: string;
    }) => {
      const finalNames = opts.files.map((f, i) =>
        buildFilename({
          park: opts.park,
          folder: opts.folderPath.split(" > ").pop() || "",
          userName: opts.applyAll ? opts.bulkName : f.name,
          index: i,
          total: opts.applyAll ? opts.files.length : 1,
          originalName: f.file.name,
        }),
      );

      const session: UploadSession = {
        id: crypto.randomUUID(),
        timestamp: Date.now(),
        park: opts.park,
        folderPath: opts.folderPath,
        fileCount: opts.files.length,
        status: "pending",
        files: finalNames.map((n) => ({ name: n, status: "uploading" })),
      };
      storage.upsertSession(session);
      refresh();

      const initial: UploadItem[] = opts.files.map((f, i) => ({
        id: f.id,
        finalName: finalNames[i],
        progress: 0,
        status: "queued",
      }));
      setItems(initial);
      setUploading(true);

      const queue = opts.files.map((f, i) => ({ f, i }));
      let active = 0;
      let cursor = 0;
      let doneCount = 0;
      let failCount = 0;

      await new Promise<void>((resolve) => {
        const next = () => {
          while (active < MAX_PARALLEL && cursor < queue.length) {
            const { f, i } = queue[cursor++];
            active++;
            setItems((arr) =>
              arr.map((x) => (x.id === f.id ? { ...x, status: "uploading" } : x)),
            );
            uploadFile(f.file, finalNames[i], opts.folderId, (pct) => {
              setItems((arr) =>
                arr.map((x) => (x.id === f.id ? { ...x, progress: pct } : x)),
              );
            })
              .then((driveId) => {
                doneCount++;
                session.files[i] = { ...session.files[i], status: "done", driveFileId: driveId };
                setItems((arr) =>
                  arr.map((x) =>
                    x.id === f.id ? { ...x, progress: 100, status: "done" } : x,
                  ),
                );
              })
              .catch((err) => {
                failCount++;
                session.files[i] = { ...session.files[i], status: "failed" };
                setItems((arr) =>
                  arr.map((x) =>
                    x.id === f.id
                      ? { ...x, status: "failed", error: (err as Error).message }
                      : x,
                  ),
                );
              })
              .finally(() => {
                active--;
                if (cursor >= queue.length && active === 0) {
                  session.status =
                    failCount === 0 ? "done" : doneCount === 0 ? "failed" : "partial";
                  storage.upsertSession(session);
                  refresh();
                  resolve();
                } else {
                  next();
                }
              });
          }
        };
        next();
      });

      setUploading(false);
      return session;
    },
    [refresh],
  );

  const clearItems = useCallback(() => setItems([]), []);

  return { history, items, uploading, start, refresh, clearItems };
}
