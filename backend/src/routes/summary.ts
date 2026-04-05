import { Router } from "express";
import db from "../db.js";
import { requirePermission } from "../middlewares.js";
import { recentActivityQuerySchema, trendQuerySchema } from "../validators.js";

export const summaryRouter = Router();

function getDateFilter(query: Record<string, unknown>) {
  const clauses: string[] = [];
  const params: string[] = [];

  const startDate = typeof query.startDate === "string" ? query.startDate : undefined;
  const endDate = typeof query.endDate === "string" ? query.endDate : undefined;

  if (startDate) {
    clauses.push("date >= ?");
    params.push(startDate);
  }

  if (endDate) {
    clauses.push("date <= ?");
    params.push(endDate);
  }

  const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
  return { whereClause, params };
}

summaryRouter.get("/overview", requirePermission("summary:read"), (req, res) => {
  const { whereClause, params } = getDateFilter(req.query as Record<string, unknown>);

  const totals = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) as totalIncome,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) as totalExpense,
        COUNT(*) as totalRecords
      FROM records
      ${whereClause}
      `
    )
    .get(...params) as { totalIncome: number; totalExpense: number; totalRecords: number };

  res.json({
    data: {
      ...totals,
      netBalance: Number((totals.totalIncome - totals.totalExpense).toFixed(2))
    }
  });
});

summaryRouter.get("/category-totals", requirePermission("summary:read"), (req, res) => {
  const { whereClause, params } = getDateFilter(req.query as Record<string, unknown>);

  const rows = db
    .prepare(
      `
      SELECT category, type, SUM(amount) as total
      FROM records
      ${whereClause}
      GROUP BY category, type
      ORDER BY total DESC
      `
    )
    .all(...params);

  res.json({ data: rows });
});

summaryRouter.get("/trends", requirePermission("summary:read"), (req, res) => {
  const { period } = trendQuerySchema.parse(req.query);

  const bucketExpression =
    period === "weekly"
      ? "strftime('%Y-W%W', date)"
      : "strftime('%Y-%m', date)";

  const rows = db
    .prepare(
      `
      SELECT
        ${bucketExpression} as bucket,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount END), 0) as expense
      FROM records
      GROUP BY bucket
      ORDER BY bucket ASC
      `
    )
    .all();

  res.json({ data: rows });
});

summaryRouter.get("/recent-activity", requirePermission("summary:read"), (req, res) => {
  const { limit } = recentActivityQuerySchema.parse(req.query);

  const rows = db
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
        u.name as createdByName
      FROM records r
      JOIN users u ON u.id = r.created_by
      ORDER BY r.created_at DESC
      LIMIT ?
      `
    )
    .all(limit);

  res.json({ data: rows });
});
