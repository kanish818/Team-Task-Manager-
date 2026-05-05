import type { Role } from "../domain.js";

declare global {
  namespace Express {
    interface Request {
      authUser?: {
        userId: string;
        email: string;
      };
      projectMembership?: {
        memberId: string;
        role: Role;
      };
    }
  }
}

export {};
