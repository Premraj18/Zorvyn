import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { getUsersCollection } from "./db.js";
import { AppError } from "./errors.js";
import { ROLE_PERMISSIONS } from "./constants.js";
import type { RequestUser, Role } from "./types.js";

declare global {
  namespace Express {
    interface Request {
      user?: RequestUser;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const userIdHeader = req.header("x-user-id");

  if (!userIdHeader) {
    throw new AppError("Missing x-user-id header", 401);
  }

  const userId = Number(userIdHeader);
  if (Number.isNaN(userId)) {
    throw new AppError("x-user-id must be numeric", 400);
  }

  const users = await getUsersCollection();
  const user = (await users.findOne(
    { id: userId },
    { projection: { _id: 0, id: 1, name: 1, email: 1, role: 1, isActive: 1 } }
  )) as RequestUser | null;

  if (!user) {
    throw new AppError("User not found", 401);
  }

  if (!user.isActive) {
    throw new AppError("User is inactive", 403);
  }

  req.user = user;
  next();
}

export function requirePermission(permission: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const role = req.user?.role as Role | undefined;
    if (!role) {
      throw new AppError("Unauthorized", 401);
    }

    const permissions = ROLE_PERMISSIONS[role];
    if (!permissions.includes(permission)) {
      throw new AppError("Forbidden", 403);
    }

    next();
  };
}

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError("Route not found", 404));
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err instanceof ZodError) {
    res.status(422).json({ error: "Validation failed", issues: err.issues });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}
