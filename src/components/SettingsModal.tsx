import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { storage } from "@/lib/storage";
import { isConfigured } from "@/lib/auth";
import parks from "@/config/parks.json";
import { Check } from "lucide-react";
import { toast } from "sonner";

export function SettingsModal({
  open,
  onOpenChange,
  onCleared,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCleared: () => void;
}) {
  const connected = isConfigured();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">Drive connection:</span>
            {connected && (
              <span className="inline-flex items-center gap-1 text-green-700">
                <Check className="h-4 w-4" /> Server configured
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            The service account key is configured on the server with <code>SA_JSON_B64</code>. Make
            sure the service account has Editor access on every park folder.
          </p>
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Upload history</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Clear all upload history?")) {
                storage.clearHistory();
                onCleared();
                toast.success("History cleared");
              }
            }}
          >
            Clear history
          </Button>
        </section>

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">Parks ({(parks as unknown[]).length})</h3>
          <div className="border rounded-md max-h-60 overflow-y-auto divide-y text-xs">
            {(parks as { id: number; park: string; folderId: string }[]).map((p) => (
              <div key={p.id} className="flex justify-between p-2 gap-2">
                <span className="font-medium">{p.park}</span>
                <span className="font-mono text-muted-foreground truncate">{p.folderId}</span>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Edit <code>src/config/parks.json</code> to add or remove parks.
          </p>
        </section>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
