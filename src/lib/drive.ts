import { getAccessToken } from "./auth";

export type DriveFolder = { id: string; name: string };

const BASE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";

async function authHeaders(extra?: Record<string, string>) {
  const token = await getAccessToken();
  return { Authorization: `Bearer ${token}`, ...(extra || {}) };
}

export async function listFolders(parentId: string): Promise<DriveFolder[]> {
  const q = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
  const url = `${BASE}/files?q=${encodeURIComponent(q)}&fields=files(id,name)&supportsAllDrives=true&includeItemsFromAllDrives=true&pageSize=1000&orderBy=name`;
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) throw new Error(`listFolders failed: ${await res.text()}`);
  const data = await res.json();
  return data.files || [];
}

export async function createFolder(name: string, parentId: string): Promise<DriveFolder> {
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
  const data = await res.json();
  return { id: data.id, name: data.name };
}

export async function findChildByName(
  parentId: string,
  name: string,
): Promise<DriveFolder | null> {
  const folders = await listFolders(parentId);
  const lower = name.toLowerCase();
  return folders.find((f) => f.name.toLowerCase() === lower) || null;
}

// Matches any folder whose name contains "photos" and "videos" in that order,
// e.g. "Photos & Videos", "10 | Photos & Videos", "Photos and Videos".
const PV_PATTERN = /photos.{0,20}videos/i;

export async function findPhotosVideosFolder(
  parentId: string,
): Promise<DriveFolder | null> {
  const folders = await listFolders(parentId);
  return folders.find((f) => PV_PATTERN.test(f.name)) || null;
}

const MULTIPART_LIMIT = 5 * 1024 * 1024;
const CHUNK = 8 * 1024 * 1024;

export async function uploadFile(
  file: File,
  filename: string,
  parentId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  if (file.size <= MULTIPART_LIMIT) {
    return uploadMultipart(file, filename, parentId, onProgress);
  }
  return uploadResumable(file, filename, parentId, onProgress);
}

async function uploadMultipart(
  file: File,
  filename: string,
  parentId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const token = await getAccessToken();
  const metadata = { name: filename, parents: [parentId] };
  const boundary = "-------" + Math.random().toString(36).slice(2);
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelim = `\r\n--${boundary}--`;

  const buf = await file.arrayBuffer();
  const head =
    delimiter +
    "Content-Type: application/json; charset=UTF-8\r\n\r\n" +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${file.type || "application/octet-stream"}\r\n\r\n`;
  const headBytes = new TextEncoder().encode(head);
  const tailBytes = new TextEncoder().encode(closeDelim);
  const body = new Uint8Array(headBytes.length + buf.byteLength + tailBytes.length);
  body.set(headBytes, 0);
  body.set(new Uint8Array(buf), headBytes.length);
  body.set(tailBytes, headBytes.length + buf.byteLength);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(
      "POST",
      `${UPLOAD}/files?uploadType=multipart&supportsAllDrives=true&fields=id`,
    );
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.setRequestHeader("Content-Type", `multipart/related; boundary=${boundary}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const r = JSON.parse(xhr.responseText);
          onProgress?.(100);
          resolve(r.id);
        } catch (e) {
          reject(e);
        }
      } else reject(new Error(`Upload failed: ${xhr.status} ${xhr.responseText}`));
    };
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}

async function uploadResumable(
  file: File,
  filename: string,
  parentId: string,
  onProgress?: (pct: number) => void,
): Promise<string> {
  const token = await getAccessToken();
  const initRes = await fetch(
    `${UPLOAD}/files?uploadType=resumable&supportsAllDrives=true&fields=id`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json; charset=UTF-8",
        "X-Upload-Content-Type": file.type || "application/octet-stream",
        "X-Upload-Content-Length": String(file.size),
      },
      body: JSON.stringify({ name: filename, parents: [parentId] }),
    },
  );
  if (!initRes.ok) throw new Error(`Resumable init failed: ${await initRes.text()}`);
  const uploadUrl = initRes.headers.get("Location");
  if (!uploadUrl) throw new Error("No resumable upload URL");

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
        attempt++;
        if (attempt >= 3) throw err;
        await new Promise((r) => setTimeout(r, 1000 * attempt));
      }
    }
  }
  throw new Error("Resumable upload ended without confirmation");
}
