import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireSession } from "@/lib/rbac";
import { createCommentSchema } from "@/lib/validation/comment";
import { extractMentionIds } from "@/lib/mentions";
import { logActivity } from "@/lib/activity";
import { ActivityAction, ActivityEntity } from "@prisma/client";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string }> };

type CursorParams = {
  cursor?: string;
  take: number;
};

function parseCursorParams(url: string): CursorParams {
  const { searchParams } = new URL(url);
  const cursor = searchParams.get("cursor") ?? undefined;
  const takeParam = searchParams.get("take");
  const take = takeParam ? Number(takeParam) : 20;
  return { cursor, take: Number.isNaN(take) ? 20 : Math.min(Math.max(take, 1), 50) };
}

export async function GET(req: Request, context: RouteContext) {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { user } = guard.session;
    const { id: taskId } = await context.params;
    const { cursor, take } = parseCursorParams(req.url);

    const task = await prisma.task.findFirst({
      where:
        user.role === "ADMIN"
          ? { id: taskId }
          : {
              id: taskId,
              OR: [
                { assignedToId: user.id },
                { project: { members: { some: { userId: user.id } } } },
              ],
            },
      select: { id: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const comments = await prisma.taskComment.findMany({
      where: { taskId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        body: true,
        mentionedUserIds: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });

    const nextCursor = comments.length > take ? comments[take]?.id ?? null : null;
    const items = comments.slice(0, take);

    return NextResponse.json({ comments: items, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request, context: RouteContext) {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { user } = guard.session;
    const { id: taskId } = await context.params;

    const task = await prisma.task.findFirst({
      where:
        user.role === "ADMIN"
          ? { id: taskId }
          : {
              id: taskId,
              OR: [
                { assignedToId: user.id },
                { project: { members: { some: { userId: user.id } } } },
              ],
            },
      select: { id: true, projectId: true },
    });

    if (!task) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const payload = createCommentSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: payload.error.flatten() },
        { status: 400 }
      );
    }

    const mentionedIds = extractMentionIds(payload.data.body);
    if (mentionedIds.length > 0) {
      const existing = await prisma.user.findMany({
        where: { id: { in: mentionedIds } },
        select: { id: true },
      });
      const existingIds = new Set(existing.map((row) => row.id));
      const invalid = mentionedIds.filter((id) => !existingIds.has(id));
      if (invalid.length > 0) {
        return NextResponse.json(
          { error: "Unknown mention userId", invalid },
          { status: 400 }
        );
      }
    }

    const comment = await prisma.taskComment.create({
      data: {
        taskId: task.id,
        authorId: user.id,
        body: payload.data.body,
        mentionedUserIds: mentionedIds,
      },
      select: {
        id: true,
        body: true,
        mentionedUserIds: true,
        createdAt: true,
        author: { select: { id: true, name: true, email: true } },
      },
    });

    await logActivity({
      entity: ActivityEntity.COMMENT,
      action: ActivityAction.COMMENT_ADDED,
      projectId: task.projectId,
      taskId: task.id,
      actorId: user.id,
      message: `Comment added on task ${task.id}`,
      metadata: { commentId: comment.id },
    });

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
