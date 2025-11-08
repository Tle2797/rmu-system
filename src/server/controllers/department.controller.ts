// src/server/controllers/department.controller.ts
import { db } from "../db.config";

/** 🔹 รายการหน่วยงานแบบสาธารณะ (ใช้ในหน้า /survey) */
export async function listDepartments(): Promise<
  { id: number; code: string; name: string; qr_code: string }[]
> {
  return db.any(
    `SELECT id, code, name, qr_code
     FROM departments
     ORDER BY name ASC`
  );
}

/** 🔹 ดึงข้อมูลหน่วยงานตามรหัส (ใช้ใน /survey/[departmentCode]) */
export async function getDepartmentByCode(code: string) {
  const dep = await db.oneOrNone(
    `SELECT id, code, name
     FROM departments
     WHERE code = $1`,
    [code]
  );
  if (!dep) return { error: "ไม่พบหน่วยงานนี้" };
  return dep;
}
