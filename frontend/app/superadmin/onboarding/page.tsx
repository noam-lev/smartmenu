"use client";

import { useMemo, useState } from "react";
import {
  importRestaurant,
  parseMenuImage,
  type ParsedCategory,
  type ParsedItem,
  type ParsedMenu,
} from "../../../lib/superadminApi";

function toSlug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export default function SuperadminOnboardingPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedMenu | null>(null);
  const [restaurantName, setRestaurantName] = useState("");
  const [restaurantSlug, setRestaurantSlug] = useState("");

  const totalItems = useMemo(() => {
    if (!preview) {
      return 0;
    }
    return preview.categories.reduce((sum, category) => sum + category.items.length, 0);
  }, [preview]);

  const handleParse = async () => {
    if (!selectedFile) {
      setError("Please select an image first.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsParsing(true);
    setPreview(null);
    try {
      const parsed = await parseMenuImage(selectedFile);
      setPreview(parsed);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse menu image.");
    } finally {
      setIsParsing(false);
    }
  };

  const updateCategory = (
    categoryIndex: number,
    updater: (category: ParsedCategory) => ParsedCategory,
  ) => {
    setPreview((prev) => {
      if (!prev) {
        return prev;
      }
      const nextCategories = prev.categories.map((category, index) =>
        index === categoryIndex ? updater(category) : category,
      );
      return { ...prev, categories: nextCategories };
    });
  };

  const updateItem = (
    categoryIndex: number,
    itemIndex: number,
    updater: (item: ParsedItem) => ParsedItem,
  ) => {
    updateCategory(categoryIndex, (category) => ({
      ...category,
      items: category.items.map((item, index) =>
        index === itemIndex ? updater(item) : item,
      ),
    }));
  };

  const handleSaveRestaurant = async () => {
    if (!preview) {
      setError("Parse a menu image first.");
      return;
    }
    const normalizedName = restaurantName.trim();
    const normalizedSlug = toSlug(restaurantSlug);
    if (!normalizedName) {
      setError("Restaurant name is required.");
      return;
    }
    if (!normalizedSlug) {
      setError("Restaurant slug is required.");
      return;
    }

    setError(null);
    setSuccessMessage(null);
    setIsSaving(true);
    try {
      const result = await importRestaurant({
        restaurant_name: normalizedName,
        restaurant_slug: normalizedSlug,
        categories: preview.categories,
      });
      setSuccessMessage(
        `Restaurant "${result.restaurant_slug}" created successfully.`,
      );
      setSelectedFile(null);
      setPreview(null);
      setRestaurantName("");
      setRestaurantSlug("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import restaurant.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
      <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">Onboarding</h1>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-zinc-600 sm:text-base">
        Upload a menu photo and let AI extract bilingual categories and dishes for review.
      </p>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <h2 className="text-base font-semibold text-zinc-900">Restaurant Details</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">Restaurant Name</span>
            <input
              type="text"
              value={restaurantName}
              onChange={(event) => {
                const next = event.target.value;
                setRestaurantName(next);
                setRestaurantSlug((prev) => (prev ? prev : toSlug(next)));
                setSuccessMessage(null);
              }}
              placeholder="Hummus Yossi"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-700">Restaurant Slug</span>
            <input
              type="text"
              value={restaurantSlug}
              onChange={(event) => {
                setRestaurantSlug(toSlug(event.target.value));
                setSuccessMessage(null);
              }}
              placeholder="hummus-yossi"
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-800 outline-none ring-zinc-400 focus:ring-2"
            />
          </label>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-700">Menu Image</span>
            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                setSelectedFile(event.target.files?.[0] ?? null);
                setError(null);
              }}
              className="block w-full cursor-pointer rounded-xl border border-zinc-300 bg-zinc-50 px-3 py-2.5 text-sm text-zinc-700 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-white hover:bg-zinc-100"
            />
          </label>
          <button
            type="button"
            onClick={() => {
              void handleParse();
            }}
            disabled={!selectedFile || isParsing}
            className="rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isParsing ? "Analyzing..." : "Analyze Menu"}
          </button>
        </div>

        {selectedFile ? (
          <p className="mt-3 text-xs text-zinc-500">
            Selected file: <span className="font-medium text-zinc-700">{selectedFile.name}</span>
          </p>
        ) : null}

        {isParsing ? (
          <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800">
            AI is analyzing and translating the menu...
          </div>
        ) : null}

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}
      </section>

      {preview ? (
        <section className="mt-6 space-y-4">
          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg font-semibold text-zinc-900">Preview</h2>
            <p className="mt-1 text-sm text-zinc-600">
              {preview.categories.length} categories, {totalItems} items extracted.
            </p>
          </div>

          {preview.categories.map((category, idx) => (
            <article
              key={`${category.name_en}-${category.name_he}-${idx}`}
              className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm"
            >
              <header className="border-b border-zinc-200 bg-zinc-50 px-4 py-3 sm:px-5">
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">Category</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <input
                    value={category.name_en}
                    onChange={(event) =>
                      updateCategory(idx, (curr) => ({
                        ...curr,
                        name_en: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
                  />
                  <input
                    dir="rtl"
                    value={category.name_he}
                    onChange={(event) =>
                      updateCategory(idx, (curr) => ({
                        ...curr,
                        name_he: event.target.value,
                      }))
                    }
                    className="rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-medium text-zinc-900 outline-none ring-zinc-400 focus:ring-2 sm:text-right"
                  />
                </div>
              </header>

              <div className="divide-y divide-zinc-100">
                {category.items.map((item, itemIdx) => (
                  <div key={`${item.name_en}-${item.name_he}-${itemIdx}`} className="px-4 py-3 sm:px-5">
                    <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-start">
                      <div>
                        <input
                          value={item.name_en}
                          onChange={(event) =>
                            updateItem(idx, itemIdx, (curr) => ({
                              ...curr,
                              name_en: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
                        />
                        <textarea
                          value={item.description_en ?? ""}
                          onChange={(event) =>
                            updateItem(idx, itemIdx, (curr) => ({
                              ...curr,
                              description_en: event.target.value || null,
                            }))
                          }
                          rows={2}
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-600 outline-none ring-zinc-400 focus:ring-2"
                        />
                      </div>
                      <div className="sm:text-right" dir="rtl">
                        <input
                          value={item.name_he}
                          onChange={(event) =>
                            updateItem(idx, itemIdx, (curr) => ({
                              ...curr,
                              name_he: event.target.value,
                            }))
                          }
                          className="w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-900 outline-none ring-zinc-400 focus:ring-2 sm:text-right"
                        />
                        <textarea
                          dir="rtl"
                          value={item.description_he ?? ""}
                          onChange={(event) =>
                            updateItem(idx, itemIdx, (curr) => ({
                              ...curr,
                              description_he: event.target.value || null,
                            }))
                          }
                          rows={2}
                          className="mt-2 w-full rounded-lg border border-zinc-300 px-2.5 py-2 text-sm text-zinc-600 outline-none ring-zinc-400 focus:ring-2 sm:text-right"
                        />
                      </div>
                      <label className="sm:self-center">
                        <span className="sr-only">Base price</span>
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          value={Number.isFinite(item.base_price) ? item.base_price : 0}
                          onChange={(event) =>
                            updateItem(idx, itemIdx, (curr) => ({
                              ...curr,
                              base_price: Number(event.target.value || 0),
                            }))
                          }
                          className="w-28 rounded-lg border border-zinc-300 px-2.5 py-2 text-sm font-semibold text-zinc-900 outline-none ring-zinc-400 focus:ring-2"
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}

          <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
            <button
              type="button"
              disabled={isSaving}
              onClick={() => {
                void handleSaveRestaurant();
              }}
              className="w-full rounded-xl bg-zinc-900 px-4 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? "Saving..." : "Save & Create Restaurant"}
            </button>
            {successMessage ? (
              <p className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                {successMessage}
              </p>
            ) : null}
          </div>
        </section>
      ) : null}
    </main>
  );
}
