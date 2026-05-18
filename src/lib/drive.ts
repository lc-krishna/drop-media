export type DriveFolder = { id: string; name: string };
export type DriveFile = { id: string; name: string };

async function driveApi<T>(body: Record<string, unknown>): Promise<T> {
  const res = await fetch("/api/drive", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
  if (!res.ok || !data) {
    throw new Error(data?.error ?? "Drive API request failed.");
  }
  return data;
}

export async function listFolders(parentId: string): Promise<DriveFolder[]> {
  const data = await driveApi<{ folders: DriveFolder[] }>({
    action: "listFolders",
    parentId,
  });
  return data.folders;
}

export async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
  const data = await driveApi<{ folder: DriveFolder }>({
    action: "createFolder",
    name,
    parentId,
  });
  return data.folder;
}

async function verifyUploadedFile(filename: string, parentId: string): Promise<string | null> {
  const data = await driveApi<{ file: DriveFile | null }>({
    action: "verifyUploadedFile",
    filename,
    parentId,
  });
  return data.file?.id ?? null;
}

async function verifyUploadedFileWithRetry(
  filename: string,
  parentId: string,
): Promise<string | null> {
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt > 0) {
      await new Promise((resolve) => setTimeout(resolve, 800 * attempt));
    }
    const driveId = await verifyUploadedFile(filename, parentId);
    if (driveId) return driveId;
  }
  return null;
}

export async function findChildByName(parentId: string, name: string): Promise<DriveFolder | null> {
  const folders = await listFolders(parentId);
  const lower = name.toLowerCase();
  return folders.find((f) => f.name.toLowerCase() === lower) || null;
}

// Matches any folder whose name contains "photos" and "videos" in that order,
// e.g. "Photos & Videos", "10 | Photos & Videos", "Photos and Videos".
const PV_PATTERN = /photos.{0,20}videos/i;

export async function findPhotosVideosFolder(parentId: string): Promise<DriveFolder | null> {
  const folders = await listFolders(parentId);
  return folders.find((f) => PV_PATTERN.test(f.name)) || null;
}

const CHUNK = 8 * 1024 * 1024;

export async function uploadFile(
  file: File,
  filename: string,
  parentId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  return uploadResumable(file, filename, parentId, onProgress);
}

async function uploadResumable(
  file: File,
  filename: string,
  parentId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const { uploadUrl } = await driveApi<{ uploadUrl: string }>({
    action: "createUploadSession",
    filename,
    parentId,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  });

  let offset = 0;
  while (offset < file.size) {
    const end = Math.min(offset + CHUNK, file.size);
    const chunk = file.slice(offset, end);
    let attempt = 0;
    while (true) {
      try {
        const res = await fetch(uploadUrl, {
          method: "PUT",
          headers: {
            "Content-Range": `bytes ${offset}-${end - 1}/${file.size}`,
          },
          body: chunk,
        });
        if (res.status === 200 || res.status === 201) {
          const data = await res.json();
          onProgress?.(100);
          return data.id;
        }
        if (res.status === 308) {
          offset = end;
          onProgress?.((offset / file.size) * 100);
          break;
        }
        throw new Error(`Chunk failed: ${res.status} ${await res.text()}`);
      } catch (err) {
        const verifiedDriveId = await verifyUploadedFileWithRetry(filename, parentId);
        if (verifiedDriveId) {
          onProgress?.(100);
          return verifiedDriveId;
        }
        attempt++;
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw new Error("Resumable upload ended without confirmation");
}
