// server/routes/survey.routes.ts
import type { Elysia } from "elysia";
import {
  getSurveyMeta,
  updateSurveyMeta,
  getQuestionsBySurveyId,
} from "../controllers/survey.controller";

export default (app: Elysia) =>
  app
    // ✅ ดึง meta ของแบบสอบถาม
    .get("/surveys/:id", async ({ params, set }) => {
      const id = Number(params.id);
      if (!id) {
        set.status = 400;
        return { error: "id ไม่ถูกต้อง" };
      }
      const meta = await getSurveyMeta(id);
      if ((meta as any)?.error) set.status = 404;
      return meta;
    })

    // ✅ อัปเดต meta (ใช้สิทธิ์ admin เท่านั้น — แนะนำให้มี middleware ตรวจ role)
    .put("/surveys/:id", async ({ params, body, set /*, store*/ }) => {
      const id = Number(params.id);
      if (!id) {
        set.status = 400;
        return { error: "id ไม่ถูกต้อง" };
      }
      // TODO: ตรวจ role=admin จาก session/token ใน store/context ถ้าคุณมี
      const payload = (body || {}) as { title?: string; description?: string };
      const updated = await updateSurveyMeta(id, payload);
      if ((updated as any)?.error) set.status = 400;
      return updated;
    })

    // (ของเดิม) ดึงคำถามของ survey
    .get("/surveys/:id/questions", async ({ params, set }) => {
      const id = Number(params.id);
      if (!id) {
        set.status = 400;
        return { error: "id ไม่ถูกต้อง" };
      }
      const rows = await getQuestionsBySurveyId(id);
      return rows;
    });
