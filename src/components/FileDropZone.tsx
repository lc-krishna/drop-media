import { useCallback, useRef, useState } from "react";
import { Upload } from "lucide-react";

const ACCEPT = ".jpg,.jpeg,.png,.heic,.webp,.mp4,.mov,.avi,image/*,video/*";

export function FileDropZone({ onAdd }: { onAdd: (files: File[]) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setOver(false);
      const files = Array.from(e.dataTransfer.files);
      if (files.length) onAdd(files);
    },
    [onAdd],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={handleDrop}
      onClick={() => ref.current?.click()}
      className={`border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors ${
        over ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-muted/30"
      }`}
    >
      <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
      <p className="text-sm font-medium">Drop photos/videos here</p>
      <p className="text-xs text-muted-foreground mt-1">or click to select</p>
      <input
        ref={ref}
        type="file"
        multiple
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files || []);
          if (files.length) onAdd(files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
