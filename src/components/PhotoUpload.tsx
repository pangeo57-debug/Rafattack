"use client";

import { useRef, useState } from "react";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { Capacitor } from "@capacitor/core";
import { Plus, X, Loader2 } from "lucide-react";
import { ui } from "@/lib/ui";

const MAX_DIMENSION = 1440;
const JPEG_QUALITY = 0.72;

async function compressToDataUrl(source: File | string): Promise<string> {
  const dataUrl =
    typeof source === "string"
      ? source
      : await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(source);
        });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = reject;
    el.src = dataUrl;
  });

  const scale = Math.min(1, MAX_DIMENSION / Math.max(img.width, img.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) return dataUrl;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", JPEG_QUALITY);
}

export default function PhotoUpload({
  value,
  onChange,
  max = 6,
  label = "Photos",
  hint,
}: {
  value: string[];
  onChange: (photos: string[]) => void;
  max?: number;
  label?: string;
  hint?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function addFromNative() {
    setError(null);
    try {
      const photo = await Camera.getPhoto({
        quality: 85,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        promptLabelHeader: "Add photo",
        promptLabelPhoto: "Choose from library",
        promptLabelPicture: "Take photo",
      });
      if (!photo.dataUrl) return;
      setBusy(true);
      const compressed = await compressToDataUrl(photo.dataUrl);
      onChange([...value, compressed].slice(0, max));
    } catch {
      // user cancelled the native picker — not an error
    } finally {
      setBusy(false);
    }
  }

  async function addFromFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    setBusy(true);
    try {
      const room = Math.max(0, max - value.length);
      const picked = Array.from(files).slice(0, room);
      const compressed = await Promise.all(picked.map(compressToDataUrl));
      onChange([...value, ...compressed].slice(0, max));
    } catch {
      setError("Could not process one of the photos. Try a different file.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  const canAddMore = value.length < max;

  return (
    <div>
      <label className={ui.label}>{label}</label>
      {hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}
      <div className="mt-2 flex flex-wrap gap-3">
        {value.map((photo, i) => (
          <div key={i} className="group relative h-24 w-24 overflow-hidden rounded-lg border border-zinc-200">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="Remove photo"
              className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white opacity-0 transition-opacity group-hover:opacity-100"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}

        {canAddMore && (
          <button
            type="button"
            disabled={busy}
            onClick={() => (Capacitor.isNativePlatform() ? addFromNative() : inputRef.current?.click())}
            className="flex h-24 w-24 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 text-zinc-400 transition-colors hover:border-brand hover:text-brand disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            <span className="text-[11px]">{busy ? "Processing…" : "Add photo"}</span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        multiple
        className="hidden"
        onChange={(e) => addFromFiles(e.target.files)}
      />

      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </div>
  );
}
