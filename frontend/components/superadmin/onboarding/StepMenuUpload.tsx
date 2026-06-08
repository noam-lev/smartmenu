"use client";

import { useMemo, useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { compressImagesForUpload } from "../../../lib/compressImage";
import { isImageFile, isPdfFile } from "../../../lib/menuFileUtils";
import { getPdfPageCount } from "../../../lib/pdfPageCount";
import {
  MAX_MENU_PARSE_IMAGES,
  parseMenuImages,
  type ParsedCategory,
  type ParsedItem,
  type ParsedMenu,
} from "../../../lib/superadminApi";
import type { StepProps } from "./types";

type ParsePhase = "idle" | "validating" | "converting" | "analyzing";

function blankItem(): ParsedItem {
  return {
    name_he: "",
    name_en: "",
    description_he: null,
    description_en: null,
    base_price: 0,
  };
}

function blankCategory(): ParsedCategory {
  return { name_he: "", name_en: "", items: [blankItem()] };
}

export default function StepMenuUpload({ state, onChange }: StepProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [parsePhase, setParsePhase] = useState<ParsePhase>("idle");
  const [error, setError] = useState<string | null>(null);

  const parsing = parsePhase === "converting" || parsePhase === "analyzing";
  const validatingPdf = parsePhase === "validating";
  const isPdfUpload =
    files.length === 1 && files[0] !== undefined && isPdfFile(files[0]);
  const isMultiPage =
    isPdfUpload || files.length > 1;

  const menu = state.parsedMenu;

  const totalItems = useMemo(
    () =>
      menu
        ? menu.categories.reduce((s, c) => s + c.items.length, 0)
        : 0,
    [menu],
  );

  const handleFileChange = (selected: FileList | null) => {
    void (async () => {
      const next = Array.from(selected ?? []);
      if (next.length === 0) {
        setFiles([]);
        setError(null);
        return;
      }

      const pdfFiles = next.filter(isPdfFile);
      const imageFiles = next.filter(isImageFile);

      if (pdfFiles.length > 0 && imageFiles.length > 0) {
        setError("Upload either one PDF or up to 7 images, not both.");
        return;
      }
      if (pdfFiles.length > 1) {
        setError("Only one PDF can be uploaded at a time.");
        return;
      }
      if (pdfFiles.length === 1) {
        setParsePhase("validating");
        setError(null);
        try {
          const pageCount = await getPdfPageCount(pdfFiles[0]);
          if (pageCount > MAX_MENU_PARSE_IMAGES) {
            setError(
              `This PDF has ${pageCount} pages. Maximum allowed is ${MAX_MENU_PARSE_IMAGES}. Please split the file or upload images instead.`,
            );
            setFiles([]);
            return;
          }
          setFiles([pdfFiles[0]]);
        } catch {
          setError(
            "Could not read PDF. The file may be corrupted or password-protected.",
          );
          setFiles([]);
        } finally {
          setParsePhase("idle");
        }
        return;
      }

      if (imageFiles.length > MAX_MENU_PARSE_IMAGES) {
        setError(
          `You can select up to ${MAX_MENU_PARSE_IMAGES} images at once.`,
        );
        setFiles(imageFiles.slice(0, MAX_MENU_PARSE_IMAGES));
        return;
      }

      const unsupported = next.filter((f) => !isImageFile(f));
      if (unsupported.length > 0) {
        setError("Only images or a single PDF are supported.");
        return;
      }

      setError(null);
      setFiles(imageFiles);
    })();
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setError(null);
  };

  const handleParse = async () => {
    if (files.length === 0) return;
    setError(null);
    setParsePhase(isPdfUpload ? "converting" : "analyzing");
    try {
      const toUpload = isPdfUpload
        ? files
        : await compressImagesForUpload(files);
      const parsed = await parseMenuImages(toUpload, {
        onUploadComplete: isPdfUpload
          ? () => setParsePhase("analyzing")
          : undefined,
      });
      onChange({ parsedMenu: parsed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse menu.");
    } finally {
      setParsePhase("idle");
    }
  };

  const updateMenu = (updater: (m: ParsedMenu) => ParsedMenu) => {
    if (!menu) return;
    onChange({ parsedMenu: updater(menu) });
  };

  const updateCategory = (
    catIdx: number,
    updater: (c: ParsedCategory) => ParsedCategory,
  ) => {
    updateMenu((m) => ({
      ...m,
      categories: m.categories.map((c, i) =>
        i === catIdx ? updater(c) : c,
      ),
    }));
  };

  const updateItem = (
    catIdx: number,
    itemIdx: number,
    updater: (item: ParsedItem) => ParsedItem,
  ) => {
    updateCategory(catIdx, (c) => ({
      ...c,
      items: c.items.map((item, i) =>
        i === itemIdx ? updater(item) : item,
      ),
    }));
  };

  const removeCategory = (catIdx: number) => {
    updateMenu((m) => ({
      ...m,
      categories: m.categories.filter((_, i) => i !== catIdx),
    }));
  };

  const removeItem = (catIdx: number, itemIdx: number) => {
    updateCategory(catIdx, (c) => ({
      ...c,
      items: c.items.filter((_, i) => i !== itemIdx),
    }));
  };

  const addCategory = () => {
    updateMenu((m) => ({
      ...m,
      categories: [...m.categories, blankCategory()],
    }));
  };

  const addItem = (catIdx: number) => {
    updateCategory(catIdx, (c) => ({
      ...c,
      items: [...c.items, blankItem()],
    }));
  };

  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold text-zinc-900">Menu Upload</h2>
      <p className="text-sm text-zinc-500">
        Upload one PDF (up to {MAX_MENU_PARSE_IMAGES} pages) or up to{" "}
        {MAX_MENU_PARSE_IMAGES} menu photos for AI parsing, then edit the
        results. You can also add categories and items manually.
      </p>

      {/* Upload section */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-zinc-700">
            Menu file
          </span>
          <input
            type="file"
            accept="image/*,.pdf,application/pdf"
            multiple
            onChange={(e) => handleFileChange(e.target.files)}
            disabled={validatingPdf || parsing}
            className="block w-full cursor-pointer rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
        <button
          type="button"
          onClick={() => void handleParse()}
          disabled={files.length === 0 || parsing || validatingPdf}
          className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {parsing ? "Analyzing…" : "Analyze Menu"}
        </button>
      </div>

      {files.length > 0 && (
        <ul className="space-y-1.5 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
          {files.map((f, i) => (
            <li
              key={`${f.name}-${f.size}-${i}`}
              className="flex items-center justify-between gap-2 text-sm text-zinc-700"
            >
              <span className="truncate">
                {i + 1}. {f.name}
              </span>
              <button
                type="button"
                onClick={() => removeFile(i)}
                disabled={parsing}
                className="shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                aria-label={`Remove ${f.name}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {validatingPdf && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          Checking PDF…
        </div>
      )}

      {parsing && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
          {parsePhase === "converting"
            ? "Converting PDF…"
            : isMultiPage
              ? "AI is carefully analyzing all pages, this may take up to a minute…"
              : "AI is analyzing and translating the menu…"}
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Editable preview */}
      {menu && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-zinc-600">
              {menu.categories.length} categories, {totalItems} items
            </p>
            <button
              type="button"
              onClick={addCategory}
              className="flex items-center gap-1 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              <Plus className="h-3.5 w-3.5" /> Category
            </button>
          </div>

          <div className="space-y-4">
            {menu.categories.map((cat, catIdx) => (
              <div
                key={`cat-${catIdx}`}
                className="overflow-hidden rounded-xl border border-zinc-200"
              >
                <header className="flex items-start justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="grid flex-1 gap-2 sm:grid-cols-2">
                    <input
                      value={cat.name_en}
                      onChange={(e) =>
                        updateCategory(catIdx, (c) => ({
                          ...c,
                          name_en: e.target.value,
                        }))
                      }
                      placeholder="Category (EN)"
                      className="rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
                    />
                    <input
                      dir="rtl"
                      value={cat.name_he}
                      onChange={(e) =>
                        updateCategory(catIdx, (c) => ({
                          ...c,
                          name_he: e.target.value,
                        }))
                      }
                      placeholder="(HE) קטגוריה"
                      className="rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-900 outline-none ring-zinc-400 focus:ring-2 sm:text-right"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCategory(catIdx)}
                    className="mt-1 shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove category"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </header>

                <div className="divide-y divide-zinc-100">
                  {cat.items.map((item, itemIdx) => (
                    <div
                      key={`cat-${catIdx}-item-${itemIdx}`}
                      className="flex items-start gap-2 px-4 py-3"
                    >
                      <div className="grid flex-1 gap-2 sm:grid-cols-[1fr_1fr_5rem]">
                        <div className="space-y-1.5">
                          <input
                            value={item.name_en}
                            onChange={(e) =>
                              updateItem(catIdx, itemIdx, (it) => ({
                                ...it,
                                name_en: e.target.value,
                              }))
                            }
                            placeholder="Item (EN)"
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
                          />
                          <input
                            value={item.description_en ?? ""}
                            onChange={(e) =>
                              updateItem(catIdx, itemIdx, (it) => ({
                                ...it,
                                description_en: e.target.value || null,
                              }))
                            }
                            placeholder="Description (EN)"
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-600 outline-none ring-zinc-400 focus:ring-2"
                          />
                        </div>
                        <div className="space-y-1.5" dir="rtl">
                          <input
                            value={item.name_he}
                            onChange={(e) =>
                              updateItem(catIdx, itemIdx, (it) => ({
                                ...it,
                                name_he: e.target.value,
                              }))
                            }
                            placeholder="(HE) פריט"
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-900 outline-none ring-zinc-400 focus:ring-2 sm:text-right"
                          />
                          <input
                            dir="rtl"
                            value={item.description_he ?? ""}
                            onChange={(e) =>
                              updateItem(catIdx, itemIdx, (it) => ({
                                ...it,
                                description_he: e.target.value || null,
                              }))
                            }
                            placeholder="(HE) תיאור"
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-1.5 text-xs text-zinc-600 outline-none ring-zinc-400 focus:ring-2 sm:text-right"
                          />
                        </div>
                        <label className="sm:self-center">
                          <span className="sr-only">Price</span>
                          <input
                            type="number"
                            step="0.01"
                            min={0}
                            value={
                              Number.isFinite(item.base_price)
                                ? item.base_price
                                : 0
                            }
                            onChange={(e) =>
                              updateItem(catIdx, itemIdx, (it) => ({
                                ...it,
                                base_price: Number(e.target.value || 0),
                              }))
                            }
                            className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
                          />
                        </label>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeItem(catIdx, itemIdx)}
                        className="mt-1 shrink-0 rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="border-t border-zinc-100 px-4 py-2">
                  <button
                    type="button"
                    onClick={() => addItem(catIdx)}
                    className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-800"
                  >
                    <Plus className="h-3 w-3" /> Add item
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!menu && !parsing && !validatingPdf && (
        <p className="text-center text-sm text-zinc-400 py-6">
          Upload and analyze a menu PDF or photos to get started, or add
          categories manually after analyzing.
        </p>
      )}
    </div>
  );
}
