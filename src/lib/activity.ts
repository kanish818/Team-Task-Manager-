import type { Prisma } from "@prisma/client";
import { ActivityAction, ActivityEntity } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type ActivityInput = {
  entity: ActivityEntity;
  action: ActivityAction;
  projectId: string;
  taskId?: string | null;
  actorId: string;
  message: string;
  metadata?: Record<string, unknown> | null;
};

export async function logActivity(input: ActivityInput) {
  return prisma.activityLog.create({
    data: {
      entity: input.entity,
      action: input.action,
      projectId: input.projectId,
      taskId: input.taskId ?? null,
      actorId: input.actorId,
      message: input.message,
      metadata:
        input.metadata === undefined || input.metadata === null
          ? undefined
          : (input.metadata as Prisma.InputJsonValue),
    },
  });
}
