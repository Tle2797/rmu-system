// src/server/controllers/admin.questions.controller.ts
import { db } from "../db.config";

/**
 * โครงสร้างแบบสอบถามกลาง: surveys.id = 1 (มาตรฐาน)
 * ตาราง questions: (id, survey_id, text, type)
 */

export async function adminListQuestions(surveyId = 1) {
  return await db.any(
    `SELECT id, survey_id, text, type
     FROM questions
     WHERE survey_id = $1
     ORDER BY id ASC`,
    [surveyId]
  );
}

export async function adminCreateQuestion(body: any) {
  const survey_id = Number(body?.survey_id ?? 1);
  const text = String(body?.text || "").trim();
  const type = body?.type === "text" ? "text" : "rating";

  if (!text) return { error: "กรอกคำถาม" };

  const row = await db.one(
    `INSERT INTO questions (survey_id, text, type)
     VALUES ($1,$2,$3)
     RETURNING id, survey_id, text, type`,
    [survey_id, text, type]
  );
  return { message: "เพิ่มคำถามสำเร็จ", question: row };
}

export async function adminUpdateQuestion(idParam: string, body: any) {
  const id = Number(idParam);
  if (!id) return { error: "id ไม่ถูกต้อง" };

  const text = body?.text !== undefined ? String(body.text).trim() : undefined;
  const type = body?.type !== undefined ? (body.type === "text" ? "text" : "rating") : undefined;
  const sets: string[] = [];
  const vals: any[] = [];
  let i = 1;

  if (text !== undefined) { sets.push(`text = $${i++}`); vals.push(text); }
  if (type !== undefined) { sets.push(`type = $${i++}`); vals.push(type); }

  if (!sets.length) return { error: "ไม่มีข้อมูลให้อัปเดต" };

  vals.push(id);
  const row = await db.oneOrNone(
    `UPDATE questions SET ${sets.join(", ")} WHERE id = $${i}
     RETURNING id, survey_id, text, type`,
    vals
  );
  if (!row) return { error: "ไม่พบคำถาม" };
  return { message: "อัปเดตคำถามสำเร็จ", question: row };
}

export async function adminDeleteQuestion(idParam: string) {
  const id = Number(idParam);
  if (!id) return { error: "id ไม่ถูกต้อง" };

  // ป้องกันข้อมูล answers ที่โยงอยู่
  const cnt = await db.one(`SELECT COUNT(*)::int AS c FROM answers WHERE question_id = $1`, [id]);
  if (cnt.c > 0) return { error: "ไม่สามารถลบได้: มีคำตอบโยงอยู่" };

  const res = await db.result(`DELETE FROM questions WHERE id = $1`, [id]);
  if (res.rowCount === 0) return { error: "ไม่พบคำถาม" };
  return { message: "ลบคำถามเรียบร้อย" };
}
