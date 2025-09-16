// server/routes/admin.routes.ts
import type { Elysia } from "elysia";
import {
  // Questions
  listQuestions,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  // Departments + QR
  createDepartment,
  listDepartments,
  regenerateQrForDepartment
} from "../controllers/admin.controller";

export default (app: Elysia) =>
  app
    /* ------------- Questions ------------- */

    // GET /api/admin/questions?survey_id=1
    .get("/admin/questions", async ({ query, set }) => {
      try {
        const surveyId = Number(query.survey_id ?? 1);
        return await listQuestions(surveyId);
      } catch (e) {
        set.status = 500;
        return { error: "โหลดคำถามไม่สำเร็จ" };
      }
    })

    // POST /api/admin/questions
    .post("/admin/questions", async ({ body, set }) => {
      const r = await createQuestion(body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })

    // PUT /api/admin/questions/:id
    .put("/admin/questions/:id", async ({ params, body, set }) => {
      const id = Number(params.id);
      const r = await updateQuestion(id, body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })

    // DELETE /api/admin/questions/:id
    .delete("/admin/questions/:id", async ({ params, set }) => {
      const id = Number(params.id);
      try {
        const r = await deleteQuestion(id);
        if ((r as any)?.error) set.status = 400;
        return r;
      } catch (e) {
        set.status = 500;
        return { error: "ลบคำถามไม่สำเร็จ" };
      }
    })

    /* --------- Departments + QR ---------- */

    // POST /api/admin/departments
    .post("/admin/departments", async ({ body, set }) => {
      const result = await createDepartment(body);
      if ((result as any)?.error) set.status = 400;
      return result;
    })

    // GET /api/admin/departments
    .get("/admin/departments", async () => {
      return await listDepartments();
    })

    // POST /api/admin/departments/:code/regen-qr
    .post("/admin/departments/:code/regen-qr", async ({ params, set }) => {
      const result = await regenerateQrForDepartment(params.code);
      if ((result as any)?.error) set.status = 404;
      return result;
    });
