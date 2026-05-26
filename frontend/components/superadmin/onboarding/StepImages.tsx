"use client";

import { useCallback, useState } from "react";
import { Upload, Check, Loader2, ImageIcon } from "lucide-react";
import { superadminUploadImage } from "../../../lib/superadminApi";
import type { StepProps } from "./types";

type UploadingState = Record<string, boolean>;

export default function StepImages({ state, onChange }: StepProps) {
  const [uploading, setUploading] = useState<UploadingState>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const menu = state.parsedMenu;

  const handleUpload = useCallback(
    async (key: string, file: File) => {
      setUploading((u) => ({ ...u, [key]: true }));
      setErrors((e) => {
        const next = { ...e };
        delete next[key];
        return next;
      });

      try {
        const { public_url } = await superadminUploadImage(file);
        if (key === "banner") {
          onChange({ bannerUrl: public_url });
        } else {
          onChange({ itemImages: { ...state.itemImages, [key]: public_url } });
        }
      } catch (err) {
        setErrors((e) => ({
          ...e,
          [key]: err instanceof Error ? err.message : "Upload failed",
        }));
      } finally {
        setUploading((u) => ({ ...u, [key]: false }));
      }
    },
    [onChange, state.itemImages],
  );

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-zinc-900">Images</h2>
      <p className="text-sm text-zinc-500">
        Upload a banner and optionally add photos for each dish. Images upload
        immediately.
      </p>

      {/* Banner */}
      <div className="space-y-2">
        <span className="block text-sm font-medium text-zinc-700">Banner Image</span>
        {state.bannerUrl ? (
          <div className="relative overflow-hidden rounded-xl border border-zinc-200">
            <img
              src={state.bannerUrl}
              alt="Banner"
              className="h-40 w-full object-cover"
            />
            <div className="absolute top-2 right-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="h-3.5 w-3.5" />
            </div>
            <label className="absolute inset-0 flex cursor-pointer items-center justify-center bg-black/0 opacity-0 transition hover:bg-black/30 hover:opacity-100">
              <span className="text-sm font-medium text-white">Replace</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleUpload("banner", f);
                }}
              />
            </label>
          </div>
        ) : (
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-6 py-10 text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-500">
            {uploading["banner"] ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <Upload className="h-8 w-8" />
            )}
            <span className="text-sm font-medium">
              {uploading["banner"] ? "Uploading…" : "Click to upload banner"}
            </span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleUpload("banner", f);
              }}
            />
          </label>
        )}
        {errors["banner"] && (
          <p className="text-xs text-red-600">{errors["banner"]}</p>
        )}
      </div>

      {/* Dish images */}
      {menu && menu.categories.length > 0 && (
        <div className="space-y-4">
          <span className="block text-sm font-medium text-zinc-700">
            Dish Photos (optional)
          </span>
          {menu.categories.map((cat, catIdx) => (
            <div key={`img-cat-${catIdx}`} className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {cat.name_en || cat.name_he || `Category ${catIdx + 1}`}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
                {cat.items.map((item, itemIdx) => {
                  const key = `${catIdx}-${itemIdx}`;
                  const url = state.itemImages[key];
                  const isUploading = uploading[key];
                  return (
                    <div key={key} className="space-y-1">
                      {url ? (
                        <label className="group relative block cursor-pointer overflow-hidden rounded-lg border border-zinc-200">
                          <img
                            src={url}
                            alt={item.name_en || item.name_he}
                            className="h-24 w-full object-cover"
                          />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/30 group-hover:opacity-100">
                            <span className="text-xs font-medium text-white">
                              Replace
                            </span>
                          </div>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUpload(key, f);
                            }}
                          />
                        </label>
                      ) : (
                        <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 text-zinc-400 transition hover:border-zinc-400 hover:text-zinc-500">
                          {isUploading ? (
                            <Loader2 className="h-5 w-5 animate-spin" />
                          ) : (
                            <ImageIcon className="h-5 w-5" />
                          )}
                          <span className="text-[10px] font-medium">
                            {isUploading ? "Uploading…" : "Photo"}
                          </span>
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const f = e.target.files?.[0];
                              if (f) void handleUpload(key, f);
                            }}
                          />
                        </label>
                      )}
                      <p className="truncate text-[10px] text-zinc-500">
                        {item.name_en || item.name_he}
                      </p>
                      {errors[key] && (
                        <p className="text-[10px] text-red-600">{errors[key]}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {!menu && (
        <p className="text-center text-sm text-zinc-400 py-4">
          No menu data yet. Go back to Step 2 to upload a menu first.
        </p>
      )}
    </div>
  );
}
