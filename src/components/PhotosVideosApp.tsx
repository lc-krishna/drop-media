import { useEffect, useMemo, useState } from "react";
import { Camera, Settings, Upload as UploadIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Sidebar } from "./Sidebar";
import { FileDropZone } from "./FileDropZone";
import { FileGrid, type StagedFile } from "./FileGrid";
import { FolderNavigator } from "./FolderNavigator";
import { UploadProgress } from "./UploadProgress";
import { SettingsModal } from "./SettingsModal";
import { LoginModal, isLoggedIn } from "./LoginModal";
import { useFolderTree } from "@/hooks/useFolderTree";
import { useUploadSession } from "@/hooks/useUploadSession";
import { isConfigured } from "@/lib/auth";

type Park = { id: number; park: string; folderId: string };

const VIDEO_EXT = ["mp4", "mov", "avi", "mkv", "webm"];

export function PhotosVideosApp() {
  const [authenticated, setAuthenticated] = useState(() => isLoggedIn());
  const [staged, setStaged] = useState<StagedFile[]>([]);
  const [applyAll, setApplyAll] = useState(false);
  const [bulkName, setBulkName] = useState("");
  const [park, setPark] = useState<Park | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [needsSetup, setNeedsSetup] = useState(false);

  const tree = useFolderTree();
  const session = useUploadSession();

  useEffect(() => {
    if (!isConfigured()) setNeedsSetup(true);
  }, []);

  useEffect(() => {
    return () => staged.forEach((s) => URL.revokeObjectURL(s.url));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!authenticated) {
    return <LoginModal onSuccess={() => setAuthenticated(true)} />;
  }

  const addFiles = (files: File[]) => {
    const next: StagedFile[] = files.map((f) => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      return {
        id: crypto.randomUUID(),
        file: f,
        name: "",
        url: URL.createObjectURL(f),
        isVideo: VIDEO_EXT.includes(ext) || f.type.startsWith("video/"),
      };
    });
    setStaged((s) => [...s, ...next]);

    const oversized = files.filter((f) => f.size > 5 * 1024 * 1024 * 1024);
    if (oversized.length) toast.warning(`${oversized.length} file(s) over 5GB — uploads may take a while.`);
  };

  const removeFile = (id: string) =>
    setStaged((s) => {
      const x = s.find((y) => y.id === id);
      if (x) URL.revokeObjectURL(x.url);
      return s.filter((y) => y.id !== id);
    });

  const updateName = (id: string, name: string) =>
    setStaged((s) => s.map((f) => (f.id === id ? { ...f, name } : f)));

  const targetFolder = tree.crumbs[tree.crumbs.length - 1];
  const folderPath = useMemo(
    () => tree.crumbs.slice(1).map((c) => c.name).join(" > ") || tree.crumbs[0]?.name || "",
    [tree.crumbs],
  );

  const namesValid = applyAll ? bulkName.trim().length > 0 : staged.every((f) => f.name.trim().length > 0);
  const canUpload =
    !!park && !!targetFolder && tree.crumbs.length >= 2 && staged.length > 0 && namesValid && !session.uploading;

  const handleUpload = async () => {
    if (!isConfigured()) {
      setSettingsOpen(true);
      toast.error("Configure your service account first");
      return;
    }
    if (!namesValid) {
      toast.error("Every file needs a name");
      return;
    }
    if (!park || !targetFolder) return;

    try {
      const result = await session.start({
        files: staged,
        applyAll,
        bulkName,
        userName: "",
        park: park.park,
        folderId: targetFolder.id,
        folderPath,
      });
      if (result.status === "done") toast.success(`Uploaded ${result.fileCount} file(s)`);
      else if (result.status === "partial") toast.warning("Some files failed — check the sidebar");
      else toast.error("Upload failed");
      // reset on full success
      if (result.status === "done") {
        staged.forEach((s) => URL.revokeObjectURL(s.url));
        setStaged([]);
        setBulkName("");
        setApplyAll(false);
        setTimeout(() => session.clearItems(), 1500);
      }
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  return (
    <div className="flex h-screen bg-background">
      <Sidebar history={session.history} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-14 border-b flex items-center justify-between px-5 shrink-0">
          <div className="flex items-center gap-2">
            <Camera className="h-5 w-5 text-primary" />
            <h1 className="text-sm font-semibold">Photos &amp; Videos — Lucky Communities</h1>
          </div>
          <button
            onClick={() => setSettingsOpen(true)}
            className="p-2 rounded-md hover:bg-muted"
            aria-label="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
        </header>

        <Tabs defaultValue="pv" className="flex-1 flex flex-col overflow-hidden">
          <div className="px-5 pt-3 border-b">
            <TabsList>
              <TabsTrigger value="pv">Photos &amp; Videos</TabsTrigger>
              <TabsTrigger value="violations" disabled>
                Violations (soon)
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="pv" className="flex-1 overflow-y-auto p-6 space-y-8 mt-0">
            {needsSetup && (
              <div className="border border-amber-300 bg-amber-50 rounded-lg p-4 flex items-center justify-between gap-3">
                <div className="text-sm">
                  <strong>Setup required:</strong> paste your Google service account JSON to connect to Drive.
                </div>
                <Button size="sm" onClick={() => setSettingsOpen(true)}>
                  Open settings
                </Button>
              </div>
            )}

            <Section number={1} title="Drop Files">
              <FileDropZone onAdd={addFiles} />
            </Section>

            {staged.length > 0 && (
              <Section number={2} title="Name Each File">
                <FileGrid
                  files={staged}
                  onUpdate={updateName}
                  onRemove={removeFile}
                  applyAll={applyAll}
                  setApplyAll={setApplyAll}
                  bulkName={bulkName}
                  setBulkName={setBulkName}
                />
              </Section>
            )}

            <Section number={3} title="Pick Destination Folder">
              <FolderNavigator
                tree={tree}
                selectedPark={park}
                setSelectedPark={setPark}
              />
            </Section>

            {session.items.length > 0 && <UploadProgress items={session.items} />}

            <div className="sticky bottom-0 bg-background pt-4 pb-2">
              <Button
                size="lg"
                disabled={!canUpload}
                onClick={handleUpload}
                className="w-full sm:w-auto"
              >
                <UploadIcon className="h-4 w-4 mr-2" />
                {session.uploading
                  ? "Uploading…"
                  : `Upload ${staged.length || ""} ${staged.length === 1 ? "File" : "Files"} to Drive`.replace(/\s+/g, " ")}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      <SettingsModal
        open={settingsOpen}
        onOpenChange={(v) => {
          setSettingsOpen(v);
          if (!v) setNeedsSetup(!isConfigured());
        }}
        onCleared={session.refresh}
      />
    </div>
  );
}

function Section({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-semibold text-muted-foreground tracking-wider uppercase">
          Step {number}
        </span>
        <span className="text-xs text-muted-foreground">—</span>
        <h2 className="text-sm font-semibold">{title}</h2>
      </div>
      {children}
    </section>
  );
}
