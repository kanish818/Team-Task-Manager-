import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireAdmin } from "@/lib/rbac";
import { addMemberSchema } from "@/lib/validation/member";
import { logActivity } from "@/lib/activity";
import { ActivityAction, ActivityEntity } from "@prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(req: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const { id: projectId } = await context.params;

    const payload = addMemberSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: payload.error.flatten() },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.data.userId },
      select: { id: true },
    });
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const existing = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: payload.data.userId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "User already a member" }, { status: 409 });
    }

    const member = await prisma.projectMember.create({
      data: {
        projectId,
        userId: payload.data.userId,
      },
      select: {
        id: true,
        projectId: true,
        userId: true,
        createdAt: true,
      },
    });

    await logActivity({
      entity: ActivityEntity.MEMBER,
      action: ActivityAction.MEMBER_ADDED,
      projectId,
      actorId: guard.session.user.id,
      message: `Member added to project: ${payload.data.userId}`,
      metadata: { userId: payload.data.userId },
    });

    return NextResponse.json({ member }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
