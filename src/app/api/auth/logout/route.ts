import { NextResponse } from "next/server";
import { getSessionCookieName, isSecureCookie } from "@/lib/auth";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), "", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecureCookie(),
    maxAge: 0,
  });
  return response;
}
