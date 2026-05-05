import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";

const publicPaths = new Set(["/", "/login", "/signup"]);
const adminOnlyPrefixes = ["/admin", "/api/admin"];

function isPublicPath(pathname: string) {
  return publicPaths.has(pathname) || pathname.startsWith("/api/auth");
}

function isAdminOnlyPath(pathname: string) {
  return adminOnlyPrefixes.some((prefix) => pathname.startsWith(prefix));
}

export default async function middleware(req: NextRequest) {
  const url = new URL(req.url);
  const { pathname } = url;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });
  if (!token) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }
    const signInUrl = new URL("/login", url.origin);
    signInUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(signInUrl);
  }

  if (isAdminOnlyPath(pathname) && token.role !== "ADMIN") {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return new NextResponse("Forbidden", { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
