"use client";

import { useState } from "react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";
import { submitLead } from "@/lib/marketingApi";

type LeadCaptureFormProps = {
  locale: LandingLocale;
};

export function LeadCaptureForm({ locale }: LeadCaptureFormProps) {
  const t = landingCopy[locale];
  const [name, setName] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitLead({
        name: name.trim(),
        restaurant: restaurant.trim(),
        email: email.trim(),
        phone: phone.trim() || undefined,
        locale,
      });
      setDone(true);
    } catch (submitError) {
      const message =
        submitError instanceof Error && submitError.message
          ? submitError.message
          : t.leadError;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="text-center font-sans text-sm text-fresh-green" role="status">
        {t.leadThanks}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-xs font-medium text-warm-brown">{t.leadName}</span>
        <input
          required
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={submitting}
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-espresso/40 disabled:opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-xs font-medium text-warm-brown">{t.leadRestaurant}</span>
        <input
          required
          name="restaurant"
          autoComplete="organization"
          value={restaurant}
          onChange={(e) => setRestaurant(e.target.value)}
          disabled={submitting}
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-espresso/40 disabled:opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-xs font-medium text-warm-brown">{t.leadEmail}</span>
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-espresso/40 disabled:opacity-60"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-xs font-medium text-warm-brown">{t.leadPhone}</span>
        <input
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          disabled={submitting}
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-espresso/40 disabled:opacity-60"
        />
      </label>
      {error ? (
        <p className="text-sm leading-snug text-terracotta" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="mt-1 w-full bg-fresh-green py-3 text-sm font-semibold tracking-tight text-kraft transition hover:bg-fresh-green/90 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-70"
      >
        {submitting ? t.leadSubmitting : t.leadSubmit}
      </button>
    </form>
  );
}
