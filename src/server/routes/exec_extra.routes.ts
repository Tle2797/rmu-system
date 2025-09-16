// src/server/routes/exec_extra.routes.ts
import type { Elysia } from "elysia";
import {
  getOverview,
  getParticipation,
  getRatingDistribution
} from "../controllers/exec_extra.controller";

/** Helper: แปลง query string -> ExecFilters */
function parseFilters(query: Record<string, any>) {
  // groups/departments รับได้ทั้ง ?groups=a&groups=b หรือ ?groups=a,b
  const parseMulti = (v: any): string[] | undefined => {
    if (v == null) return undefined;
    if (Array.isArray(v)) return v.filter(Boolean);
    if (typeof v === "string") {
      if (!v.trim()) return undefined;
      return v.split(",").map(s => s.trim()).filter(Boolean);
    }
    return undefined;
  };

  const survey_id = query.survey_id ? Number(query.survey_id) : 1;
  const rating_min = query.rating_min != null ? Number(query.rating_min) : undefined;
  const rating_max = query.rating_max != null ? Number(query.rating_max) : undefined;

  return {
    survey_id,
    from: query.from as string | undefined,
    to: query.to as string | undefined,
    groups: parseMulti(query.groups),
    departments: parseMulti(query.departments),
    rating_min,
    rating_max
  };
}

export default (app: Elysia) =>
  app
    .get("/exec/overview", async ({ query }) => {
      const f = parseFilters(query);
      return await getOverview(f);
    })
    .get("/exec/participation", async ({ query }) => {
      const f = parseFilters(query);
      return await getParticipation(f);
    })
    .get("/exec/rating-distribution", async ({ query }) => {
      const f = parseFilters(query);
      return await getRatingDistribution(f);
    });
