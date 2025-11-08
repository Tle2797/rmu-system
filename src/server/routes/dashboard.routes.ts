// src/server/routes/dashboard.routes.ts
import type { Elysia } from "elysia";
import {
  getDeptSummary,
  getDeptComments,
  exportDeptExcel,
  exportDeptPdf
} from "../controllers/dashboard.controller";

/** helper: แปลง ArrayBuffer -> Uint8Array ให้แน่ชัด (กัน TS เตือน) */
const toUint8 = (data: ArrayBuffer | Uint8Array) =>
  data instanceof Uint8Array ? data : new Uint8Array(data);

export default (app: Elysia) =>
  app
    // 1) สรุปคะแนนรายคำถามของหน่วยงาน
    .get("/departments/:code/summary", async ({ params, query, set }) => {
      const surveyId = Number(query.survey_id ?? 1);
      const from = (query.from as string) || undefined; // YYYY-MM-DD
      const to   = (query.to as string)   || undefined; // YYYY-MM-DD (inclusive; controller จะ +1 วันเอง)

      const result = await getDeptSummary(params.code, surveyId, from, to);
      if ("error" in result) set.status = 404;
      return result;
    })

    // 2) คอมเมนต์ (type=text)
    .get("/departments/:code/comments", async ({ params, query, set }) => {
      const surveyId = Number(query.survey_id ?? 1);
      const limit = Number(query.limit ?? 50);
      const offset = Number(query.offset ?? 0);
      const from = (query.from as string) || undefined;
      const to   = (query.to as string)   || undefined;

      const result = await getDeptComments(params.code, surveyId, limit, offset, from, to);
      if ("error" in result) set.status = 404;
      return result;
    })

    // 3) Export Excel (.xlsx)
    .get("/departments/:code/export.xlsx", async ({ params, query, set }) => {
      const surveyId = Number(query.survey_id ?? 1);
      const from = (query.from as string) || undefined;
      const to   = (query.to as string)   || undefined;

      const x = await exportDeptExcel(params.code, surveyId, from, to);

      // type guard: ถ้าเป็น error object
      if (!(x instanceof ArrayBuffer) && !(x instanceof Uint8Array)) {
        set.status = 400;
        return x; // { error: "..." }
      }

      set.headers["Content-Type"] =
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      set.headers["Content-Disposition"] =
        `attachment; filename="report_${params.code}.xlsx"`;

      return toUint8(x); // คืนเป็น Uint8Array ชัดเจน
    })

    // 4) Export PDF (.pdf)
    .get("/departments/:code/export.pdf", async ({ params, query, set }) => {
      const surveyId = Number(query.survey_id ?? 1);
      const from = (query.from as string) || undefined;
      const to   = (query.to as string)   || undefined;

      const x = await exportDeptPdf(params.code, surveyId, from, to);

      // type guard: ถ้าเป็น error object
      if (!(x instanceof Uint8Array)) {
        set.status = 400;
        return x; // { error: "..." }
      }

      set.headers["Content-Type"] = "application/pdf";
      set.headers["Content-Disposition"] =
        `attachment; filename="report_${params.code}.pdf"`;

      return x; // pdf-lib ให้มาเป็น Uint8Array
    });
