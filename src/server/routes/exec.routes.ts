// src/server/routes/exec.routes.ts
import type { Elysia } from "elysia";
import { getRank, getHeatmap, getTrend } from "../controllers/exec.controller";

export default (app: Elysia) =>
  app
    // GET /api/exec/rank?survey_id=1&from=YYYY-MM-DD&to=YYYY-MM-DD&user_groups=นักศึกษา&user_groups=บุคลากร&rating_min=1&rating_max=5
    .get("/exec/rank", async ({ query, set }) => {
      try {
        return await getRank(query);
      } catch (e) {
        set.status = 500;
        return { error: "ไม่สามารถโหลดข้อมูลจัดอันดับได้" };
      }
    })
    // GET /api/exec/heatmap?survey_id=1&from=...&to=...&user_groups=...&rating_min=&rating_max=
    .get("/exec/heatmap", async ({ query, set }) => {
      try {
        return await getHeatmap(query);
      } catch (e) {
        set.status = 500;
        return { error: "ไม่สามารถโหลดข้อมูล heatmap ได้" };
      }
    })
    // GET /api/exec/trend?survey_id=1&group=month|day&from=...&to=...&user_groups=...&rating_min=&rating_max=
    .get("/exec/trend", async ({ query, set }) => {
      try {
        return await getTrend(query);
      } catch (e) {
        set.status = 500;
        return { error: "ไม่สามารถโหลดข้อมูลเทรนด์ได้" };
      }
    });
