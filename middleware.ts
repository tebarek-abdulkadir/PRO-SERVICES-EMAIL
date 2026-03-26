import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieSecret, verifyToken } from "@/lib/dashboard-auth";

export async function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const token = request.cookies.get("dashboard_session")?.value;
  const secret = await getCookieSecret();
  const isAuthed = !!(token && (await verifyToken(secret, token)));

  if (path === "/login" || path.startsWith("/login/")) {
    if (isAuthed) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return NextResponse.next();
  }

  if (
    path === "/api/auth/login" ||
    path === "/api/auth/logout" ||
    path === "/api/auth/status"
  ) {
    return NextResponse.next();
  }

  if (isAuthed) {
    return NextResponse.next();
  }

  if (path.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", path);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
