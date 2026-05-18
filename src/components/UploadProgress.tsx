import { Check, X, Loader2 } from "lucide-react";

export type UploadItem = {
  id: string;
  finalName: string;
  progress: number;
  status: "queued" | "uploading" | "done" | "failed";
  error?: string;
};

export function UploadProgress({ items }: { items: UploadItem[] }) {
  if (!items.length) return null;
  return (
    <div className="border rounded-lg p-4 space-y-2 bg-muted/20">
      <div className="text-sm font-semibold mb-2">Uploading…</div>
      {items.map((it) => (
        <div key={it.id} className="space-y-1">
          <div className="flex items-center gap-2 text-xs">
            {it.status === "done" && <Check className="h-3 w-3 text-green-600" />}
            {it.status === "failed" && <X className="h-3 w-3 text-destructive" />}
            {it.status === "uploading" && (
              <Loader2 className="h-3 w-3 animate-spin text-primary" />
            )}
            {it.status === "queued" && (
              <div className="h-3 w-3 rounded-full border border-muted-foreground/40" />
            )}
            <span className="font-mono truncate flex-1">{it.finalName}</span>
            <span className="text-muted-foreground">{Math.round(it.progress)}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full transition-all ${it.status === "failed" ? "bg-destructive" : "bg-primary"}`}
              style={{ width: `${it.progress}%` }}
            />
          </div>
          {it.error && <div className="text-[11px] text-destructive">{it.error}</div>}
        </div>
      ))}
    </div>
  );
}
