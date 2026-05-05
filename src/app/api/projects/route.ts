import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireAdmin, requireSession } from "@/lib/rbac";
import { createProjectSchema } from "@/lib/validation/project";
import { logActivity } from "@/lib/activity";
import { ActivityAction, ActivityEntity } from "@prisma/client";
import { parseCursorParams } from "@/lib/pagination";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { user } = guard.session;
    const { cursor, take } = parseCursorParams(req.url);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q")?.trim();

    const whereBase =
      user.role === "ADMIN"
        ? {}
        : {
            OR: [
              { createdById: user.id },
              { members: { some: { userId: user.id } } },
            ],
          };

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
    };

    const projects = await prisma.project.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
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

    const nextCursor = projects.length > take ? projects[take]?.id ?? null : null;
    const items = projects.slice(0, take);

    return NextResponse.json({ projects: items, nextCursor });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const guard = await requireAdmin();
    if (isGuardFailure(guard)) return guard;

    const payload = createProjectSchema.safeParse(await req.json());
    if (!payload.success) {
      return NextResponse.json(
        { error: "Invalid payload", issues: payload.error.flatten() },
        { status: 400 }
      );
    }

    const project = await prisma.project.create({
      data: {
        title: payload.data.title,
        description: payload.data.description,
        createdById: guard.session.user.id,
        members: {
          create: [{ userId: guard.session.user.id }],
        },
      },
      select: {
        id: true,
        title: true,
        description: true,
        createdById: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logActivity({
      entity: ActivityEntity.PROJECT,
      action: ActivityAction.CREATED,
      projectId: project.id,
      actorId: guard.session.user.id,
      message: `Project created: ${project.title}`,
    });

    return NextResponse.json({ project }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
