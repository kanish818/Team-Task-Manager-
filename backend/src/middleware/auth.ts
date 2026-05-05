import type { NextFunction, Request, Response } from "express";
import { Role } from "../domain.js";
import { prisma } from "../lib/prisma.js";
import { verifyToken } from "../utils/auth.js";
import { HttpError } from "../utils/http.js";

export const requireAuth = (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new HttpError(401, "Authorization token is required"));
    return;
  }

  try {
    const token = authHeader.slice(7);
    req.authUser = verifyToken(token);
    next();
  } catch {
    next(new HttpError(401, "Invalid or expired token"));
  }
};

export const requireProjectMembership = async (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  if (!req.authUser) {
    next(new HttpError(401, "Authentication required"));
    return;
  }

  const projectId = req.params.projectId ?? req.query.projectId;

  if (typeof projectId !== "string") {
    next(new HttpError(400, "Project id is required"));
    return;
  }

  const membership = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: req.authUser.userId,
      },
    },
  });

  if (!membership) {
    next(new HttpError(403, "You are not a member of this project"));
    return;
  }

  req.projectMembership = { memberId: membership.id, role: membership.role };
  next();
};

export const requireProjectAdmin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.projectMembership?.role !== Role.ADMIN) {
    next(new HttpError(403, "Admin access is required for this project"));
    return;
  }

  next();
};
