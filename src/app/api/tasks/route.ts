import { NextResponse } from "next/server";
import { ActivityAction, ActivityEntity, Priority, TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireAdmin, requireSession } from "@/lib/rbac";
import { createTaskSchema } from "@/lib/validation/task";
import { logActivity } from "@/lib/activity";
import { parseCursorParams } from "@/lib/pagination";

const taskStatusValues = new Set<string>(Object.values(TaskStatus));
const priorityValues = new Set<string>(Object.values(Priority));

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { user } = guard.session;
    const { cursor, take } = parseCursorParams(req.url);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();
    const status = searchParams.get("status") ?? undefined;
    const priority = searchParams.get("priority") ?? undefined;
    const projectId = searchParams.get("projectId") ?? undefined;
    const assignedToId = searchParams.get("assignedToId") ?? undefined;
    const overdue = searchParams.get("overdue") === "true";
    const now = new Date();

    const whereBase = user.role === "ADMIN" ? {} : { assignedToId: user.id };

    const where = {
      ...whereBase,
      ...(query
        ? {
            OR: [
              { title: { contains: query, mode: "insensitive" as const } },
              { description: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(status && taskStatusValues.has(status) ? { status: status as TaskStatus } : {}),
      ...(priority && priorityValues.has(priority) ? { priority: priority as Priority } : {}),
      ...(projectId ? { projectId } : {}),
      ...(user.role === "ADMIN" && assignedToId ? { assignedToId } : {}),
      ...(overdue
        ? {
            dueDate: { not: null, lt: now },
            status: { not: TaskStatus.COMPLETED },
          }
        : {}),
    };

    const tasks = await prisma.task.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

    const nextCursor = tasks.length > take ? tasks[take]?.id ?? null : null;
    const items = tasks.slice(0, take);

    return NextResponse.json({ tasks: items, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const payload = createTaskSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: payload.error.flatten() },
        { status: 400 }
      );
    }

    const project = await prisma.project.findUnique({
      where: { id: payload.data.projectId },
      select: { id: true },
    });
    if (!project) {
      return NextResponse.json({ error: "Project not found" }, { status: 404 });
    }

    if (payload.data.assignedToId) {
      const user = await prisma.user.findUnique({
        where: { id: payload.data.assignedToId },
        select: { id: true },
      });
      if (!user) {
        return NextResponse.json({ error: "Assignee not found" }, { status: 404 });
      }

      const existingMembership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: payload.data.projectId,
            userId: payload.data.assignedToId,
          },
        },
        select: { id: true },
      });

      await prisma.projectMember.upsert({
        where: {
          projectId_userId: {
            projectId: payload.data.projectId,
            userId: payload.data.assignedToId,
          },
        },
        create: {
          projectId: payload.data.projectId,
          userId: payload.data.assignedToId,
        },
        update: {},
      });

      if (!existingMembership) {
        await logActivity({
          entity: ActivityEntity.MEMBER,
          action: ActivityAction.MEMBER_ADDED,
          projectId: payload.data.projectId,
          actorId: guard.session.user.id,
          message: `Member added to project (task assign): ${payload.data.assignedToId}`,
          metadata: { userId: payload.data.assignedToId, autoEnrolled: true },
        });
      }
    }

    const task = await prisma.task.create({
      data: {
        title: payload.data.title,
        description: payload.data.description,
        status: payload.data.status,
        priority: payload.data.priority,
        dueDate: payload.data.dueDate,
        projectId: payload.data.projectId,
        assignedToId: payload.data.assignedToId,
        createdById: guard.session.user.id,
      },
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
      entity: "TASK",
      action: "CREATED",
      projectId: task.projectId,
      taskId: task.id,
      actorId: guard.session.user.id,
      message: `Task created: ${task.title}`,
    });

    if (task.assignedToId) {
      await logActivity({
        entity: "TASK",
        action: "ASSIGNED",
        projectId: task.projectId,
        taskId: task.id,
        actorId: guard.session.user.id,
        message: `Task assigned to ${task.assignedToId}`,
        metadata: { assignedToId: task.assignedToId },
      });
    }

    return NextResponse.json({ task }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
