import { Router } from "express";
import { z } from "zod";
import { Role, TaskPriority, TaskStatus } from "../domain.js";
import { prisma } from "../lib/prisma.js";
import {
  requireAuth,
  requireProjectAdmin,
  requireProjectMembership,
} from "../middleware/auth.js";
import { asyncHandler, HttpError } from "../utils/http.js";

const router = Router();

const projectSchema = z.object({
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(500).optional().or(z.literal("")),
});

const memberSchema = z.object({
  email: z.email().transform((value) => value.toLowerCase()),
  role: z.enum(Role).default(Role.MEMBER),
});

const updateMemberSchema = z.object({
  role: z.enum(Role),
});

const taskCreateSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  assignedToId: z.string().cuid().optional().nullable(),
  dueDate: z.iso.datetime().optional().nullable(),
  priority: z.enum(TaskPriority).default(TaskPriority.MEDIUM),
});

const taskUpdateSchema = z.object({
  title: z.string().trim().min(2).max(160).optional(),
  description: z.string().trim().max(1000).optional().or(z.literal("")),
  assignedToId: z.string().cuid().optional().nullable(),
  dueDate: z.iso.datetime().optional().nullable(),
  priority: z.enum(TaskPriority).optional(),
  status: z.enum(TaskStatus).optional(),
});

const taskQuerySchema = z.object({
  status: z.enum(TaskStatus).optional(),
});

const getParam = (value: string | string[] | undefined, label: string) => {
  if (typeof value !== "string") {
    throw new HttpError(400, `${label} is required`);
  }

  return value;
};

router.use(requireAuth);

router.get(
  "/dashboard/summary",
  asyncHandler(async (req, res) => {
    const projectId = typeof req.query.projectId === "string" ? req.query.projectId : undefined;

    if (projectId) {
      const membership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: req.authUser!.userId,
          },
        },
      });

      if (!membership) {
        throw new HttpError(403, "You are not a member of this project");
      }
    }

    const projectFilter = projectId
      ? { projectId }
      : {
          project: {
            members: {
              some: {
                userId: req.authUser!.userId,
              },
            },
          },
        };

    const [allTasks, myTasks, overdueTasks] = await Promise.all([
      prisma.task.findMany({
        where: projectFilter,
        select: { status: true },
      }),
      prisma.task.findMany({
        where: {
          ...projectFilter,
          assignedToId: req.authUser!.userId,
        },
        include: {
          project: {
            select: { id: true, name: true },
          },
          assignee: {
            select: { id: true, name: true, email: true },
          },
          creator: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      }),
      prisma.task.count({
        where: {
          ...projectFilter,
          dueDate: { lt: new Date() },
          status: { not: TaskStatus.DONE },
        },
      }),
    ]);

    res.json({
      summary: {
        total: allTasks.length,
        todo: allTasks.filter((task) => task.status === TaskStatus.TODO).length,
        inProgress: allTasks.filter((task) => task.status === TaskStatus.IN_PROGRESS).length,
        done: allTasks.filter((task) => task.status === TaskStatus.DONE).length,
        overdue: overdueTasks,
      },
      myTasks,
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (req, res) => {
    const projects = await prisma.project.findMany({
      where: {
        members: {
          some: {
            userId: req.authUser!.userId,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        tasks: {
          select: { id: true, status: true },
        },
      },
    });

    res.json({
      projects: projects.map((project) => ({
        id: project.id,
        name: project.name,
        description: project.description,
        createdAt: project.createdAt,
        members: project.members.map((member) => ({
          id: member.id,
          role: member.role,
          user: member.user,
        })),
        taskCount: project.tasks.length,
        completedCount: project.tasks.filter((task) => task.status === TaskStatus.DONE).length,
      })),
    });
  }),
);

router.post(
  "/",
  asyncHandler(async (req, res) => {
    const payload = projectSchema.parse(req.body);

    const project = await prisma.project.create({
      data: {
        name: payload.name,
        description: payload.description || null,
        createdBy: req.authUser!.userId,
        members: {
          create: {
            userId: req.authUser!.userId,
            role: Role.ADMIN,
          },
        },
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    res.status(201).json({ project });
  }),
);

router.get(
  "/:projectId",
  requireProjectMembership,
  asyncHandler(async (req, res) => {
    const projectId = getParam(req.params.projectId, "Project id");

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          orderBy: { joinedAt: "asc" },
          include: {
            user: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        tasks: {
          orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
          include: {
            assignee: {
              select: { id: true, name: true, email: true },
            },
            creator: {
              select: { id: true, name: true, email: true },
            },
          },
        },
      },
    });

    if (!project) {
      throw new HttpError(404, "Project not found");
    }

    res.json({ project });
  }),
);

router.post(
  "/:projectId/members",
  requireProjectMembership,
  requireProjectAdmin,
  asyncHandler(async (req, res) => {
    const projectId = getParam(req.params.projectId, "Project id");
    const payload = memberSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: payload.email },
      select: { id: true, name: true, email: true },
    });

    if (!user) {
      throw new HttpError(404, "No registered user was found with that email");
    }

    const member = await prisma.projectMember.upsert({
      where: {
        projectId_userId: {
          projectId,
          userId: user.id,
        },
      },
      update: {
        role: payload.role,
      },
      create: {
        projectId,
        userId: user.id,
        role: payload.role,
      },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({ member });
  }),
);

router.patch(
  "/:projectId/members/:memberId",
  requireProjectMembership,
  requireProjectAdmin,
  asyncHandler(async (req, res) => {
    const projectId = getParam(req.params.projectId, "Project id");
    const memberId = getParam(req.params.memberId, "Member id");
    const payload = updateMemberSchema.parse(req.body);

    const currentMember = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!currentMember || currentMember.projectId !== projectId) {
      throw new HttpError(404, "Project member not found");
    }

    const member = await prisma.projectMember.update({
      where: { id: memberId },
      data: { role: payload.role },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ member });
  }),
);

router.delete(
  "/:projectId/members/:memberId",
  requireProjectMembership,
  requireProjectAdmin,
  asyncHandler(async (req, res) => {
    const projectId = getParam(req.params.projectId, "Project id");
    const memberId = getParam(req.params.memberId, "Member id");
    const member = await prisma.projectMember.findUnique({
      where: { id: memberId },
    });

    if (!member || member.projectId !== projectId) {
      throw new HttpError(404, "Project member not found");
    }

    if (member.role === Role.ADMIN) {
      const adminCount = await prisma.projectMember.count({
        where: { projectId, role: Role.ADMIN },
      });

      if (adminCount <= 1) {
        throw new HttpError(400, "A project must retain at least one admin");
      }
    }

    await prisma.projectMember.delete({ where: { id: memberId } });
    res.status(204).send();
  }),
);

router.get(
  "/:projectId/tasks",
  requireProjectMembership,
  asyncHandler(async (req, res) => {
    const projectId = getParam(req.params.projectId, "Project id");
    const query = taskQuerySchema.parse(req.query);

    const tasks = await prisma.task.findMany({
      where: {
        projectId,
        ...(query.status ? { status: query.status } : {}),
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ tasks });
  }),
);

router.post(
  "/:projectId/tasks",
  requireProjectMembership,
  asyncHandler(async (req, res) => {
    const projectId = getParam(req.params.projectId, "Project id");
    const payload = taskCreateSchema.parse(req.body);

    if (payload.assignedToId) {
      const assigneeMembership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId,
            userId: payload.assignedToId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new HttpError(400, "Assigned user is not a member of this project");
      }
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        title: payload.title,
        description: payload.description || null,
        assignedToId: payload.assignedToId || null,
        dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
        priority: payload.priority,
        createdBy: req.authUser!.userId,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.status(201).json({ task });
  }),
);

router.patch(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const taskId = getParam(req.params.taskId, "Task id");
    const payload = taskUpdateSchema.parse(req.body);

    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new HttpError(404, "Task not found");
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: req.authUser!.userId,
        },
      },
    });

    if (!membership) {
      throw new HttpError(403, "You are not a member of this project");
    }

    const canEdit =
      membership.role === Role.ADMIN ||
      task.createdBy === req.authUser!.userId ||
      task.assignedToId === req.authUser!.userId;

    if (!canEdit) {
      throw new HttpError(403, "You do not have permission to update this task");
    }

    if (payload.assignedToId) {
      const assigneeMembership = await prisma.projectMember.findUnique({
        where: {
          projectId_userId: {
            projectId: task.projectId,
            userId: payload.assignedToId,
          },
        },
      });

      if (!assigneeMembership) {
        throw new HttpError(400, "Assigned user is not a member of this project");
      }
    }

    const updatedTask = await prisma.task.update({
      where: { id: taskId },
      data: {
        title: payload.title,
        description: payload.description === undefined ? undefined : payload.description || null,
        assignedToId:
          payload.assignedToId === undefined ? undefined : payload.assignedToId || null,
        dueDate:
          payload.dueDate === undefined
            ? undefined
            : payload.dueDate
              ? new Date(payload.dueDate)
              : null,
        priority: payload.priority,
        status: payload.status,
      },
      include: {
        assignee: {
          select: { id: true, name: true, email: true },
        },
        creator: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    res.json({ task: updatedTask });
  }),
);

router.delete(
  "/tasks/:taskId",
  asyncHandler(async (req, res) => {
    const taskId = getParam(req.params.taskId, "Task id");
    const task = await prisma.task.findUnique({
      where: { id: taskId },
    });

    if (!task) {
      throw new HttpError(404, "Task not found");
    }

    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId: task.projectId,
          userId: req.authUser!.userId,
        },
      },
    });

    if (!membership) {
      throw new HttpError(403, "You are not a member of this project");
    }

    if (membership.role !== Role.ADMIN && task.createdBy !== req.authUser!.userId) {
      throw new HttpError(403, "You do not have permission to delete this task");
    }

    await prisma.task.delete({ where: { id: taskId } });
    res.status(204).send();
  }),
);

export default router;
