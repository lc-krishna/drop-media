import { useEffect, useMemo, useState } from "react";
import { Film, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

export type StagedFile = {
  id: string;
  file: File;
  name: string;
  url: string;
  isVideo: boolean;
};

export function FileGrid({
  files,
  onUpdate,
  onRemove,
  applyAll,
  setApplyAll,
  bulkName,
  setBulkName,
}: {
  files: StagedFile[];
  onUpdate: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  applyAll: boolean;
  setApplyAll: (v: boolean) => void;
  bulkName: string;
  setBulkName: (v: string) => void;
}) {
  if (!files.length) return null;
  return (
    <div className="space-y-3">
      <div className="border rounded-lg divide-y overflow-hidden">
        {files.map((f) => (
          <div key={f.id} className="flex items-center gap-3 p-3">
            <div className="relative w-[60px] h-[60px] shrink-0 rounded-md overflow-hidden bg-muted">
              {f.isVideo ? (
                <VideoThumb file={f} />
              ) : (
                <img src={f.url} alt={f.file.name} className="w-full h-full object-cover" />
              )}
              {f.isVideo && (
                <Film className="absolute inset-0 m-auto h-5 w-5 text-white drop-shadow" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-muted-foreground truncate">{f.file.name}</div>
              <Input
                value={applyAll ? bulkName : f.name}
                disabled={applyAll}
                placeholder="Name this file"
                onChange={(e) => onUpdate(f.id, e.target.value)}
                className="mt-1 h-8 text-sm"
              />
            </div>
            <button
              onClick={() => onRemove(f.id)}
              className="text-muted-foreground hover:text-destructive p-1"
              aria-label="Remove"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Checkbox checked={applyAll} onCheckedChange={(v) => setApplyAll(!!v)} />
          Apply same name to all
        </label>
        {applyAll && (
          <Input
            value={bulkName}
            placeholder="Name for all files"
            onChange={(e) => setBulkName(e.target.value)}
            className="h-8 text-sm flex-1 max-w-md"
          />
        )}
      </div>
    </div>
  );
}

function VideoThumb({ file }: { file: StagedFile }) {
  const [poster, setPoster] = useState<string | null>(null);
  useEffect(() => {
    const v = document.createElement("video");
    v.src = file.url;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.onloadeddata = () => {
      try {
        v.currentTime = Math.min(0.1, v.duration / 4);
      } catch {}
    };
    v.onseeked = () => {
      const c = document.createElement("canvas");
      c.width = 120;
      c.height = 120;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const ratio = v.videoWidth / v.videoHeight || 1;
      const dw = ratio > 1 ? 120 : 120 * ratio;
      const dh = ratio > 1 ? 120 / ratio : 120;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, 120, 120);
      ctx.drawImage(v, (120 - dw) / 2, (120 - dh) / 2, dw, dh);
      setPoster(c.toDataURL("image/jpeg", 0.6));
    };
  }, [file.url]);
  return poster ? (
    <img src={poster} alt="" className="w-full h-full object-cover" />
  ) : (
    <div className="w-full h-full bg-black" />
  );
}
