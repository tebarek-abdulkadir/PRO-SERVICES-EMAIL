import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCookieSecret, verifyToken } from "@/lib/dashboard-auth";

/** Paths that authenticate with INGEST_API_KEY inside route handlers — must bypass dashboard gate when key matches. */
function isIngestApiKeyRoute(pathname: string): boolean {
  if (pathname.startsWith("/api/ingest/")) return true;
  if (pathname === "/api/chat-analysis" || pathname.startsWith("/api/chat-analysis/"))
    return true;
  if (/^\/api\/dates\/[^/]+\/delete$/.test(pathname)) return true;
  return false;
}

export async function middleware(request: NextRequest) {
  const password = process.env.DASHBOARD_PASSWORD;
  const cronSecret = process.env.CRON_SECRET;
  const ingestApiKey = process.env.INGEST_API_KEY;
  if (!password) {
    return NextResponse.next();
  }

  const path = request.nextUrl.pathname;
  const token = request.cookies.get("dashboard_session")?.value;
  const authorization = request.headers.get("authorization");
  const bearerToken = authorization?.startsWith("Bearer ")
    ? authorization.slice(7)
    : authorization;
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
    path === "/api/auth/status" ||
    path === "/api/cron/daily-email"
  ) {
    return NextResponse.next();
  }

  if (
    path.startsWith("/api/") &&
    cronSecret &&
    (request.headers.get("x-internal-cron-secret") === cronSecret ||
      bearerToken === cronSecret)
  ) {
    return NextResponse.next();
  }

  if (
    path.startsWith("/api/") &&
    ingestApiKey &&
    isIngestApiKeyRoute(path) &&
    bearerToken === ingestApiKey
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
