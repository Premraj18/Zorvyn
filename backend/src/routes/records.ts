import { Router } from "express";
import db from "../db.js";
import { AppError } from "../errors.js";
import { requirePermission } from "../middlewares.js";
import {
  createRecordSchema,
  recordFiltersSchema,
  updateRecordSchema
} from "../validators.js";

export const recordsRouter = Router();

recordsRouter.get("/", requirePermission("records:read"), (req, res) => {
  const filters = recordFiltersSchema.parse(req.query);

  const clauses: string[] = [];
  const values: Array<string | number> = [];

  if (filters.type) {
    clauses.push("r.type = ?");
    values.push(filters.type);
  }

  if (filters.category) {
    clauses.push("r.category = ?");
    values.push(filters.category);
  }

  if (filters.startDate) {
    clauses.push("r.date >= ?");
    values.push(filters.startDate);
  }

  if (filters.endDate) {
    clauses.push("r.date <= ?");
    values.push(filters.endDate);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  const offset = (filters.page - 1) * filters.pageSize;

  const data = db
    .prepare(
      `
      SELECT
        r.id,
        r.amount,
        r.type,
        r.category,
        r.date,
        r.notes,
        r.created_at as createdAt,
        r.updated_at as updatedAt,
        u.id as createdById,
        u.name as createdByName
      FROM records r
      JOIN users u ON u.id = r.created_by
      ${whereClause}
      ORDER BY r.date DESC, r.id DESC
      LIMIT ? OFFSET ?
      `
    )
    .all(...values, filters.pageSize, offset);

  const total = db
    .prepare(`SELECT COUNT(*) as count FROM records r ${whereClause}`)
    .get(...values) as { count: number };

  res.json({
    data,
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total: total.count
    }
  });
});

recordsRouter.post("/", requirePermission("records:create"), (req, res) => {
  const input = createRecordSchema.parse(req.body);

  const result = db
    .prepare(
      "INSERT INTO records (amount, type, category, date, notes, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    )
    .run(
      input.amount,
      input.type,
      input.category,
      input.date,
      input.notes ?? "",
      req.user!.id
    );

  const record = db
    .prepare(
      "SELECT id, amount, type, category, date, notes, created_at as createdAt, updated_at as updatedAt FROM records WHERE id = ?"
    )
    .get(result.lastInsertRowid);

  res.status(201).json({ data: record });
});

recordsRouter.put("/:id", requirePermission("records:update"), (req, res) => {
  const recordId = Number(req.params.id);
  if (Number.isNaN(recordId)) {
    throw new AppError("Invalid record id", 400);
  }

  const input = updateRecordSchema.parse(req.body);

  const existing = db.prepare("SELECT id FROM records WHERE id = ?").get(recordId);
  if (!existing) {
    throw new AppError("Record not found", 404);
  }

  const allowedFields = ["amount", "type", "category", "date", "notes"] as const;
  const setClauses: string[] = [];
  const values: Array<string | number> = [];

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      setClauses.push(`${field} = ?`);
      values.push(input[field] as string | number);
    }
  }

  setClauses.push("updated_at = CURRENT_TIMESTAMP");

  db.prepare(`UPDATE records SET ${setClauses.join(", ")} WHERE id = ?`).run(...values, recordId);

  const record = db
    .prepare(
      "SELECT id, amount, type, category, date, notes, created_at as createdAt, updated_at as updatedAt FROM records WHERE id = ?"
    )
    .get(recordId);

  res.json({ data: record });
});

recordsRouter.delete("/:id", requirePermission("records:delete"), (req, res) => {
  const recordId = Number(req.params.id);
  if (Number.isNaN(recordId)) {
    throw new AppError("Invalid record id", 400);
  }

  const result = db.prepare("DELETE FROM records WHERE id = ?").run(recordId);
  if (!result.changes) {
    throw new AppError("Record not found", 404);
  }

  res.status(204).send();
});
