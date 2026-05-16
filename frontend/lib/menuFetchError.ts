import type { Locale } from "../types/menu";
import { getUiMessage } from "../utils/i18n";

export type MenuFetchErrorKind = "not_found" | "network" | "server";

type MenuFetchErrorParams = {
  kind: MenuFetchErrorKind;
  slug: string;
  url: string;
  message: string;
  status?: number;
  code?: string;
  detail?: string;
  cause?: unknown;
};

export class MenuFetchError extends Error {
  readonly kind: MenuFetchErrorKind;
  readonly slug: string;
  readonly url: string;
  readonly status?: number;
  readonly code?: string;
  readonly detail?: string;

  constructor(params: MenuFetchErrorParams) {
    super(params.message, { cause: params.cause });
    this.name = "MenuFetchError";
    this.kind = params.kind;
    this.slug = params.slug;
    this.url = params.url;
    this.status = params.status;
    this.code = params.code;
    this.detail = params.detail;
  }
}

export function logMenuFetchFailure(error: MenuFetchError): void {
  console.error("[menu] load failed", {
    slug: error.slug,
    kind: error.kind,
    status: error.status,
    code: error.code,
    detail: error.detail,
    url: error.url,
    message: error.message,
  });
}

export function getMenuLoadErrorMessage(error: unknown, locale: Locale): string {
  if (error instanceof MenuFetchError) {
    switch (error.kind) {
      case "not_found":
        return getUiMessage("menuNotFound", locale);
      case "network":
        return getUiMessage("menuNetworkError", locale);
      case "server":
        return getUiMessage("failedToLoadMenu", locale);
    }
  }

  return getUiMessage("failedToLoadMenu", locale);
}

type ApiErrorBody = {
  detail?: string;
  code?: string;
};

export async function parseApiErrorBody(response: Response): Promise<ApiErrorBody> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    return {
      detail: typeof body.detail === "string" ? body.detail : undefined,
      code: typeof body.code === "string" ? body.code : undefined,
    };
  } catch {
    return {};
  }
}
