import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireAdmin, requireSession } from "@/lib/rbac";
import { updateProjectSchema } from "@/lib/validation/project";
import { logActivity } from "@/lib/activity";
import { ActivityAction, ActivityEntity } from "@prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_req: Request, context: RouteContext) {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { id } = await context.params;
    const { user } = guard.session;

    const project = await prisma.project.findFirst({
      where:
        user.role === "ADMIN"
          ? { id }
          : {
              id,
              OR: [
                { createdById: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
      select: {
        id: true,
        title: true,
        description: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
        members: {
          select: {
            id: true,
            userId: true,
            createdAt: true,
          },
        },
      },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const { id } = await context.params;

    const payload = updateProjectSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: payload.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.project.updateMany({
      where: { id },
      data: payload.data,
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const project = await prisma.project.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        description: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (project) {
      await logActivity({
        entity: ActivityEntity.PROJECT,
        action: ActivityAction.UPDATED,
        projectId: project.id,
        actorId: guard.session.user.id,
        message: `Project updated: ${project.title}`,
        metadata: { fields: Object.keys(payload.data) },
      });
    }

    return NextResponse.json({ project });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const { id } = await context.params;

    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logActivity({
      entity: ActivityEntity.PROJECT,
      action: ActivityAction.DELETED,
      projectId: project.id,
      actorId: guard.session.user.id,
      message: `Project deleted: ${project.title}`,
    });

    await prisma.project.deleteMany({
      where: { id: project.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
