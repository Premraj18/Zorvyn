import { z } from "zod";

export const roleSchema = z.enum(["viewer", "analyst", "admin"]);

export const createUserSchema = z.object({
  name: z.string().trim().min(2),
  email: z.email(),
  role: roleSchema,
  isActive: z.boolean().default(true)
});

export const updateUserStatusSchema = z.object({
  isActive: z.boolean()
});

export const updateUserRoleSchema = z.object({
  role: roleSchema
});

export const recordTypeSchema = z.enum(["income", "expense"]);

export const createRecordSchema = z.object({
  amount: z.number().nonnegative(),
  type: recordTypeSchema,
  category: z.string().trim().min(2),
  date: z.iso.date(),
  notes: z.string().trim().max(500).optional().default("")
});

export const updateRecordSchema = createRecordSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  "At least one field is required"
);

export const recordFiltersSchema = z.object({
  type: recordTypeSchema.optional(),
  category: z.string().trim().optional(),
  startDate: z.iso.date().optional(),
  endDate: z.iso.date().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10)
});

export const trendQuerySchema = z.object({
  period: z.enum(["monthly", "weekly"]).default("monthly")
});

export const recentActivityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(5)
});
