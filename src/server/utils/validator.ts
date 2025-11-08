// src/server/utils/validator.ts
// utils/validator.ts
import { z } from "zod";

export const SentimentSchema = z.enum(["positive","neutral","negative"]);
export const CommentsSearchQuery = z.object({
  survey_id: z.coerce.number().int().positive(),
  department_code: z.string().min(1).optional(),
  q: z.string().trim().optional(),
  sentiment: z.string().optional()
    .transform(s => (["positive","neutral","negative"].includes(s||"") ? s : "")),
});

export const ActionStatus = z.enum(["open","in_progress","done"]);
export const ListActionsQuery = z.object({
  department_code: z.string().min(1).optional(),
  status: z.string().optional()
    .transform(s => (["open","in_progress","done"].includes(s||"") ? s : undefined)),
  limit: z.coerce.number().int().min(1).max(500).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const CreateActionBody = z.object({
  answer_id: z.coerce.number().int().positive(),
  department_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(1, "title ห้ามว่าง"),
  assignee: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
});

export const UpdateActionBody = z.object({
  id: z.coerce.number().int().positive(),
  status: ActionStatus.optional(),
  title: z.string().trim().optional(),
  assignee: z.string().trim().optional().nullable(),
  notes: z.string().trim().optional().nullable(),
}).refine(d => d.status || d.title || "assignee" in d || "notes" in d, {
  message: "ต้องมีฟิลด์อย่างน้อย 1 รายการเพื่ออัปเดต",
});
