import dotenv from 'dotenv';
dotenv.config();
import cors from "cors";
import express from "express";
import { z } from "zod";
import { getNextSequence, getUsersCollection, initDatabase } from "./db.js";
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

app.use(async (_req, _res, next) => {
  await initDatabase();
  next();
});

const bootstrapAdminSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email()
});

app.post("/api/bootstrap/admin", async (req, res) => {
  const configuredToken = process.env.BOOTSTRAP_ADMIN_TOKEN;
  if (!configuredToken) {
    throw new AppError("BOOTSTRAP_ADMIN_TOKEN is not configured", 500);
  }

  const providedToken = req.header("x-bootstrap-token");
  if (!providedToken || providedToken !== configuredToken) {
    throw new AppError("Invalid bootstrap token", 401);
  }

  const usersCollection = await getUsersCollection();
  const usersCount = await usersCollection.countDocuments();
  if (usersCount > 0) {
    throw new AppError("Bootstrap already completed", 409);
  }

  const input = bootstrapAdminSchema.parse(req.body);
  const now = new Date().toISOString();
  const newId = await getNextSequence("users");

  await usersCollection.insertOne({
    id: newId,
    name: input.name,
    email: input.email,
    role: "admin",
    isActive: 1,
    createdAt: now
  });

  const user = await usersCollection.findOne({ id: newId }, { projection: { _id: 0 } });

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
