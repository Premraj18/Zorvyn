import { Router } from "express";
import { getNextSequence, getRecordsCollection } from "../db.js";
import { AppError } from "../errors.js";
import { requirePermission } from "../middlewares.js";
import {
  createRecordSchema,
  recordFiltersSchema,
  updateRecordSchema
} from "../validators.js";

export const recordsRouter = Router();

recordsRouter.get("/", requirePermission("records:read"), async (req, res) => {
  const filters = recordFiltersSchema.parse(req.query);
  const recordsCollection = await getRecordsCollection();

  const query: Record<string, unknown> = {};

  if (filters.type) {
    query.type = filters.type;
  }

  if (filters.category) {
    query.category = filters.category;
  }

  if (filters.startDate || filters.endDate) {
    query.date = {};

    if (filters.startDate) {
      (query.date as Record<string, string>).$gte = filters.startDate;
    }

    if (filters.endDate) {
      (query.date as Record<string, string>).$lte = filters.endDate;
    }
  }

  const offset = (filters.page - 1) * filters.pageSize;

  const data = await recordsCollection
    .aggregate([
      { $match: query },
      {
        $lookup: {
          from: "users",
          localField: "created_by",
          foreignField: "id",
          as: "creator"
        }
      },
      { $unwind: { path: "$creator", preserveNullAndEmptyArrays: true } },
      { $sort: { date: -1, id: -1 } },
      { $skip: offset },
      { $limit: filters.pageSize },
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
          updatedAt: 1,
          createdById: "$created_by",
          createdByName: "$creator.name"
        }
      }
    ])
    .toArray();

  const total = await recordsCollection.countDocuments(query);

  res.json({
    data,
    meta: {
      page: filters.page,
      pageSize: filters.pageSize,
      total
    }
  });
});

recordsRouter.post("/", requirePermission("records:create"), async (req, res) => {
  const input = createRecordSchema.parse(req.body);
  const recordsCollection = await getRecordsCollection();
  const now = new Date().toISOString();
  const newId = await getNextSequence("records");

  await recordsCollection.insertOne({
    id: newId,
    amount: input.amount,
    type: input.type,
    category: input.category,
    date: input.date,
    notes: input.notes ?? "",
    created_by: req.user!.id,
    createdAt: now,
    updatedAt: now
  });

  const record = await recordsCollection.findOne({ id: newId }, { projection: { _id: 0 } });

  res.status(201).json({ data: record });
});

recordsRouter.put("/:id", requirePermission("records:update"), async (req, res) => {
  const recordId = Number(req.params.id);
  if (Number.isNaN(recordId)) {
    throw new AppError("Invalid record id", 400);
  }

  const input = updateRecordSchema.parse(req.body);
  const recordsCollection = await getRecordsCollection();

  const existing = await recordsCollection.findOne({ id: recordId });
  if (!existing) {
    throw new AppError("Record not found", 404);
  }

  const allowedFields = ["amount", "type", "category", "date", "notes"] as const;
  const updateData: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  for (const field of allowedFields) {
    if (input[field] !== undefined) {
      updateData[field] = input[field];
    }
  }

  await recordsCollection.updateOne({ id: recordId }, { $set: updateData });

  const record = await recordsCollection.findOne({ id: recordId }, { projection: { _id: 0 } });

  res.json({ data: record });
});

recordsRouter.delete("/:id", requirePermission("records:delete"), async (req, res) => {
  const recordId = Number(req.params.id);
  if (Number.isNaN(recordId)) {
    throw new AppError("Invalid record id", 400);
  }

  const recordsCollection = await getRecordsCollection();
  const result = await recordsCollection.deleteOne({ id: recordId });

  if (!result.deletedCount) {
    throw new AppError("Record not found", 404);
  }

  res.status(204).send();
});
