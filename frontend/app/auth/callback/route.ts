import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClientWithRequest } from "../../../utils/supabase/server";

function normalizeNextPath(nextParam: string | null): string {
  if (!nextParam || !nextParam.startsWith("/")) {
    return "/";
  }
  return nextParam;
}

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = normalizeNextPath(requestUrl.searchParams.get("next"));
  const redirectResponse = NextResponse.redirect(new URL(nextPath, requestUrl.origin));
  const { supabase, getResponse } = createServerClientWithRequest(
    request,
    redirectResponse,
  );

  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  return getResponse();
}

