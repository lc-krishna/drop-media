function clean(s: string) {
  return s.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_-]/g, "");
}

export function buildFilename(opts: {
  date?: Date;
  park: string;
  folder: string;
  userName: string;
  index: number;
  total: number;
  originalName: string;
}): string {
  const d = opts.date || new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const ext = opts.originalName.includes(".")
    ? opts.originalName.split(".").pop()!.toLowerCase()
    : "bin";
  const suffix = opts.total > 1 ? `_${String(opts.index + 1).padStart(2, "0")}` : "";
  return `${yyyy}-${mm}-${dd}_${clean(opts.park)}_${clean(opts.folder)}_${clean(opts.userName)}${suffix}.${ext}`;
}
