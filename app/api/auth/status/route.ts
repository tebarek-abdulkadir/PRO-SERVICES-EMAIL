import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    passwordProtection: Boolean(process.env.DASHBOARD_PASSWORD),
  });
}
