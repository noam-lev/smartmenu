"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  ExternalLink,
  Save,
  UserPlus,
  Trash2,
  X,
} from "lucide-react";
import {
  fetchRestaurantDetail,
  patchRestaurant,
  addRestaurantMember,
  updateMemberRole,
  removeMember,
  updateSubscription,
  type RestaurantDetail,
  type RestaurantMember,
  type RestaurantSubscription,
  type RestaurantMenu,
} from "../../../../lib/superadminApi";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

type Tab = "overview" | "members" | "subscription" | "menus" | "danger";

const TABS: { key: Tab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "members", label: "Members" },
  { key: "subscription", label: "Subscription" },
  { key: "menus", label: "Menus" },
  { key: "danger", label: "Danger Zone" },
];

const PLAN_TIERS = ["free", "starter", "pro", "enterprise"] as const;

function Alert({
  variant,
  children,
  onDismiss,
}: {
  variant: "error" | "success";
  children: React.ReactNode;
  onDismiss?: () => void;
}) {
  const colors =
    variant === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return (
    <div className={`relative rounded-xl border px-4 py-3 text-sm ${colors}`}>
      {children}
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-2 top-2 p-1 opacity-60 hover:opacity-100"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm sm:p-5">
      {title && (
        <h3 className="mb-4 text-sm font-semibold text-zinc-900">{title}</h3>
      )}
      {children}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-zinc-500">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "min-h-11 w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm outline-none ring-zinc-400 transition focus:ring-2 sm:min-h-0 sm:py-2";

const btnPrimary =
  "inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 sm:py-2";
const btnSecondary =
  "inline-flex items-center gap-2 rounded-xl border border-zinc-300 bg-white px-4 py-2.5 text-sm font-medium text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 sm:py-2";
const btnDanger =
  "inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-50 sm:py-2";

// ---------------------------------------------------------------------------
// Overview section
// ---------------------------------------------------------------------------

function OverviewSection({
  restaurant,
  onSave,
}: {
  restaurant: RestaurantDetail;
  onSave: (r: RestaurantDetail) => void;
}) {
  const [form, setForm] = useState({
    name: restaurant.name,
    slug: restaurant.slug,
    currency: restaurant.currency,
    default_locale: restaurant.default_locale ?? "he",
  });
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    msg: string;
  } | null>(null);
  const router = useRouter();

  const dirty =
    form.name !== restaurant.name ||
    form.slug !== restaurant.slug ||
    form.currency !== restaurant.currency ||
    form.default_locale !== (restaurant.default_locale ?? "he");

  const BASE_LOCALES: Record<string, string> = { he: "Hebrew", en: "English" };
  const KNOWN_LABELS: Record<string, string> = {
    he: "Hebrew",
    en: "English",
    ar: "Arabic",
    ru: "Russian",
    fr: "French",
    es: "Spanish",
  };

  const localeOptions = useMemo(() => {
    const seen = new Set<string>(Object.keys(BASE_LOCALES));
    const opts = Object.entries(BASE_LOCALES).map(([code, label]) => ({
      code,
      label: `${label} (${code})`,
    }));

    const translationKeys = Object.keys(restaurant.translations ?? {});
    for (const key of translationKeys) {
      if (!seen.has(key)) {
        seen.add(key);
        const label = KNOWN_LABELS[key] ?? key.toUpperCase();
        opts.push({ code: key, label: `${label} (${key})` });
      }
    }

    return opts;
  }, [restaurant.translations]);

  const handleSave = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const updates: Record<string, string> = {};
      if (form.name !== restaurant.name) updates.name = form.name;
      if (form.slug !== restaurant.slug) updates.slug = form.slug;
      if (form.currency !== restaurant.currency)
        updates.currency = form.currency;
      if (form.default_locale !== (restaurant.default_locale ?? "he"))
        updates.default_locale = form.default_locale;

      const res = await patchRestaurant(restaurant.slug, updates);
      setFeedback({ type: "success", msg: "Saved." });
      onSave({
        ...restaurant,
        ...updates,
        slug: res.slug,
      });
      if (res.slug !== restaurant.slug) {
        router.replace(`/superadmin/restaurants/${res.slug}`);
      }
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Save failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert
          variant={feedback.type}
          onDismiss={() => setFeedback(null)}
        >
          {feedback.msg}
        </Alert>
      )}
      <Card title="Restaurant Info">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              className={inputCls}
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value }))
              }
            />
          </Field>
          <Field label="Slug">
            <input
              className={inputCls}
              value={form.slug}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  slug: e.target.value.toLowerCase().replace(/\s+/g, "-"),
                }))
              }
            />
          </Field>
          <Field label="Currency">
            <select
              className={inputCls}
              value={form.currency}
              onChange={(e) =>
                setForm((f) => ({ ...f, currency: e.target.value }))
              }
            >
              <option value="ILS">&#8362; Shekel (ILS)</option>
              <option value="USD">$ Dollar (USD)</option>
              <option value="EUR">&#8364; Euro (EUR)</option>
            </select>
          </Field>
          <Field label="Default locale">
            <select
              className={inputCls}
              value={form.default_locale}
              onChange={(e) =>
                setForm((f) => ({ ...f, default_locale: e.target.value }))
              }
            >
              {localeOptions.map((loc) => (
                <option key={loc.code} value={loc.code}>
                  {loc.label}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className={btnPrimary}
            disabled={!dirty || busy}
            onClick={handleSave}
          >
            <Save className="h-4 w-4" />
            {busy ? "Saving..." : "Save changes"}
          </button>
        </div>
      </Card>

      <Card title="Quick Info">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs text-zinc-500">ID</dt>
            <dd className="font-mono text-zinc-700">{restaurant.id}</dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Created</dt>
            <dd className="text-zinc-700">
              {restaurant.created_at
                ? new Date(restaurant.created_at).toLocaleDateString()
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-zinc-500">Banner image</dt>
            <dd className="text-zinc-700">
              {restaurant.banner_image_url ? (
                <a
                  href={restaurant.banner_image_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  View
                </a>
              ) : (
                "None"
              )}
            </dd>
          </div>
        </dl>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Members section
// ---------------------------------------------------------------------------

function MembersSection({
  slug,
  members: initialMembers,
}: {
  slug: string;
  members: RestaurantMember[];
}) {
  const [members, setMembers] = useState(initialMembers);
  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState("owner");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    msg: string;
  } | null>(null);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    setBusy(true);
    setFeedback(null);
    try {
      const res = await addRestaurantMember(slug, addEmail.trim(), addRole);
      setMembers((prev) => [...prev, res.member]);
      setAddEmail("");
      setAddOpen(false);
      setFeedback({ type: "success", msg: "Member added." });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed to add member.",
      });
    } finally {
      setBusy(false);
    }
  };

  const handleRoleChange = async (userId: string, role: string) => {
    try {
      await updateMemberRole(slug, userId, role);
      setMembers((prev) =>
        prev.map((m) => (m.user_id === userId ? { ...m, role } : m)),
      );
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Role update failed.",
      });
    }
  };

  const handleRemove = async (userId: string) => {
    if (!confirm("Remove this member?")) return;
    try {
      await removeMember(slug, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
      setFeedback({ type: "success", msg: "Member removed." });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Remove failed.",
      });
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert variant={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-900">
            Members ({members.length})
          </h3>
          <button
            type="button"
            className={btnSecondary}
            onClick={() => setAddOpen(!addOpen)}
          >
            <UserPlus className="h-4 w-4" />
            Add
          </button>
        </div>

        {addOpen && (
          <div className="mb-4 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <Field label="Email">
                <input
                  className={inputCls}
                  type="email"
                  placeholder="user@example.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                />
              </Field>
              <Field label="Role">
                <select
                  className={inputCls}
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value)}
                >
                  <option value="owner">Owner</option>
                  <option value="admin">Admin</option>
                  <option value="member">Member</option>
                </select>
              </Field>
              <button
                type="button"
                className={btnPrimary}
                disabled={busy || !addEmail.trim()}
                onClick={handleAdd}
              >
                {busy ? "Adding..." : "Add member"}
              </button>
            </div>
          </div>
        )}

        {members.length === 0 ? (
          <p className="py-6 text-center text-sm text-zinc-400">
            No members yet.
          </p>
        ) : (
          <div className="divide-y divide-zinc-100">
            {members.map((m) => (
              <div
                key={m.user_id}
                className="flex items-center gap-3 py-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-zinc-900">
                    {m.email ?? "Unknown"}
                  </p>
                  <p className="truncate font-mono text-xs text-zinc-400">
                    {m.user_id}
                  </p>
                </div>
                <select
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                  value={m.role}
                  onChange={(e) =>
                    handleRoleChange(m.user_id, e.target.value)
                  }
                >
                  <option value="owner">owner</option>
                  <option value="admin">admin</option>
                  <option value="member">member</option>
                </select>
                <button
                  type="button"
                  onClick={() => handleRemove(m.user_id)}
                  className="p-1.5 text-zinc-400 transition hover:text-red-600"
                  title="Remove member"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subscription section
// ---------------------------------------------------------------------------

function SubscriptionSection({
  slug,
  subscription: initial,
}: {
  slug: string;
  subscription: RestaurantSubscription;
}) {
  const [tier, setTier] = useState(initial.plan_tier);
  const [subStatus, setSubStatus] = useState(
    initial.status === "none" ? "active" : initial.status,
  );
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    msg: string;
  } | null>(null);

  const dirty = tier !== initial.plan_tier || subStatus !== initial.status;

  const handleSave = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      await updateSubscription(slug, tier, subStatus);
      setFeedback({ type: "success", msg: "Subscription updated." });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Update failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert variant={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}
      <Card title="Subscription">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Plan tier">
            <select
              className={inputCls}
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              {PLAN_TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Status">
            <select
              className={inputCls}
              value={subStatus}
              onChange={(e) => setSubStatus(e.target.value)}
            >
              <option value="active">active</option>
              <option value="inactive">inactive</option>
            </select>
          </Field>
        </div>
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            className={btnPrimary}
            disabled={!dirty || busy}
            onClick={handleSave}
          >
            <Save className="h-4 w-4" />
            {busy ? "Saving..." : "Update subscription"}
          </button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menus section
// ---------------------------------------------------------------------------

function MenusSection({
  slug,
  menus,
}: {
  slug: string;
  menus: RestaurantMenu[];
}) {
  return (
    <Card title={`Menus (${menus.length})`}>
      {menus.length === 0 ? (
        <p className="py-6 text-center text-sm text-zinc-400">
          No menus yet.
        </p>
      ) : (
        <div className="divide-y divide-zinc-100">
          {menus.map((m) => (
            <div
              key={m.id}
              className="flex items-center gap-3 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <p className="font-medium text-zinc-900">{m.name}</p>
                <p className="text-xs text-zinc-400">
                  {m.item_count} item{m.item_count !== 1 ? "s" : ""}
                </p>
              </div>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  m.is_active
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-zinc-100 text-zinc-500"
                }`}
              >
                {m.is_active ? "Active" : "Inactive"}
              </span>
              <a
                href={`/${slug}/admin`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-600"
                title="Open admin editor"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Danger zone
// ---------------------------------------------------------------------------

function DangerSection({
  restaurant,
  onToggle,
}: {
  restaurant: RestaurantDetail;
  onToggle: (active: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: "error" | "success";
    msg: string;
  } | null>(null);

  const handleToggle = async () => {
    const next = !restaurant.is_active;
    const verb = next ? "reactivate" : "deactivate";
    if (!confirm(`Are you sure you want to ${verb} "${restaurant.name}"?`))
      return;

    setBusy(true);
    setFeedback(null);
    try {
      await patchRestaurant(restaurant.slug, { is_active: next });
      onToggle(next);
      setFeedback({
        type: "success",
        msg: `Restaurant ${next ? "reactivated" : "deactivated"}.`,
      });
    } catch (err) {
      setFeedback({
        type: "error",
        msg: err instanceof Error ? err.message : "Failed.",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {feedback && (
        <Alert variant={feedback.type} onDismiss={() => setFeedback(null)}>
          {feedback.msg}
        </Alert>
      )}
      <div className="rounded-2xl border-2 border-red-200 bg-white p-4 sm:p-5">
        <h3 className="mb-2 text-sm font-semibold text-red-700">
          Danger Zone
        </h3>
        <p className="mb-4 text-sm text-zinc-600">
          {restaurant.is_active
            ? "Deactivating will hide this restaurant from diners. It can be reactivated later."
            : "This restaurant is currently inactive. Reactivating will make it visible to diners again."}
        </p>
        <button
          type="button"
          className={restaurant.is_active ? btnDanger : btnPrimary}
          disabled={busy}
          onClick={handleToggle}
        >
          {busy
            ? "Processing..."
            : restaurant.is_active
              ? "Deactivate restaurant"
              : "Reactivate restaurant"}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function SuperadminRestaurantDetailPage() {
  const params = useParams();
  const slug = String(params?.slug ?? "");

  const [restaurant, setRestaurant] = useState<RestaurantDetail | null>(null);
  const [members, setMembers] = useState<RestaurantMember[]>([]);
  const [subscription, setSubscription] = useState<RestaurantSubscription>({
    plan_tier: "free",
    status: "none",
  });
  const [menus, setMenus] = useState<RestaurantMenu[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const load = useCallback(async () => {
    if (!slug) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchRestaurantDetail(slug);
      setRestaurant(data.restaurant);
      setMembers(data.members);
      setSubscription(data.subscription);
      setMenus(data.menus);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load restaurant.",
      );
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
        <p className="text-sm text-zinc-400">Loading...</p>
      </main>
    );
  }

  if (error || !restaurant) {
    return (
      <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
        <Link
          href="/superadmin/restaurants"
          className="mb-4 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        <Alert variant="error">{error ?? "Restaurant not found."}</Alert>
      </main>
    );
  }

  return (
    <main className="px-4 py-5 sm:px-6 sm:py-6 md:py-8">
      {/* Header */}
      <div className="mb-5">
        <Link
          href="/superadmin/restaurants"
          className="mb-3 inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to list
        </Link>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-bold text-zinc-900 sm:text-2xl">
              {restaurant.name || restaurant.slug}
            </h1>
            <p className="mt-0.5 flex items-center gap-2 text-sm text-zinc-500">
              <span>{restaurant.slug}</span>
              <a
                href={`/${restaurant.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-600"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
              <span
                className={`inline-block h-2 w-2 rounded-full ${restaurant.is_active ? "bg-emerald-500" : "bg-zinc-300"}`}
              />
              <span className="text-xs">
                {restaurant.is_active ? "Active" : "Inactive"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-5 overflow-x-auto">
        <div className="flex gap-1 rounded-xl border border-zinc-200 bg-zinc-100 p-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setActiveTab(t.key)}
              className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                activeTab === t.key
                  ? "bg-white text-zinc-900 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <OverviewSection
          restaurant={restaurant}
          onSave={(r) => setRestaurant(r)}
        />
      )}
      {activeTab === "members" && (
        <MembersSection slug={restaurant.slug} members={members} />
      )}
      {activeTab === "subscription" && (
        <SubscriptionSection
          slug={restaurant.slug}
          subscription={subscription}
        />
      )}
      {activeTab === "menus" && (
        <MenusSection slug={restaurant.slug} menus={menus} />
      )}
      {activeTab === "danger" && (
        <DangerSection
          restaurant={restaurant}
          onToggle={(active) =>
            setRestaurant((prev) => (prev ? { ...prev, is_active: active } : prev))
          }
        />
      )}
    </main>
  );
}
