"use client";

import { useEffect, useState } from "react";
import { resolveStorageImageUrl } from "../lib/saas/storageImage";

type TicketImagePreviewProps = {
  rawImageUrl: string | null;
  alt?: string;
};

export default function TicketImagePreview({
  rawImageUrl,
  alt = "Dövme görseli",
}: TicketImagePreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function loadImage() {
      const resolvedUrl = await resolveStorageImageUrl(rawImageUrl);

      if (mounted) {
        setImageUrl(resolvedUrl);
      }
    }

    loadImage();

    return () => {
      mounted = false;
    };
  }, [rawImageUrl]);

  if (!rawImageUrl) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900 text-xs text-neutral-500">
        Görsel yok
      </div>
    );
  }

  if (!imageUrl) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl border border-white/10 bg-neutral-900 text-xs text-neutral-500">
        Yükleniyor
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-neutral-900"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={alt}
          className="h-full w-full object-cover transition group-hover:scale-105"
        />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-5xl overflow-hidden rounded-3xl border border-white/10 bg-neutral-950 p-3"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500"
            >
              Kapat
            </button>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageUrl}
              alt={alt}
              className="max-h-[85vh] max-w-full rounded-2xl object-contain"
            />
          </div>
        </div>
      ) : null}
    </>
  );
}