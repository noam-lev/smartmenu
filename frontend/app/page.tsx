export default function LandingPage() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-zinc-50 px-6">
      <section className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">MagicMenu</p>
        <h1 className="mt-2 text-3xl font-bold text-zinc-900">Welcome to MagicMenu SaaS</h1>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This is the platform home page. Use your tenant URL (for example
          <span className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800">
            /your-restaurant-slug
          </span>
          ) to open a diner menu or
          <span className="mx-1 rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-zinc-800">
            /your-restaurant-slug/admin
          </span>
          to manage it.
        </p>
        <a
          href="/superadmin"
          className="mt-6 inline-flex rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
        >
          Open Superadmin
        </a>
      </section>
    </main>
  );
}
