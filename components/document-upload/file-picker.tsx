"use client";

import { useEffect, useRef, useState } from "react";
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

  // `add` awaits per file; read the latest props afterwards, not the ones it closed over.
  const latest = useRef({ files, existingCount: existing.length, onChange });
  useEffect(() => {
    latest.current = { files, existingCount: existing.length, onChange };
  });

  async function add(list: File[]) {
    if (list.length === 0) return;
    const room = max - latest.current.files.length - latest.current.existingCount;
    if (list.length > room) toast.error(`You can attach up to ${max} files.`);
    setBusy(true);
    const prepared: File[] = [];
    for (const f of list.slice(0, Math.max(room, 0))) {
      try {
        prepared.push(await prepareUpload(f));
      } catch (e) {
        toast.error(MESSAGES[(e as Error).message] ?? "That file couldn't be added.");
      }
    }
    setBusy(false);
    if (prepared.length > 0) latest.current.onChange([...latest.current.files, ...prepared]);
  }

  const input = (ref: React.RefObject<HTMLInputElement | null>, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <input
      ref={ref}
      type="file"
      className="hidden"
      onChange={(e) => {
        const picked = Array.from(e.target.files ?? []); // copy before the reset empties the list
        e.target.value = ""; // allow picking the same file again
        void add(picked);
      }}
      {...props}
    />
  );

  return (
    <div className="space-y-3">
      {input(camera, { accept: "image/*", capture: "environment" })}
      {input(gallery, { accept: "image/*", multiple: true })}
      {input(anyFile, { accept: "image/*,application/pdf", multiple: true })}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2" data-tour="docs-file-buttons">
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
      {/* Always rendered so screen readers announce the text change. */}
      <p role="status" className="text-sm text-muted-foreground flex items-center gap-2 empty:hidden">
        {busy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Preparing…
          </>
        ) : null}
      </p>

      {total > 0 && (
        <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-tour="docs-file-thumbs">
          {existing.map((f) => (
            <Thumb key={`e${f.id}`} name={f.originalName}
              src={f.fileType.startsWith("image/") ? `/api/images/${f.filePath}` : null}
              onRemove={onRemoveExisting ? () => onRemoveExisting(f.id) : undefined} disabled={busy} />
          ))}
          {files.map((f) => (
            <Thumb key={`n${fileKey(f)}`} name={f.name} file={f}
              onRemove={() => onChange(files.filter((x) => x !== f))} disabled={busy} />
          ))}
        </ul>
      )}
      <p className="text-xs text-muted-foreground">Add the front and back if the card has both. Up to {max} files.</p>
    </div>
  );
}

// A stable React key per picked File, so each thumbnail keeps its own preview URL.
const fileKeys = new WeakMap<File, number>();
let nextFileKey = 0;
function fileKey(f: File): number {
  let k = fileKeys.get(f);
  if (k === undefined) {
    k = nextFileKey++;
    fileKeys.set(f, k);
  }
  return k;
}

function Thumb({
  name,
  src: remoteSrc,
  file,
  onRemove,
  disabled,
}: {
  name: string;
  /** A server URL (existing file), or null for a non-image. */
  src?: string | null;
  /** A newly picked file; images get a blob preview owned by this thumbnail. */
  file?: File;
  onRemove?: () => void;
  /** While new files are being prepared, so a removal can't be overwritten when they land. */
  disabled?: boolean;
}) {
  // The blob URL is created, set on the <img> and revoked in one effect keyed by this file, so
  // StrictMode's mount/unmount/mount gets a fresh URL and a removal can't shift previews along.
  const isImage = file ? file.type.startsWith("image/") : !!remoteSrc;
  const img = useRef<HTMLImageElement>(null);
  useEffect(() => {
    if (!file || !file.type.startsWith("image/") || !img.current) return;
    const url = URL.createObjectURL(file);
    img.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <li className="relative rounded-md border overflow-hidden bg-muted/40 aspect-[4/3] flex items-center justify-center">
      {isImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- blob/API URLs, not optimisable
        <img ref={img} src={file ? undefined : (remoteSrc ?? undefined)} alt={name} className="h-full w-full object-cover" />
      ) : (
        <div className="flex flex-col items-center gap-1 p-2 text-xs text-muted-foreground min-w-0 w-full">
          <FileText className="h-6 w-6" />
          <span className="truncate max-w-full">{name}</span>
        </div>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} disabled={disabled} aria-label={`Remove ${name}`}
          className="absolute top-1 right-1 rounded-full bg-background/90 p-2 shadow disabled:opacity-50">
          <X className="h-4 w-4" />
        </button>
      )}
    </li>
  );
}
