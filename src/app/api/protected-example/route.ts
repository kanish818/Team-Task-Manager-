import { NextResponse } from "next/server";
import { isGuardFailure, requireAdmin, requireSession } from "@/lib/rbac";

export async function GET() {
  const guard = await requireSession();
  if (isGuardFailure(guard)) return guard;

  return NextResponse.json({ ok: true, user: guard.session.user });
}

export async function POST() {
  const guard = await requireAdmin();
  if (isGuardFailure(guard)) return guard;

  return NextResponse.json({ ok: true });
}