/** Base URL for FastAPI. Use `/api/backend` in dev to proxy via Next (see next.config.ts). */
export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL?.trim() || "http://localhost:8000";

function isAbsoluteApiBase(base: string): boolean {
  return /^https?:\/\//i.test(base);
}

/**
 * Build a fetch URL for the API. Supports absolute bases and same-origin relative
 * paths (e.g. `/api/backend`) — `new URL(relative)` throws in the browser.
 */
export function buildApiUrl(
  path: string,
  searchParams?: Record<string, string | undefined>,
): string {
  const base = API_BASE_URL.replace(/\/$/, "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const full = `${base}${normalizedPath}`;

  const entries = Object.entries(searchParams ?? {}).filter(
    (entry): entry is [string, string] =>
      typeof entry[1] === "string" && entry[1].length > 0,
  );

  if (isAbsoluteApiBase(full)) {
    const url = new URL(full);
    for (const [key, value] of entries) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  if (entries.length === 0) {
    return full;
  }
  const qs = new URLSearchParams(
    Object.fromEntries(entries) as Record<string, string>,
  ).toString();
  return `${full}?${qs}`;
}