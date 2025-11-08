// src/server/routes/admin.departments.routes.ts
import type { Elysia } from "elysia";
import { adminUpdateDepartment, adminDeleteDepartment } from "../controllers/admin.departments.controller";
import { createDepartment, listDepartments, regenerateQrForDepartment } from "../controllers/admin.controller";

export default (app: Elysia) =>
  app
    .get("/admin/departments", async () => listDepartments())
    .post("/admin/departments", async ({ body, set }) => {
      const r = await createDepartment(body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .put("/admin/departments/:code", async ({ params, body, set }) => {
      const r = await adminUpdateDepartment(params.code, body);
      if ((r as any)?.error) set.status = 400;
      return r;
    })
    .post("/admin/departments/:code/regen-qr", async ({ params, set }) => {
      const r = await regenerateQrForDepartment(params.code);
      if ((r as any)?.error) set.status = 404;
      return r;
    })
    .delete("/admin/departments/:code", async ({ params, set }) => {
      const r = await adminDeleteDepartment(params.code);
      if ((r as any)?.error) set.status = 400;
      return r;
    });
