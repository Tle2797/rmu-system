// server/controllers/admin.controller.ts
import { db } from "../db.config";
import QRCode from "qrcode";
import fs from "fs";
import path from "path";
import { hashPassword } from "../auth/password";
/* =========================
   ส่วน: Questions (CRUD)
   ========================= */

// แสดงคำถามทั้งหมดของแบบสอบถาม (ฟอร์มกลาง)
export async function listQuestions(surveyId: number) {
  return db.any(
    `SELECT id, survey_id, text, type
     FROM questions
     WHERE survey_id = $1
     ORDER BY id ASC`,
    [surveyId]
  );
}

// สร้างคำถามใหม่
export async function createQuestion(body: any) {
  const survey_id = Number(body?.survey_id ?? 0);
  const text = String(body?.text ?? "").trim();
  const type = (String(body?.type ?? "rating") === "text") ? "text" : "rating";

  if (!survey_id || !text) return { error: "กรอกข้อมูลไม่ครบ (survey_id, text)" };

  const row = await db.one(
    `INSERT INTO questions (survey_id, text, type)
     VALUES ($1, $2, $3)
     RETURNING id, survey_id, text, type`,
    [survey_id, text, type]
  );
  return { ok: true, question: row };
}

// แก้ไขคำถาม
export async function updateQuestion(questionId: number, body: any) {
  const text = String(body?.text ?? "").trim();
  const type = (String(body?.type ?? "rating") === "text") ? "text" : "rating";
  if (!text) return { error: "กรอกข้อความคำถาม" };

  const row = await db.oneOrNone(
    `UPDATE questions
     SET text = $1, type = $2
     WHERE id = $3
     RETURNING id, survey_id, text, type`,
    [text, type, questionId]
  );
  if (!row) return { error: "ไม่พบคำถามนี้" };
  return { ok: true, question: row };
}

// ลบคำถาม (ON DELETE CASCADE จะลบ answers ที่โยงให้ด้วย)
export async function deleteQuestion(questionId: number) {
  if (!questionId) return { error: "ต้องระบุ questionId" };

  return db.tx(async (t) => {
    const existed = await t.oneOrNone(
      "SELECT id FROM questions WHERE id = $1",
      [questionId]
    );
    if (!existed) return { error: "ไม่พบคำถามนี้" };

    await t.none("DELETE FROM questions WHERE id = $1", [questionId]);
    return { ok: true, deleted_question_id: questionId };
  });
}

/* ===================================
   ส่วน: Departments + QR (เดิมของคุณ)
   =================================== */

function ensureQrDir() {
  const dir = path.join(process.cwd(), "public", "qrcode");
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

// POST /admin/departments
export async function createDepartment(body: any) {
  const code = String(body?.code || "").trim();
  const name = String(body?.name || "").trim();

  if (!code || !name) {
    return { error: "กรุณากรอก code และ name ให้ครบ" };
  }

  const dup = await db.oneOrNone(
    "SELECT id FROM departments WHERE code = $1",
    [code]
  );
  if (dup) return { error: "มีรหัสหน่วยงานนี้อยู่แล้ว" };

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const surveyUrl = `${base}/survey/${encodeURIComponent(code)}`;

  ensureQrDir();
  const fileAbs = path.join(process.cwd(), "public", "qrcode", `${code}.png`);
  await QRCode.toFile(fileAbs, surveyUrl, { width: 512, margin: 1 });

  const qrPublicPath = `/qrcode/${code}.png`;

  const row = await db.one(
    "INSERT INTO departments (code, name, qr_code) VALUES ($1, $2, $3) RETURNING id, code, name, qr_code",
    [code, name, qrPublicPath]
  );

  return {
    message: "สร้างหน่วยงานสำเร็จ",
    department: row,
    survey_url: surveyUrl,
    qr_url: qrPublicPath
  };
}

// GET /admin/departments
export async function listDepartments() {
  const rows = await db.any(
    "SELECT id, code, name, qr_code FROM departments ORDER BY id DESC"
  );
  return rows;
}

// POST /admin/departments/:code/regen-qr
export async function regenerateQrForDepartment(codeParam: string) {
  const code = String(codeParam || "").trim();
  const dep = await db.oneOrNone(
    "SELECT id, code, name FROM departments WHERE code = $1",
    [code]
  );
  if (!dep) return { error: "ไม่พบหน่วยงาน" };

  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  const surveyUrl = `${base}/survey/${encodeURIComponent(code)}`;

  ensureQrDir();
  const fileAbs = path.join(process.cwd(), "public", "qrcode", `${code}.png`);
  await QRCode.toFile(fileAbs, surveyUrl, { width: 512, margin: 1 });
  const qrPublicPath = `/qrcode/${code}.png`;

  await db.none(
    "UPDATE departments SET qr_code = $1 WHERE id = $2",
    [qrPublicPath, dep.id]
  );

  return { message: "อัปเดต QR สำเร็จ", qr_url: qrPublicPath, survey_url: surveyUrl };
}

export async function changeUserPassword(opts: { userId?: number; newPassword?: string }) {
  const userId = Number(opts.userId || 0);
  const newPassword = (opts.newPassword || "").trim();

  if (!userId || Number.isNaN(userId)) {
    return { error: "ระบุ user id ไม่ถูกต้อง" };
  }
  if (!newPassword || newPassword.length < 8) {
    return { error: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร" };
  }

  const hash = await hashPassword(newPassword);

  const result = await db.result(
    "UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2",
    [hash, userId]
  );

  if (result.rowCount === 0) {
    return { error: "ไม่พบผู้ใช้ที่ต้องการเปลี่ยนรหัสผ่าน" };
  }

  return { ok: true };
}
