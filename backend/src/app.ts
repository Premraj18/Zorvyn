import cors from "cors";
import express from "express";
import "./db.js";
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

app.use(authMiddleware);

app.get("/api/auth/me", (req, res) => {
  res.json({ data: req.user });
});

app.use("/api/users", usersRouter);
app.use("/api/records", recordsRouter);
app.use("/api/summary", summaryRouter);

app.use(notFoundHandler);
app.use(errorHandler);
