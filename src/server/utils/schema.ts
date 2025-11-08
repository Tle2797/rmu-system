// src/server/utils/schema.ts
import { z } from "zod";

/** common */
export const SentimentEnum = z.enum(["positive", "neutral", "negative"]);
export const ActionStatusEnum = z.enum(["open", "in_progress", "done"]);

/** /comments/search */
export const CommentsSearchQuery = z.object({
  survey_id: z.coerce.number().int().positive().default(1),
  department_code: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sentiment: SentimentEnum.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(100),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

/** /comments/summary */
export const CommentsSummaryQuery = z.object({
  survey_id: z.coerce.number().int().positive().default(1),
  department_code: z.string().trim().min(1).optional(),
  q: z.string().trim().min(1).max(200).optional(),
  sentiment: SentimentEnum.optional(),
});

/** /comments/actions (GET) */
export const ActionsListQuery = z.object({
  department_code: z.string().trim().min(1).optional(),
  status: ActionStatusEnum.optional(),
  limit: z.coerce.number().int().min(1).max(500).optional().default(200),
  offset: z.coerce.number().int().min(0).max(10_000).optional().default(0),
});

/** /comments/actions (POST) */
export const ActionCreateBody = z.object({
  answer_id: z.coerce.number().int().positive(),
  department_id: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(200),
  assignee: z.string().trim().min(1).max(120).nullable().optional(),
  notes: z.string().trim().min(1).max(2000).nullable().optional(),
});

/** /comments/actions (PUT) */
export const ActionUpdateBody = z.object({
  id: z.coerce.number().int().positive(),
  status: ActionStatusEnum.optional(),
  title: z.string().trim().min(3).max(200).optional(),
  assignee: z.string().trim().min(1).max(120).nullable().optional(),
  notes: z.string().trim().min(1).max(2000).nullable().optional(),
}).refine(
  (b) => b.status !== undefined || b.title !== undefined || b.assignee !== undefined || b.notes !== undefined,
  { message: "ไม่มีฟิลด์ให้ปรับปรุง" }
);
