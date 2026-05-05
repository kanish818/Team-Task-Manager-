import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isGuardFailure, requireSession } from "@/lib/rbac";

export const dynamic = "force-dynamic";

function buildTaskWhere(projectIds: string[] | null) {
  if (!projectIds) return {};
  if (projectIds.length === 0) return { projectId: "__none__" };
  return { projectId: { in: projectIds } };
}

export async function GET() {
  try {
    const guard = await requireSession();
    if (isGuardFailure(guard)) return guard;

    const { user } = guard.session;
    const now = new Date();

    const accessibleProjects = await prisma.project.findMany({
      where:
        user.role === "ADMIN"
          ? {}
          : {
              OR: [
                { createdById: user.id },
                { members: { some: { userId: user.id } } },
              ],
            },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    });

    const projectIds = user.role === "ADMIN" ? null : accessibleProjects.map((p) => p.id);
    const projectWhere = buildTaskWhere(projectIds);

    const [
      totalTasks,
      completedTasks,
      inProgressTasks,
      pendingTasks,
      overdueTasks,
      userTasks,
      tasksByProject,
      completedByProject,
    ] = await prisma.$transaction([
      prisma.task.count({ where: projectWhere }),
      prisma.task.count({ where: { ...projectWhere, status: "COMPLETED" } }),
      prisma.task.count({ where: { ...projectWhere, status: "IN_PROGRESS" } }),
      prisma.task.count({ where: { ...projectWhere, status: "TODO" } }),
      prisma.task.count({
        where: {
          ...projectWhere,
          status: { not: "COMPLETED" },
          dueDate: { not: null, lt: now },
        },
      }),
      prisma.task.count({ where: { assignedToId: user.id } }),
      prisma.task.groupBy({
        by: ["projectId"],
        where: projectWhere,
        _count: { _all: true },
        orderBy: { projectId: "asc" },
      }),
      prisma.task.groupBy({
        by: ["projectId"],
        where: { ...projectWhere, status: "COMPLETED" },
        _count: { _all: true },
        orderBy: { projectId: "asc" },
      }),
    ]);

    type TasksByProjectRow = { projectId: string; _count: { _all: number } };

    const completedMap = new Map(
      (completedByProject as TasksByProjectRow[]).map((row) => [row.projectId, row._count._all])
    );

    const progress = (tasksByProject as TasksByProjectRow[]).map((row) => {
      const completed = completedMap.get(row.projectId) ?? 0;
      const total = row._count._all;
      const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
      return {
        projectId: row.projectId,
        totalTasks: total,
        completedTasks: completed,
        progressPercent: percent,
      };
    });

    const projectCompletion = accessibleProjects.map((project) => {
      const stats = progress.find((row) => row.projectId === project.id);
      return {
        projectId: project.id,
        title: project.title,
        totalTasks: stats?.totalTasks ?? 0,
        completedTasks: stats?.completedTasks ?? 0,
        progressPercent: stats?.progressPercent ?? 0,
      };
    });

    return NextResponse.json({
      totals: {
        totalTasks,
        completedTasks,
        inProgressTasks,
        pendingTasks,
        overdueTasks,
        userTasks,
      },
      projectCompletion,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
