import { z } from "zod";

const dueDateSchema = z.preprocess(
  (value) => {
    if (!value) return undefined;
    if (value instanceof Date) return value;
    if (typeof value === "string" && value.trim() !== "") {
      return new Date(value);
    }
    return undefined;
  },
  z.date().optional()
);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
  dueDate: dueDateSchema,
  assignedToId: z.string().min(1).optional(),
  projectId: z.string().min(1),
});

export const adminUpdateTaskSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]).optional(),
    priority: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
    dueDate: dueDateSchema,
    assignedToId: z.string().min(1).nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field is required",
  });

export const memberUpdateStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "COMPLETED"]),
});
