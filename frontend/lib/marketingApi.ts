import type { LandingLocale } from "@/components/marketing/landingDictionary";

import { API_BASE_URL } from "./apiBase";

export type LeadSubmissionPayload = {
  name: string;
  restaurant: string;
  email: string;
  phone?: string;
  locale: LandingLocale;
};

function readDetailFromBody(text: string): string {
  try {
    const parsed = JSON.parse(text) as { detail?: unknown };
    if (typeof parsed.detail === "string") {
      return parsed.detail;
    }
    if (parsed.detail !== undefined) {
      return JSON.stringify(parsed.detail);
    }
  } catch {
    /* ignore */
  }
  return text || "Request failed";
}

export async function submitLead(payload: LeadSubmissionPayload): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/api/marketing/leads`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const raw = await response.text();

  if (!response.ok) {
    throw new Error(readDetailFromBody(raw));
  }
}
