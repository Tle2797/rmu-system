// src/server/routes/comments.routes.ts
import type { Elysia } from "elysia";
import {
  searchComments,
  getCommentsSummary,
  // ⬇️ เพิ่ม 3 ฟังก์ชันสำหรับภารกิจ
  listActions,
  createAction,
  updateAction,
} from "../controllers/comments.controller";

type Sentiment = "positive" | "neutral" | "negative";
const isSentiment = (s?: string): s is Sentiment =>
  s === "positive" || s === "neutral" || s === "negative";

export default (app: Elysia) =>
  app
    // -------------------------------------------------------
    // 1) ค้นหา/กรองคอมเมนต์
    // GET /api/comments/search?survey_id=1&department_code=IT001&q=...&sentiment=positive|neutral|negative
    // -------------------------------------------------------
    .get("/comments/search", async ({ query, set }) => {
      const survey_id = Number(query.survey_id ?? 1);
      if (!survey_id) {
        set.status = 400;
        return { error: "ต้องระบุ survey_id" };
      }

      const department_code = (query.department_code as string) || undefined;
      const q = (query.q as string) || undefined;

      const sRaw = (query.sentiment as string) || "";
      const sentiment = isSentiment(sRaw) ? sRaw : "";

      const rows = await searchComments({
        department_code,
        survey_id,
        q,
        sentiment,
      });

      return rows;
    })

    // -------------------------------------------------------
    // 2) สรุปคอมเมนต์ (ตามอารมณ์/ธีม)
    // GET /api/comments/summary?survey_id=1&department_code=IT001&q=...&sentiment=...
    // -------------------------------------------------------
    .get("/comments/summary", async ({ query, set }) => {
      const survey_id = Number(query.survey_id ?? 1);
      if (!survey_id) {
        set.status = 400;
        return { error: "ต้องระบุ survey_id" };
      }

      const department_code = (query.department_code as string) || undefined;
      const q = (query.q as string) || undefined;

      const sRaw = (query.sentiment as string) || "";
      const sentiment = isSentiment(sRaw) ? sRaw : "";

      const sum = await getCommentsSummary({
        department_code,
        survey_id,
        q,
        sentiment,
      });

      return sum;
    })

    // -------------------------------------------------------
    // 3) ภารกิจจากคอมเมนต์: ดึงรายการ
    // GET /api/comments/actions?department_code=IT001&status=open|in_progress|done
    // -------------------------------------------------------
    .get("/comments/actions", async ({ query }) => {
      const department_code = (query.department_code as string) || undefined;

      const sRaw = (query.status as string) || "";
      const status =
        sRaw === "open" || sRaw === "in_progress" || sRaw === "done"
          ? (sRaw as "open" | "in_progress" | "done")
          : undefined;

      const limit = Number(query.limit ?? 200);
      const offset = Number(query.offset ?? 0);

      const rows = await listActions({ department_code, status, limit, offset });
      return rows;
    })

    // -------------------------------------------------------
    // 4) ภารกิจจากคอมเมนต์: สร้างใหม่
    // POST /api/comments/actions
    // body: { answer_id:number, department_id:number, title:string, assignee?:string|null, notes?:string|null }
    // -------------------------------------------------------
    .post("/comments/actions", async ({ body, set }) => {
      const { answer_id, department_id, title, assignee, notes } = (body || {}) as {
        answer_id?: number;
        department_id?: number;
        title?: string;
        assignee?: string | null;
        notes?: string | null;
      };

      const r = await createAction({
        answer_id: Number(answer_id),
        department_id: Number(department_id),
        title: String(title || ""),
        assignee: typeof assignee === "string" ? assignee : null,
        notes: typeof notes === "string" ? notes : null,
      });

      if ("error" in r) {
        set.status = 400;
        return r;
      }
      return r; // { ok: true, id }
    })

    // -------------------------------------------------------
    // 5) ภารกิจจากคอมเมนต์: อัปเดต
    // PUT /api/comments/actions
    // body: { id:number, status?:'open'|'in_progress'|'done', title?:string, assignee?:string|null, notes?:string|null }
    // -------------------------------------------------------
    .put("/comments/actions", async ({ body, set }) => {
      const { id, status, title, assignee, notes } = (body || {}) as {
        id?: number;
        status?: "open" | "in_progress" | "done";
        title?: string;
        assignee?: string | null;
        notes?: string | null;
      };

      const r = await updateAction({
        id: Number(id),
        status,
        title,
        assignee: typeof assignee === "string" ? assignee : assignee ?? undefined,
        notes: typeof notes === "string" ? notes : notes ?? undefined,
      });

      if ("error" in r) {
        set.status = 400;
        return r;
      }
      return r; // { ok: true }
    });
