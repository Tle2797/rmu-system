// src/server/routes/response.routes.ts
import type { Elysia } from "elysia";
import { submitResponse } from "../controllers/response.controller";

type Answer = {
  question_id: number;
  rating?: number;
  comment?: string;
};

type SubmitBody = {
  survey_id: number;
  department_code: string; // << ใช้ department_code ตามที่เราแก้ controller แล้ว
  user_group: string;
  answers: Answer[];
};

export default (app: Elysia) =>
  app.post("/submit-response", async ({ body, set }: { body: SubmitBody, set: any }) => {
    const result = await submitResponse(body);
    if ((result as any)?.error) set.status = 400;
    return result;
  });
