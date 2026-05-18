import { useCallback, useState } from "react";
import { createFolder, findPhotosVideosFolder, listFolders, type DriveFolder } from "@/lib/drive";

export type Crumb = { id: string; name: string };

export function useFolderTree() {
  const [crumbs, setCrumbs] = useState<Crumb[]>([]);
  const [children, setChildren] = useState<DriveFolder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [missingPV, setMissingPV] = useState(false);

  const loadAt = useCallback(async (path: Crumb[]) => {
    setLoading(true);
    setError(null);
    try {
      const last = path[path.length - 1];
      const ch = await listFolders(last.id);
      setChildren(ch);
      setCrumbs(path);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  const selectPark = useCallback(
    async (park: { park: string; folderId: string }) => {
      setLoading(true);
      setError(null);
      setMissingPV(false);
      try {
        const pv = await findPhotosVideosFolder(park.folderId);
        if (!pv) {
          setCrumbs([{ id: park.folderId, name: park.park }]);
          setChildren(await listFolders(park.folderId));
          setMissingPV(true);
          return;
        }
        const path: Crumb[] = [
          { id: park.folderId, name: park.park },
          { id: pv.id, name: pv.name },
        ];
        setCrumbs(path);
        setChildren(await listFolders(pv.id));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const enter = useCallback(
    async (folder: DriveFolder) => {
      await loadAt([...crumbs, { id: folder.id, name: folder.name }]);
    },
    [crumbs, loadAt],
  );

  const jumpTo = useCallback(
    async (idx: number) => {
      await loadAt(crumbs.slice(0, idx + 1));
    },
    [crumbs, loadAt],
  );

  const reset = useCallback(() => {
    setCrumbs([]);
    setChildren([]);
    setMissingPV(false);
    setError(null);
  }, []);

  const newFolder = useCallback(
    async (name: string) => {
      const last = crumbs[crumbs.length - 1];
      if (!last) return;
      const f = await createFolder(name, last.id);
      setChildren((c) => [...c, f].sort((a, b) => a.name.localeCompare(b.name)));
      return f;
    },
    [crumbs],
  );

  const createPhotosVideos = useCallback(async () => {
    const root = crumbs[0];
    if (!root) return;
    const f = await createFolder("Photos & Videos", root.id);
    const path: Crumb[] = [root, { id: f.id, name: f.name }];
    setMissingPV(false);
    await loadAt(path);
  }, [crumbs, loadAt]);

  return {
    crumbs,
    children,
    loading,
    error,
    missingPV,
    selectPark,
    enter,
    jumpTo,
    reset,
    newFolder,
    createPhotosVideos,
  };
}
