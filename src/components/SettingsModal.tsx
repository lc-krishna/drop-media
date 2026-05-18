import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { storage } from "@/lib/storage";
import { isConfigured, clearTokenCache } from "@/lib/auth";
import parks from "@/config/parks.json";
import { Check, X } from "lucide-react";
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
  const [json, setJson] = useState(storage.getServiceAccount() || "");
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
            {connected ? (
              <span className="inline-flex items-center gap-1 text-green-700">
                <Check className="h-4 w-4" /> Connected
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-destructive">
                <X className="h-4 w-4" /> Not connected
              </span>
            )}
          </div>
          <label className="text-sm font-medium block mt-3">
            Service Account JSON Key
          </label>
          <Textarea
            value={json}
            onChange={(e) => setJson(e.target.value)}
            rows={10}
            placeholder='Paste full service account JSON here…'
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            Stored locally in this browser only (base64 in localStorage). Make sure the
            service account has Editor access on every park folder.
          </p>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                try {
                  JSON.parse(json);
                  storage.setServiceAccount(json);
                  clearTokenCache();
                  toast.success("Service account saved");
                  onOpenChange(false);
                } catch {
                  toast.error("Invalid JSON");
                }
              }}
            >
              Save
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                storage.clearServiceAccount();
                clearTokenCache();
                setJson("");
                toast.success("Cleared");
              }}
            >
              Clear
            </Button>
          </div>
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
          <h3 className="text-sm font-semibold">
            Parks ({(parks as unknown[]).length})
          </h3>
          <div className="border rounded-md max-h-60 overflow-y-auto divide-y text-xs">
            {(parks as { id: number; park: string; folderId: string }[]).map((p) => (
              <div key={p.id} className="flex justify-between p-2 gap-2">
                <span className="font-medium">{p.park}</span>
                <span className="font-mono text-muted-foreground truncate">
                  {p.folderId}
                </span>
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
