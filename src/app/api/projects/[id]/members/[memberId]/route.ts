import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireAdmin } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { ActivityAction, ActivityEntity } from "@prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; memberId: string }> };

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const { id: projectId, memberId } = await context.params;

    const deleted = await prisma.projectMember.deleteMany({
      where: {
        projectId,
        userId: memberId,
      },
    });

    if (deleted.count === 0) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    await logActivity({
      entity: ActivityEntity.MEMBER,
      action: ActivityAction.MEMBER_REMOVED,
      projectId,
      actorId: guard.session.user.id,
      message: `Member removed from project: ${memberId}`,
      metadata: { userId: memberId },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
