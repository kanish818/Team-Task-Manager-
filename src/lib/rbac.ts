import { getServerSession } from "next-auth";
import type { Session } from "next-auth";
import { NextResponse } from "next/server";
import { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";

/** Augmented in `src/types/next-auth.d.ts` (includes `user.id` and `user.role`). */
export type AuthSession = Session;

export type GuardResult = { session: AuthSession } | NextResponse;

export function isGuardFailure(result: GuardResult): result is NextResponse {
  return result instanceof NextResponse;
}

export async function requireSession(): Promise<GuardResult> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  return { session };
}

export async function requireRole(role: Role): Promise<GuardResult> {
  const result = await requireSession();
  if (isGuardFailure(result)) return result;

  if (result.session.user.role !== role) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return result;
}

export async function requireAdmin(): Promise<GuardResult> {
  return requireRole(Role.ADMIN);
}
