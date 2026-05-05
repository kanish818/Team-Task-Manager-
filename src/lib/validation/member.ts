import { z } from "zod";

export const addMemberSchema = z.object({
  userId: z.string().min(1),
});
