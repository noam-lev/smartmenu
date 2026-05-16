import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClientWithRequest } from "./utils/supabase/server";

function isProtectedAdminRoute(pathname: string): boolean {
  return /^\/[^/]+\/admin(?:\/.*)?$/.test(pathname);
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  let supabaseBundle: ReturnType<typeof createServerClientWithRequest>;
  try {
    supabaseBundle = createServerClientWithRequest(request, response);
  } catch {
    return response;
  }
  const { supabase, getResponse } = supabaseBundle;

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isProtectedAdminRoute(request.nextUrl.pathname) && !user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  return getResponse();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};

