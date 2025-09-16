// server/routes/department.routes.ts
import type { Elysia } from "elysia";
import { getDepartmentByCode, listDepartments } from "../controllers/department.controller";

export default (app: Elysia) =>
  app
    /** ✅ สาธารณะ: รายการหน่วยงาน (สำหรับหน้า /survey) */
    .get("/departments", async () => {
      const rows = await listDepartments();
      return rows; // [{ id, code, name, qr_code }, ...]
    })

    /** ✅ ดึงข้อมูลหน่วยงานจาก code (ใช้ในหน้า /survey/[departmentCode]) */
    .get("/departments/:code", async ({ params, set }) => {
      const result = await getDepartmentByCode(params.code);
      if ((result as any)?.error) set.status = 404;
      return result;
    });
