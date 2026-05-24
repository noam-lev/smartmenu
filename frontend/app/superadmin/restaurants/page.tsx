"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, ChevronLeft, ChevronRight, ExternalLink } from "lucide-react";
import {
  fetchRestaurants,
  type RestaurantListItem,
} from "../../../lib/superadminApi";

const PAGE_SIZE = 25;

type FilterStatus = "all" | "active" | "inactive";

function PlanBadge({ tier }: { tier: string }) {
  const colors: Record<string, string> = {
    free: "bg-zinc-100 text-zinc-600",
    starter: "bg-blue-50 text-blue-700",
    pro: "bg-purple-50 text-purple-700",
    enterprise: "bg-amber-50 text-amber-800",
  };
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${colors[tier] ?? colors.free}`}
    >
      {tier}
    </span>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span
        className={`inline-block h-2 w-2 rounded-full ${active ? "bg-emerald-500" : "bg-zinc-300"}`}
      />
      {active ? "Active" : "Inactive"}
    </span>
  );
}

export default function SuperadminRestaurantsPage() {
  const [restaurants, setRestaurants] = useState<RestaurantListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [page, setPage] = useState(0);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(
    async (s: string, f: FilterStatus, p: number) => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetchRestaurants({
          search: s || undefined,
          is_active: f === "all" ? undefined : f === "active",
          offset: p * PAGE_SIZE,
          limit: PAGE_SIZE,
        });
        setRestaurants(data.restaurants);
        setTotal(data.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load restaurants.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(search, filter, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, page]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setPage(0);
      void load(search, filter, 0);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
            Restaurants
          </h1>
          <p className="mt-0.5 text-sm text-zinc-500">
            {total} restaurant{total !== 1 ? "s" : ""} total
          </p>
        </div>
      </div>

      {/* Search + filter bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug..."
            className="min-h-11 w-full rounded-xl border border-zinc-300 bg-white pl-9 pr-3 py-2 text-sm outline-none ring-zinc-400 transition focus:ring-2 sm:min-h-0 sm:py-2"
          />
        </div>
        <div className="flex gap-1 rounded-xl border border-zinc-300 bg-white p-1">
          {(["all", "active", "inactive"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setFilter(v);
                setPage(0);
              }}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium capitalize transition ${
                filter === v
                  ? "bg-zinc-900 text-white"
                  : "text-zinc-600 hover:bg-zinc-100"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-100 text-xs font-medium uppercase tracking-wide text-zinc-500">
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="hidden px-4 py-3 sm:table-cell">Status</th>
              <th className="hidden px-4 py-3 md:table-cell">Plan</th>
              <th className="hidden px-4 py-3 lg:table-cell">Members</th>
              <th className="hidden px-4 py-3 lg:table-cell">Menus</th>
              <th className="px-4 py-3">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {loading && restaurants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-400">
                  Loading...
                </td>
              </tr>
            ) : restaurants.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-zinc-400">
                  No restaurants found.
                </td>
              </tr>
            ) : (
              restaurants.map((r) => (
                <tr
                  key={r.id}
                  className="transition hover:bg-zinc-50"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900">
                    <Link
                      href={`/superadmin/restaurants/${r.slug}`}
                      className="hover:underline"
                    >
                      {r.name || r.slug}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-zinc-500">
                    <span className="inline-flex items-center gap-1">
                      {r.slug}
                      <a
                        href={`/${r.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-zinc-400 hover:text-zinc-600"
                        title="Open diner page"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </span>
                  </td>
                  <td className="hidden px-4 py-3 sm:table-cell">
                    <StatusDot active={r.is_active} />
                  </td>
                  <td className="hidden px-4 py-3 md:table-cell">
                    <PlanBadge tier={r.plan_tier} />
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                    {r.member_count}
                  </td>
                  <td className="hidden px-4 py-3 text-zinc-600 lg:table-cell">
                    {r.active_menu_count}/{r.menu_count}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/superadmin/restaurants/${r.slug}`}
                      className="inline-block rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-900"
                    >
                      Manage
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm text-zinc-600">
          <span>
            Page {page + 1} of {totalPages}
          </span>
          <div className="flex gap-1">
            <button
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white transition hover:bg-zinc-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 bg-white transition hover:bg-zinc-50 disabled:opacity-40"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
