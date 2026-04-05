import dotenv from 'dotenv';
dotenv.config();
import cors from "cors";
import express from "express";
import { z } from "zod";
import db from "./db.js";
import { AppError } from "./errors.js";
import { errorHandler, notFoundHandler, authMiddleware } from "./middlewares.js";
import { usersRouter } from "./routes/users.js";
import { recordsRouter } from "./routes/records.js";
import { summaryRouter } from "./routes/summary.js";

export const app = express();

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : [];

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

const bootstrapAdminSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email()
});

app.post("/api/bootstrap/admin", (req, res) => {
  const configuredToken = process.env.BOOTSTRAP_ADMIN_TOKEN;
  if (!configuredToken) {
    throw new AppError("BOOTSTRAP_ADMIN_TOKEN is not configured", 500);
  }

  const providedToken = req.header("x-bootstrap-token");
  if (!providedToken || providedToken !== configuredToken) {
    throw new AppError("Invalid bootstrap token", 401);
  }

  const usersCount = db.prepare("SELECT COUNT(*) as count FROM users").get() as { count: number };
  if (usersCount.count > 0) {
    throw new AppError("Bootstrap already completed", 409);
  }

  const input = bootstrapAdminSchema.parse(req.body);

  const result = db
    .prepare("INSERT INTO users (name, email, role, is_active) VALUES (?, ?, 'admin', 1)")
    .run(input.name, input.email);

  const user = db
    .prepare(
      "SELECT id, name, email, role, is_active as isActive, created_at as createdAt FROM users WHERE id = ?"
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ data: user });
});

app.use(authMiddleware);

app.get("/api/auth/me", (req, res) => {
  res.json({ data: req.user });
});

app.use("/api/users", usersRouter);
app.use("/api/records", recordsRouter);
app.use("/api/summary", summaryRouter);

app.use(notFoundHandler);
app.use(errorHandler);
