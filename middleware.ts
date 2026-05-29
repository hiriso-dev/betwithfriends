import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/forgot-password", "/reset-password", "/api"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  if (isPublic) return NextResponse.next();

  const token = request.cookies.get("bwf_token")?.value;
  if (!token) {
    const loginUrl = new URL("/login", request.url);
    const next = pathname + request.nextUrl.search;
    if (next !== "/") loginUrl.searchParams.set("next", next);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico|icons|manifest.webmanifest|sw.js|.*\\.png$|.*\\.svg$|.*\\.ico$|.*\\.webmanifest$|.*\\.js$).*)"],
};