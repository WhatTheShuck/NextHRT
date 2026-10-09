"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, FileText, Images, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { prepareUpload } from "@/lib/client/compressImage";

export interface ExistingFile {
  id: number;
  filePath: string;
  fileType: string;
  originalName: string;
}

const MESSAGES: Record<string, string> = {
  UNSUPPORTED_FILE: "Only photos and PDFs can be uploaded.",
  IMAGE_DECODE_FAILED:
    "That photo couldn't be read. On iPhone, choose the photo again as JPEG (Settings → Camera → Formats → Most Compatible).",
};

/** Take photo / choose from gallery / upload file, with thumbnails. Photos are shrunk on-device. */
export function FilePicker({
  files,
  onChange,
  existing = [],
  onRemoveExisting,
  max = 6,
}: {
  files: File[];
  onChange: (files: File[]) => void;
  existing?: ExistingFile[];
  onRemoveExisting?: (id: number) => void;
  max?: number;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const anyFile = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const total = files.length + existing.length;

  const previews = useMemo(
    () => files.map((f) => (f.type.startsWith("image/") ? URL.createObjectURL(f) : null)),
    [files],
  );
  useEffect(() => () => previews.forEach((u) => u && URL.revokeObjectURL(u)), [previews]);

  async function add(list: FileList | null) {
    if (!list || list.length === 0) return;
    const room = max - total;
    if (list.length > room) toast.error(`You can attach up to ${max} files.`);
    setBusy(true);
    const prepared: File[] = [];
    for (const f of Array.from(list).slice(0, Math.max(room, 0))) {
      try {
        prepared.push(await prepareUpload(f));
      } catch (e) {
        toast.error(MESSAGES[(e as Error).message] ?? "That file couldn't be added.");
      }
    }
    setBusy(false);
    onChange([...files, ...prepared]);
  }

  const input = (ref: React.RefObject<HTMLInputElement | null>, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      ref={ref}
      type="file"
      className="hidden"
      onChange={(e) => {
        void add(e.target.files);
        e.target.value = ""; // allow picking the same file again
      }}
      {...props}
    />
  );

  return (
    <div className="space-y-3">
      {input(camera, { accept: "image/*", capture: "environment" })}
      {input(gallery, { accept: "image/*", multiple: true })}
      {input(anyFile, { accept: "image/*,application/pdf", multiple: true })}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button type="button" variant="outline" disabled={busy || total >= max} onClick={() => camera.current?.click()}>
          <Camera className="h-4 w-4 mr-2" /> Take photo
        </Button>
        <Button type="button" variant="outline" disabled={busy || total >= max} onClick={() => gallery.current?.click()}>
          <Images className="h-4 w-4 mr-2" /> Choose from gallery
        </Button>
        <Button type="button" variant="outline" disabled={busy || total >= max} onClick={() => anyFile.current?.click()}>
          <Upload className="h-4 w-4 mr-2" /> Upload PDF or image
        </Button>
      </div>
      {busy && (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
        </p>
      )}

      {total > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {existing.map((f) => (
            <Thumb key={`e${f.id}`} name={f.originalName}
              src={f.fileType.startsWith("image/") ? `/api/images/${f.filePath}` : null}
              onRemove={onRemoveExisting ? () => onRemoveExisting(f.id) : undefined} />
          ))}
          {files.map((f, i) => (
            <Thumb key={`n${i}`} name={f.name} src={previews[i]}
              onRemove={() => onChange(files.filter((_, j) => j !== i))} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Add the front and back if the card has both. Up to {max} files.</p>
    </div>
  );
}

function Thumb({ name, src, onRemove }: { name: string; src: string | null; onRemove?: () => void }) {
  return (
    <li className="relative rounded-md border overflow-hidden bg-muted/40 aspect-[4/3] flex items-center justify-center">
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob/API URLs, not optimisable
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1 p-2 text-xs text-muted-foreground">
          <FileText className="h-6 w-6" />
          <span className="truncate max-w-full">{name}</span>
        </div>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Remove ${name}`}
          className="absolute top-1 right-1 rounded-full bg-background/90 p-1 shadow">
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
