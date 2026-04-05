import { Router } from "express";
import db from "../db.js";
import { AppError } from "../errors.js";
import { requirePermission } from "../middlewares.js";
import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
} from "../validators.js";

export const usersRouter = Router();

usersRouter.get("/", requirePermission("users:read"), (_req, res) => {
  const users = db
    .prepare(
      "SELECT id, name, email, role, is_active as isActive, created_at as createdAt FROM users ORDER BY id DESC"
    )
    .all();

  res.json({ data: users });
});

usersRouter.post("/", requirePermission("users:create"), (req, res) => {
  const input = createUserSchema.parse(req.body);

  const result = db
    .prepare("INSERT INTO users (name, email, role, is_active) VALUES (?, ?, ?, ?)")
    .run(input.name, input.email, input.role, input.isActive ? 1 : 0);

  const user = db
    .prepare(
      "SELECT id, name, email, role, is_active as isActive, created_at as createdAt FROM users WHERE id = ?"
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ data: user });
});

usersRouter.patch("/:id/status", requirePermission("users:update"), (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    throw new AppError("Invalid user id", 400);
  }

  const input = updateUserStatusSchema.parse(req.body);

  const result = db
    .prepare("UPDATE users SET is_active = ? WHERE id = ?")
    .run(input.isActive ? 1 : 0, userId);

  if (!result.changes) {
    throw new AppError("User not found", 404);
  }

  res.json({ message: "User status updated" });
});

usersRouter.patch("/:id/role", requirePermission("users:update"), (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    throw new AppError("Invalid user id", 400);
  }

  const input = updateUserRoleSchema.parse(req.body);

  const result = db.prepare("UPDATE users SET role = ? WHERE id = ?").run(input.role, userId);

  if (!result.changes) {
    throw new AppError("User not found", 404);
  }

  res.json({ message: "User role updated" });
});
