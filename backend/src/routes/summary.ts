import { Router } from "express";
import { getRecordsCollection } from "../db.js";
import { requirePermission } from "../middlewares.js";
import { recentActivityQuerySchema, trendQuerySchema } from "../validators.js";

export const summaryRouter = Router();

function getDateFilter(query: Record<string, unknown>) {
  const filter: Record<string, unknown> = {};

  const startDate = typeof query.startDate === "string" ? query.startDate : undefined;
  const endDate = typeof query.endDate === "string" ? query.endDate : undefined;

  if (startDate || endDate) {
    filter.date = {};

    if (startDate) {
      (filter.date as Record<string, string>).$gte = startDate;
    }

    if (endDate) {
      (filter.date as Record<string, string>).$lte = endDate;
    }
  }

  return filter;
}

summaryRouter.get("/overview", requirePermission("summary:read"), async (req, res) => {
  const recordsCollection = await getRecordsCollection();
  const match = getDateFilter(req.query as Record<string, unknown>);

  const [totals] = await recordsCollection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalIncome: {
            $sum: {
              $cond: [{ $eq: ["$type", "income"] }, "$amount", 0]
            }
          },
          totalExpense: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0]
            }
          },
          totalRecords: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          totalIncome: 1,
          totalExpense: 1,
          totalRecords: 1
        }
      }
    ])
    .toArray();

  const normalized = {
    totalIncome: Number(totals?.totalIncome ?? 0),
    totalExpense: Number(totals?.totalExpense ?? 0),
    totalRecords: Number(totals?.totalRecords ?? 0)
  };

  res.json({
    data: {
      ...normalized,
      netBalance: Number((normalized.totalIncome - normalized.totalExpense).toFixed(2))
    }
  });
});

summaryRouter.get("/category-totals", requirePermission("summary:read"), async (req, res) => {
  const recordsCollection = await getRecordsCollection();
  const match = getDateFilter(req.query as Record<string, unknown>);

  const rows = await recordsCollection
    .aggregate([
      { $match: match },
      {
        $group: {
          _id: { category: "$category", type: "$type" },
          total: { $sum: "$amount" }
        }
      },
      { $sort: { total: -1 } },
      {
        $project: {
          _id: 0,
          category: "$_id.category",
          type: "$_id.type",
          total: 1
        }
      }
    ])
    .toArray();

  res.json({ data: rows });
});

summaryRouter.get("/trends", requirePermission("summary:read"), async (req, res) => {
  const { period } = trendQuerySchema.parse(req.query);
  const recordsCollection = await getRecordsCollection();

  const format = period === "weekly" ? "%G-W%V" : "%Y-%m";

  const rows = await recordsCollection
    .aggregate([
      {
        $addFields: {
          parsedDate: {
            $dateFromString: {
              dateString: "$date",
              format: "%Y-%m-%d"
            }
          }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format,
              date: "$parsedDate"
            }
          },
          income: {
            $sum: {
              $cond: [{ $eq: ["$type", "income"] }, "$amount", 0]
            }
          },
          expense: {
            $sum: {
              $cond: [{ $eq: ["$type", "expense"] }, "$amount", 0]
            }
          }
        }
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          bucket: "$_id",
          income: 1,
          expense: 1
        }
      }
    ])
    .toArray();

  res.json({ data: rows });
});

summaryRouter.get("/recent-activity", requirePermission("summary:read"), async (req, res) => {
  const { limit } = recentActivityQuerySchema.parse(req.query);
  const recordsCollection = await getRecordsCollection();

  const rows = await recordsCollection
    .aggregate([
      { $sort: { createdAt: -1 } },
      { $limit: limit },
      {
        $lookup: {
          from: "users",
          localField: "created_by",
          foreignField: "id",
          as: "creator"
        }
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 0,
          id: 1,
          amount: 1,
          type: 1,
          category: 1,
          date: 1,
          notes: 1,
          createdAt: 1,
          createdByName: "$creator.name"
        }
      }
    ])
    .toArray();

  res.json({ data: rows });
});
