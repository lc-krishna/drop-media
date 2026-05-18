# Photos & Videos Upload Tool — Lucky Communities

## What it does

A single-page web app for internal staff to upload photos and videos from a
laptop directly to Google Drive, organized by mobile home park and
subfolder. Drop → name → pick folder → upload. Every session is logged in a
sidebar audit trail.

## Architecture

```
┌──────────┐    JWT      ┌──────────────────┐   access     ┌──────────────┐
│  User    │  ─────────► │  React (browser) │ ───token───► │ Google OAuth │
│  laptop  │             │  jose signs JWT  │              └──────┬───────┘
└──────────┘             │                  │ ◄────token──────────┘
                         │                  │   Bearer
                         │                  │ ─────────────► Google Drive v3
                         │  localStorage    │ ◄─────────────  files / upload
                         └──────────────────┘
```

No backend, no database. The browser holds the service account key in
localStorage, signs a JWT with `jose`, exchanges it at
`https://oauth2.googleapis.com/token`, and calls Drive REST endpoints directly.

## File structure

```
src/
  components/
    PhotosVideosApp.tsx     ← top-level layout & state wiring
    Sidebar.tsx             ← upload-history list grouped by date + detail dialog
    FileDropZone.tsx        ← drag/drop + native file picker
    FileGrid.tsx            ← thumbnails, name inputs, "apply same name" toggle
    FolderNavigator.tsx     ← park dropdown + breadcrumbs + chip drill-down + new-folder modal
    UploadProgress.tsx      ← per-file progress bars
    SettingsModal.tsx       ← service account JSON, history reset, parks list
  config/
    parks.json              ← 21 parks (id, name, folderId) — single source of truth
  lib/
    auth.ts                 ← service-account JWT → access token, with cache
    drive.ts                ← list/create folders, multipart + resumable uploads
    naming.ts               ← YYYY-MM-DD_Park_Folder_Name_NN.ext builder
    storage.ts              ← localStorage wrapper (history + service account)
  hooks/
    useFolderTree.ts        ← folder navigation state machine
    useUploadSession.ts     ← parallel upload runner + history persistence
  routes/
    index.tsx               ← single page (TanStack Start route)
SUMMARY.md
```

## How auth works

1. User pastes their Google service-account JSON key into Settings.
2. Key is stored base64-encoded in `localStorage` under `sa_json_b64`.
3. On the first Drive call, `lib/auth.ts`:
   - parses the JSON,
   - imports the PEM private key with `jose.importPKCS8`,
   - signs a JWT (RS256) with claims
     `iss = client_email`, `scope = drive`,
     `aud = https://oauth2.googleapis.com/token`,
     `exp = now + 3600`,
   - POSTs `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=<jwt>`
     to the token endpoint,
   - caches the returned `access_token` in module memory until 60 s before
     expiry (~50 minutes of useful life).
4. Every Drive request uses `Authorization: Bearer <token>`.

The service-account email needs **Editor** access on each park folder. Share
each Drive folder with that email (Drive → Share → paste email → Editor).

## Upload flow

1. **Drop / pick files** — handled by `FileDropZone`. Generates instant
   thumbnails via `URL.createObjectURL`. Videos get a first-frame poster via
   a hidden `<video>` element drawn into a `<canvas>`.
2. **Name files** — each file gets an input, or "Apply same name to all"
   replaces them with one input plus auto-suffix `_01`, `_02`, ….
3. **Pick destination** — `FolderNavigator`:
   - User picks a park; app calls Drive to list its children.
   - App auto-enters a child named `Photos & Videos` (case-insensitive).
   - User clicks chips to drill deeper (one Drive list call per level).
   - Breadcrumbs are clickable to jump back.
   - "+ New Folder" creates a subfolder via Drive and refreshes the chips.
   - If no `Photos & Videos` exists, a one-click "Create it" button appears.
4. **Upload** — `useUploadSession` runs up to 3 parallel uploads:
   - files ≤ 5 MB → single multipart POST,
   - larger files (typically video) → resumable upload, 8 MB chunks, with
     simple per-chunk retries (auto-resumes after transient network drops).
   - per-file progress streamed via `XMLHttpRequest.upload.onprogress` for
     multipart, and per-chunk math for resumable.
   - `beforeunload` warning is installed while uploads are in progress.
5. **Logging** — every session is upserted into `upload_history` in
   localStorage. Final status is `done` / `partial` / `failed` based on
   per-file outcomes.

## Folder navigation logic

The only hardcoded mapping is `parks.json` → root folder ID. Everything
below that is discovered live from Drive at click time. There is no static
schema of subfolders — adding a new lot in Drive shows up the next time the
user navigates to that park.

## Naming convention

```
YYYY-MM-DD_ParkName_FolderName_UserName_NN.ext
```

Example: `2026-05-13_ChefOneMHP_Lot5_BrokenSkirting_01.jpg`

- date is "today" in local time,
- park / folder / user-name strings have whitespace converted to `_` and
  non-alphanumerics stripped,
- `_NN` suffix is appended only when there are 2+ files in the same session
  (to keep single-file names clean).

## Where data is stored

Everything is local to the browser:

- `localStorage["sa_json_b64"]` — service-account key (base64).
- `localStorage["upload_history"]` — array of `UploadSession` objects.
- Drive access token cached in JS memory only (not persisted).

No cookies, no backend, no Lovable Cloud / Supabase.

## Adding a new park

1. Edit `src/config/parks.json` — append `{ "id": N, "park": "…", "folderId": "…" }`.
2. In Google Drive, share that folder with the service-account email as **Editor**.

The app picks it up on next reload.

## Known limitations

- **Service-account key in the browser.** Anyone with access to the laptop
  can read it from devtools → Application → localStorage. The key is only
  base64-encoded, not encrypted. This is acceptable for a trusted internal
  tool but is **not** safe for an end-user-facing app. For production-grade
  security move auth to a small server-side proxy.
- **CORS.** The Drive REST endpoints used here all support CORS for browser
  clients, so the app works without a proxy. If Google ever tightens this,
  uploads will need to move server-side.
- **Max parallel uploads = 3** to stay well under Drive's per-user quotas.
  Tunable via `MAX_PARALLEL` in `useUploadSession.ts`.
- **No checksum verification.** We trust Drive's response; we don't compare
  MD5s post-upload.
- **Resumable uploads only auto-recover within a single chunk** (3 retries
  with backoff). Full session resume across page reloads is not implemented.
- **Video thumbnails** require the browser to be able to decode the codec.
  HEIC and some MOV variants will fall back to a black tile but still upload.
- **Single user.** "User name" used in the filename comes from whatever the
  staff member typed as the per-file name (or bulk name). There's no login.
