import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireSession } from "@/lib/rbac";

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
    const { id: projectId } = await context.params;
    const { cursor, take } = parseCursorParams(req.url);

    const project = await prisma.project.findFirst({
      where:
        user.role === "ADMIN"
          ? { id: projectId }
          : {
              id: projectId,
              OR: [
                { createdById: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
      select: { id: true },
    });

    if (!project) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const logs = await prisma.activityLog.findMany({
      where: { projectId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        entity: true,
        action: true,
        message: true,
        metadata: true,
        createdAt: true,
        actor: { select: { id: true, name: true, email: true } },
        taskId: true,
      },
    });

    const nextCursor = logs.length > take ? logs[take]?.id ?? null : null;
    const items = logs.slice(0, take);

    return NextResponse.json({ logs: items, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
