"use client";

import { useState } from "react";
import type { LandingLocale } from "./landingDictionary";
import { landingCopy } from "./landingDictionary";

type LeadCaptureFormProps = {
  locale: LandingLocale;
};

export function LeadCaptureForm({ locale }: LeadCaptureFormProps) {
  const t = landingCopy[locale];
  const [name, setName] = useState("");
  const [restaurant, setRestaurant] = useState("");
  const [phone, setPhone] = useState("");
  const [done, setDone] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setDone(true);
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
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-terracotta/50"
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
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-terracotta/50"
        />
      </label>
      <label className="flex flex-col gap-1.5 text-start">
        <span className="text-xs font-medium text-warm-brown">{t.leadPhone}</span>
        <input
          required
          name="phone"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="rounded-sm border border-ticket-rule bg-kraft py-2.5 ps-3 pe-3 text-sm text-espresso outline-none focus:border-terracotta/50"
        />
      </label>
      <button
        type="submit"
        className="mt-1 w-full border-b-4 border-[#8E1B1B] bg-terracotta py-3 font-sans text-sm font-semibold text-kraft transition active:translate-y-1"
      >
        {t.leadSubmit}
      </button>
    </form>
  );
}
