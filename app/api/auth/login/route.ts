import { NextResponse } from "next/server";
import {
  getCookieSecret,
  passwordsMatch,
  signToken,
} from "@/lib/dashboard-auth";

const COOKIE_NAME = "dashboard_session";
const MAX_AGE_SEC = 60 * 60 * 24 * 30;

export async function POST(request: Request) {
  const configured = process.env.DASHBOARD_PASSWORD;
  if (!configured) {
    return NextResponse.json(
      { error: "Password protection is not configured" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    password?: unknown;
  };
  const input =
    typeof body.password === "string" ? body.password : "";

  if (!(await passwordsMatch(input, configured))) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  const secret = await getCookieSecret();
  const token = await signToken(secret);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return res;
}
