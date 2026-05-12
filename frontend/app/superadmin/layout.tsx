"use client";

import type { FormEvent, ReactNode } from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import {
  SUPERADMIN_TOKEN_STORAGE_KEY,
  setStoredSuperadminToken,
  superadminLogin,
  superadminLogout,
} from "../../lib/superadminApi";

const NAV_ITEMS = [
  { href: "/superadmin", label: "Dashboard", end: true },
  { href: "/superadmin/restaurants", label: "Restaurants", end: false },
  { href: "/superadmin/onboarding", label: "Onboarding", end: false },
] as const;

function navLinkClass(active: boolean) {
  return `block rounded-lg px-3 py-2.5 text-sm font-medium transition sm:py-2 ${
    active ? "bg-zinc-800 text-white" : "text-zinc-300 hover:bg-zinc-800/80 hover:text-white"
  }`;
}

function isNavActive(pathname: string, href: string, end: boolean) {
  if (end) {
    return pathname === href;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({
  pathname,
  onLinkClick,
}: {
  pathname: string;
  onLinkClick?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1 p-3">
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onLinkClick}
          className={navLinkClass(isNavActive(pathname, item.href, item.end))}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export default function SuperadminLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [hydrated, setHydrated] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    setAuthed(Boolean(localStorage.getItem(SUPERADMIN_TOKEN_STORAGE_KEY)));
    setHydrated(true);
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileNavOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileNavOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileNavOpen]);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoginError(null);
    const form = event.currentTarget;
    const password = String(new FormData(form).get("password") ?? "").trim();
    if (!password) {
      setLoginError("Password is required.");
      return;
    }

    setLoginBusy(true);
    try {
      const { token } = await superadminLogin(password);
      setStoredSuperadminToken(token);
      setAuthed(true);
      form.reset();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed.");
    } finally {
      setLoginBusy(false);
    }
  };

  const handleLogout = async () => {
    await superadminLogout();
    setAuthed(false);
  };

  if (!hydrated) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        <p className="text-sm">Loading…</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-zinc-950 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="w-full max-w-sm rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-xl">
          <h1 className="text-center text-lg font-semibold text-white">Superadmin</h1>
          <p className="mt-1 text-center text-xs text-zinc-500">Secure MVP — authorized access only</p>
          <form className="mt-6 space-y-4" onSubmit={handleLogin}>
            <label className="block text-xs font-medium text-zinc-400" htmlFor="superadmin-password">
              Password
            </label>
            <input
              id="superadmin-password"
              name="password"
              type="password"
              autoComplete="current-password"
              className="min-h-11 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-base text-white outline-none ring-zinc-500 focus:ring-2 sm:text-sm"
              disabled={loginBusy}
            />
            {loginError ? (
              <p className="text-sm text-red-400" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={loginBusy}
              className="min-h-11 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-zinc-900 disabled:opacity-60"
            >
              {loginBusy ? "Signing in…" : "Unlock"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const currentSectionLabel =
    NAV_ITEMS.find((i) => isNavActive(pathname, i.href, i.end))?.label ?? "Control center";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-zinc-100 text-zinc-900 md:flex-row">
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex min-h-14 shrink-0 items-center gap-3 border-b border-zinc-200 bg-white px-3 pt-[max(0.5rem,env(safe-area-inset-top))] pb-2 shadow-sm md:hidden">
        <button
          type="button"
          onClick={() => setMobileNavOpen(true)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 text-zinc-900 active:bg-zinc-100"
          aria-expanded={mobileNavOpen}
          aria-controls="superadmin-mobile-nav"
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1 py-1">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-zinc-500">Superadmin</p>
          <p className="truncate text-sm font-bold text-zinc-900">{currentSectionLabel}</p>
        </div>
      </header>

      {/* Mobile drawer + backdrop */}
      <div
        className={`fixed inset-0 z-40 bg-black/50 transition-opacity duration-200 md:hidden ${
          mobileNavOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden={!mobileNavOpen}
        onClick={() => setMobileNavOpen(false)}
      />

      <aside
        id="superadmin-mobile-nav"
        className={`fixed inset-y-0 left-0 z-50 flex w-[min(20rem,calc(100vw-2.5rem))] max-w-[20rem] flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100 shadow-2xl transition-transform duration-200 ease-out md:hidden ${
          mobileNavOpen ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
        aria-hidden={!mobileNavOpen}
      >
        <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Superadmin</p>
            <p className="truncate text-sm font-bold text-white">Menu</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-zinc-400 hover:bg-zinc-800 hover:text-white"
            aria-label="Close menu"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <NavLinks pathname={pathname} onLinkClick={() => setMobileNavOpen(false)} />
        </div>
        <div className="border-t border-zinc-800 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={() => {
              setMobileNavOpen(false);
              void handleLogout();
            }}
            className="min-h-11 w-full rounded-lg border border-zinc-700 px-3 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-900 sm:min-h-0 sm:py-2"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden w-56 shrink-0 flex-col border-r border-zinc-800 bg-zinc-950 text-zinc-100 md:flex">
        <div className="border-b border-zinc-800 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Superadmin</p>
          <p className="text-sm font-bold text-white">Control center</p>
        </div>
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          <NavLinks pathname={pathname} />
        </div>
        <div className="border-t border-zinc-800 p-3">
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 hover:bg-zinc-900"
          >
            Logout
          </button>
        </div>
      </aside>

      {/* Main: full width on mobile */}
      <div className="min-h-0 min-w-0 flex-1 overflow-x-hidden pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        {children}
      </div>
    </div>
  );
}
