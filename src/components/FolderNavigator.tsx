import { useState } from "react";
import { ChevronRight, Check, Plus, FolderPlus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import parks from "@/config/parks.json";
import type { useFolderTree } from "@/hooks/useFolderTree";

type Park = { id: number; park: string; folderId: string };

export function FolderNavigator({
  tree,
  selectedPark,
  setSelectedPark,
}: {
  tree: ReturnType<typeof useFolderTree>;
  selectedPark: Park | null;
  setSelectedPark: (p: Park | null) => void;
}) {
  const [showNew, setShowNew] = useState(false);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  return (
    <div className="space-y-3">
      <Select
        value={selectedPark?.folderId || ""}
        onValueChange={(v) => {
          const p = (parks as Park[]).find((x) => x.folderId === v) || null;
          setSelectedPark(p);
          if (p) tree.selectPark(p);
        }}
      >
        <SelectTrigger className="max-w-sm">
          <SelectValue placeholder="Select a park…" />
        </SelectTrigger>
        <SelectContent>
          {(parks as Park[]).map((p) => (
            <SelectItem key={p.folderId} value={p.folderId}>
              {p.park}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {tree.crumbs.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <span className="text-base">📍</span>
          {tree.crumbs.map((c, i) => (
            <span key={c.id} className="flex items-center gap-1">
              <button
                onClick={() => tree.jumpTo(i)}
                className="hover:text-foreground hover:underline"
              >
                {c.name}
              </button>
              {i < tree.crumbs.length - 1 && <ChevronRight className="h-3 w-3" />}
            </span>
          ))}
        </div>
      )}

      {tree.error && (
        <div className="text-sm text-destructive border border-destructive/30 bg-destructive/5 rounded-md p-3">
          {tree.error}
        </div>
      )}

      {tree.missingPV && (
        <div className="text-sm border rounded-md p-3 bg-amber-50 border-amber-200 flex items-center justify-between gap-3">
          <span>This park doesn't have a "Photos & Videos" folder yet.</span>
          <Button size="sm" onClick={() => tree.createPhotosVideos()}>
            Create it
          </Button>
        </div>
      )}

      {tree.crumbs.length > 0 && !tree.missingPV && (
        <div className="flex flex-wrap gap-2">
          {tree.loading && (
            <div className="text-xs text-muted-foreground">Loading folders…</div>
          )}
          {!tree.loading &&
            tree.children.map((f) => (
              <button
                key={f.id}
                onClick={() => tree.enter(f)}
                className="px-3 py-1.5 rounded-md border bg-background hover:border-primary hover:shadow-sm text-sm transition-all"
              >
                {f.name}
              </button>
            ))}
          {!tree.loading && tree.children.length === 0 && (
            <div className="text-xs text-muted-foreground">
              No subfolders here. This is your destination.
            </div>
          )}
          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 rounded-md border border-dashed text-sm text-muted-foreground hover:text-foreground hover:border-primary flex items-center gap-1"
          >
            <Plus className="h-3 w-3" /> New Folder
          </button>
        </div>
      )}

      {tree.crumbs.length >= 2 && !tree.missingPV && (
        <div className="text-sm flex items-center gap-2 text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
          <Check className="h-4 w-4" />
          Destination: <strong>{tree.crumbs[tree.crumbs.length - 1].name}</strong>
        </div>
      )}

      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FolderPlus className="h-5 w-5" /> New folder
            </DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Folder name"
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>
              Cancel
            </Button>
            <Button
              disabled={!newName.trim() || creating}
              onClick={async () => {
                setCreating(true);
                try {
                  await tree.newFolder(newName.trim());
                  setNewName("");
                  setShowNew(false);
                } finally {
                  setCreating(false);
                }
              }}
            >
              {creating ? "Creating…" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
