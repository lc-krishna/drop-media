import { useMemo, useState } from "react";
import { Check, Clock, AlertTriangle, X, ChevronRight } from "lucide-react";
import type { UploadSession } from "@/lib/storage";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function dateLabel(ts: number) {
  const d = new Date(ts);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  if (sameDay) return "Today";
  if (d.toDateString() === yest.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function StatusIcon({ status }: { status: UploadSession["status"] }) {
  if (status === "done") return <Check className="h-4 w-4 text-green-600" />;
  if (status === "pending") return <Clock className="h-4 w-4 text-amber-500 animate-pulse" />;
  if (status === "partial") return <AlertTriangle className="h-4 w-4 text-amber-600" />;
  return <X className="h-4 w-4 text-red-600" />;
}

export function Sidebar({ history }: { history: UploadSession[] }) {
  const [selected, setSelected] = useState<UploadSession | null>(null);

  const grouped = useMemo(() => {
    const g = new Map<string, UploadSession[]>();
    for (const s of history) {
      const k = dateLabel(s.timestamp);
      if (!g.has(k)) g.set(k, []);
      g.get(k)!.push(s);
    }
    return Array.from(g.entries());
  }, [history]);

  return (
    <aside className="w-[280px] shrink-0 border-r bg-muted/30 overflow-y-auto">
      <div className="p-4 border-b bg-background/50">
        <h2 className="text-sm font-semibold tracking-tight">Upload History</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {history.length} session{history.length === 1 ? "" : "s"}
        </p>
      </div>

      {history.length === 0 && (
        <div className="p-6 text-center text-xs text-muted-foreground">
          No uploads yet. Drop some files to get started.
        </div>
      )}

      {grouped.map(([day, sessions]) => {
        const allDone = sessions.every((s) => s.status === "done");
        return (
          <div key={day} className="px-3 py-2">
            <div
              className={`text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-2 mb-1 ${allDone ? "line-through opacity-60" : ""}`}
            >
              {day}
            </div>
            <div className="space-y-1">
              {sessions.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left px-2 py-2 rounded-md hover:bg-background transition-colors group ${s.status === "done" ? "opacity-70" : ""}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="mt-0.5">
                      <StatusIcon status={s.status} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className={`text-xs font-medium truncate ${s.status === "done" ? "line-through" : ""}`}
                      >
                        {s.park}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {s.folderPath}
                      </div>
                      <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                        {s.fileCount} file{s.fileCount === 1 ? "" : "s"} ·{" "}
                        {new Date(s.timestamp).toLocaleTimeString([], {
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </div>
                    </div>
                    <ChevronRight className="h-3 w-3 text-muted-foreground/40 mt-1 opacity-0 group-hover:opacity-100" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Session details</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3">
              <div className="text-sm">
                <div className="font-medium">{selected.park}</div>
                <div className="text-xs text-muted-foreground">{selected.folderPath}</div>
                <div className="text-xs text-muted-foreground">
                  {new Date(selected.timestamp).toLocaleString()}
                </div>
              </div>
              <div className="border rounded-md divide-y">
                {selected.files.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 p-2 text-xs">
                    <StatusIcon
                      status={
                        f.status === "done"
                          ? "done"
                          : f.status === "failed"
                            ? "failed"
                            : "pending"
                      }
                    />
                    <span className="flex-1 truncate font-mono">{f.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </aside>
  );
}
