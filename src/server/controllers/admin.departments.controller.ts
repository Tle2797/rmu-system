// src/server/controllers/admin.departments.controller.ts
import { db } from "../db.config";

export async function adminUpdateDepartment(codeParam: string, body: any) {
  const code = String(codeParam || "").trim();
  const name = String(body?.name || "").trim();
  if (!code || !name) return { error: "กรอกข้อมูลให้ครบ" };

  const row = await db.oneOrNone(
    `UPDATE departments SET name = $1 WHERE code = $2 RETURNING id, code, name, qr_code`,
    [name, code]
  );
  if (!row) return { error: "ไม่พบหน่วยงาน" };
  return { message: "อัปเดตสำเร็จ", department: row };
}

export async function adminDeleteDepartment(codeParam: string) {
  const code = String(codeParam || "").trim();

  // ป้องกัน foreign key: responses/answers อาจโยงอยู่
  // แนวทางที่ปลอดภัยกว่า: ตรวจนับก่อน
  const cnt = await db.one(`SELECT COUNT(*)::int AS c FROM responses WHERE department_id = (SELECT id FROM departments WHERE code = $1)`, [code]);
  if (cnt.c > 0) return { error: "ไม่สามารถลบได้: มีข้อมูลการประเมินโยงอยู่" };

  const res = await db.result(`DELETE FROM departments WHERE code = $1`, [code]);
  if (res.rowCount === 0) return { error: "ไม่พบหน่วยงาน" };
  return { message: "ลบหน่วยงานเรียบร้อย" };
}
