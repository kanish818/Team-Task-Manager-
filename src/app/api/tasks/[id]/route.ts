import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireAdmin, requireSession } from "@/lib/rbac";
import { adminUpdateTaskSchema, memberUpdateStatusSchema } from "@/lib/validation/task";
import { logActivity } from "@/lib/activity";
import { ActivityAction, ActivityEntity } from "@prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, context: RouteContext) {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { id: taskId } = await context.params;
    const { user } = guard.session;

    if (user.role === "ADMIN") {
      const payload = adminUpdateTaskSchema.safeParse(await req.json());
      if (!payload.success) {
        return NextResponse.json(
          { error: "Invalid payload", issues: payload.error.flatten() },
          { status: 400 }
        );
      }

      const existing = await prisma.task.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          projectId: true,
          title: true,
          status: true,
          priority: true,
          assignedToId: true,
        },
      });

      if (!existing) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }

      if (typeof payload.data.assignedToId === "string") {
        const assignee = await prisma.user.findUnique({
          where: { id: payload.data.assignedToId },
          select: { id: true },
        });
        if (!assignee) {
          return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
        }

        const existingMembership = await prisma.projectMember.findUnique({
          where: {
            projectId_userId: {
              projectId: existing.projectId,
              userId: payload.data.assignedToId,
            },
          },
          select: { id: true },
        });

        await prisma.projectMember.upsert({
          where: {
            projectId_userId: {
              projectId: existing.projectId,
              userId: payload.data.assignedToId,
            },
          },
          create: {
            projectId: existing.projectId,
            userId: payload.data.assignedToId,
          },
          update: {},
        });

        if (!existingMembership) {
          await logActivity({
            entity: ActivityEntity.MEMBER,
            action: ActivityAction.MEMBER_ADDED,
            projectId: existing.projectId,
            actorId: guard.session.user.id,
            message: `Member added to project (task assign): ${payload.data.assignedToId}`,
            metadata: { userId: payload.data.assignedToId, autoEnrolled: true },
          });
        }
      }

      const task = await prisma.task.update({
        where: { id: taskId },
        data: payload.data,
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          priority: true,
          dueDate: true,
          assignedToId: true,
          projectId: true,
          createdById: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      await logActivity({
        entity: ActivityEntity.TASK,
        action: ActivityAction.UPDATED,
        projectId: task.projectId,
        taskId: task.id,
        actorId: guard.session.user.id,
        message: `Task updated: ${task.title}`,
        metadata: { fields: Object.keys(payload.data) },
      });

      if (existing.status !== task.status) {
        await logActivity({
          entity: ActivityEntity.TASK,
          action: ActivityAction.STATUS_CHANGED,
          projectId: task.projectId,
          taskId: task.id,
          actorId: guard.session.user.id,
          message: `Task status changed to ${task.status}`,
          metadata: { from: existing.status, to: task.status },
        });
      }

      if (existing.priority !== task.priority) {
        await logActivity({
          entity: ActivityEntity.TASK,
          action: ActivityAction.PRIORITY_CHANGED,
          projectId: task.projectId,
          taskId: task.id,
          actorId: guard.session.user.id,
          message: `Task priority changed to ${task.priority}`,
          metadata: { from: existing.priority, to: task.priority },
        });
      }

      if (existing.assignedToId !== task.assignedToId) {
        await logActivity({
          entity: ActivityEntity.TASK,
          action: ActivityAction.ASSIGNED,
          projectId: task.projectId,
          taskId: task.id,
          actorId: guard.session.user.id,
          message: `Task assigned to ${task.assignedToId ?? "unassigned"}`,
          metadata: { from: existing.assignedToId, to: task.assignedToId },
        });
      }

      return NextResponse.json({ task });
    }

    const payload = memberUpdateStatusSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: payload.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await prisma.task.updateMany({
      where: { id: taskId, assignedToId: user.id },
      data: { status: payload.data.status },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        priority: true,
        dueDate: true,
        assignedToId: true,
        projectId: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (task) {
      await logActivity({
        entity: ActivityEntity.TASK,
        action: ActivityAction.STATUS_CHANGED,
        projectId: task.projectId,
        taskId: task.id,
        actorId: user.id,
        message: `Task status changed to ${task.status}`,
        metadata: { to: task.status },
      });
    }

    return NextResponse.json({ task });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, context: RouteContext) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const { id: taskId } = await context.params;

    const task = await prisma.task.findUnique({
      where: { id: taskId },
      select: { id: true, title: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await logActivity({
      entity: ActivityEntity.TASK,
      action: ActivityAction.DELETED,
      projectId: task.projectId,
      taskId: task.id,
      actorId: guard.session.user.id,
      message: `Task deleted: ${task.title}`,
    });

    await prisma.task.deleteMany({
      where: { id: task.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
