// src/server/routes/admin.questions.routes.ts
import type { Elysia } from "elysia";
import {
  adminListQuestions, adminCreateQuestion, adminUpdateQuestion, adminDeleteQuestion
} from "../controllers/admin.questions.controller";

export default (app: Elysia) =>
  app
    .get("/admin/questions", async ({ query }) => {
      const survey_id = query?.survey_id ? Number(query.survey_id) : 1;
      return adminListQuestions(survey_id);
    })
    .post("/admin/questions", async ({ body, set }) => {
      const r = await adminCreateQuestion(body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .put("/admin/questions/:id", async ({ params, body, set }) => {
      const r = await adminUpdateQuestion(params.id, body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .delete("/admin/questions/:id", async ({ params, set }) => {
      const r = await adminDeleteQuestion(params.id);
      if ((r as any)?.error) set.status = 400;
      return r;
    });
