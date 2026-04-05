import { Router } from "express";
import { getNextSequence, getUsersCollection } from "../db.js";
import { AppError } from "../errors.js";
import { requirePermission } from "../middlewares.js";
import {
  createUserSchema,
  updateUserRoleSchema,
  updateUserStatusSchema
} from "../validators.js";

export const usersRouter = Router();

usersRouter.get("/", requirePermission("users:read"), async (_req, res) => {
  const usersCollection = await getUsersCollection();
  const users = await usersCollection
    .find({}, { projection: { _id: 0 } })
    .sort({ id: -1 })
    .toArray();

  res.json({ data: users });
});

usersRouter.post("/", requirePermission("users:create"), async (req, res) => {
  const input = createUserSchema.parse(req.body);
  const usersCollection = await getUsersCollection();
  const now = new Date().toISOString();

  const existing = await usersCollection.findOne({ email: input.email });
  if (existing) {
    throw new AppError("Email already exists", 409);
  }

  const newId = await getNextSequence("users");
  await usersCollection.insertOne({
    id: newId,
    name: input.name,
    email: input.email,
    role: input.role,
    isActive: input.isActive ? 1 : 0,
    createdAt: now
  });

  const user = await usersCollection.findOne({ id: newId }, { projection: { _id: 0 } });

  res.status(201).json({ data: user });
});

usersRouter.patch("/:id/status", requirePermission("users:update"), async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    throw new AppError("Invalid user id", 400);
  }

  const input = updateUserStatusSchema.parse(req.body);
  const usersCollection = await getUsersCollection();

  const result = await usersCollection.updateOne(
    { id: userId },
    { $set: { isActive: input.isActive ? 1 : 0 } }
  );

  if (!result.matchedCount) {
    throw new AppError("User not found", 404);
  }

  res.json({ message: "User status updated" });
});

usersRouter.patch("/:id/role", requirePermission("users:update"), async (req, res) => {
  const userId = Number(req.params.id);
  if (Number.isNaN(userId)) {
    throw new AppError("Invalid user id", 400);
  }

  const input = updateUserRoleSchema.parse(req.body);
  const usersCollection = await getUsersCollection();

  const result = await usersCollection.updateOne({ id: userId }, { $set: { role: input.role } });

  if (!result.matchedCount) {
    throw new AppError("User not found", 404);
  }

  res.json({ message: "User role updated" });
});
