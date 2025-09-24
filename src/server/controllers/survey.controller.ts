import { db } from "../db.config";

/** ดึง meta ของแบบสอบถาม */
export const getSurveyMeta = async (id: number) => {
  const row = await db.oneOrNone(
    "SELECT id, title, description FROM surveys WHERE id = $1",
    [id]
  );
  if (!row) return { error: "ไม่พบแบบสอบถาม" };
  return row;
};

/** อัปเดต meta (title/description) ของแบบสอบถาม */
export const updateSurveyMeta = async (
  id: number,
  payload: { title?: string; description?: string }
) => {
  const title =
    typeof payload.title === "string" && payload.title.trim().length
      ? payload.title.trim()
      : undefined;
  const description =
    typeof payload.description === "string" ? payload.description : undefined;

  if (!title && typeof description === "undefined") {
    return { error: "ไม่มีข้อมูลให้ปรับปรุง" };
  }

  // สร้าง SET แบบไดนามิก
  const sets: string[] = [];
  const args: any[] = [];

  if (title) {
    sets.push(`title = $${args.length + 1}`);
    args.push(title);
  }
  if (typeof description !== "undefined") {
    sets.push(`description = $${args.length + 1}`);
    args.push(description);
  }
  args.push(id);

  const sql = `UPDATE surveys SET ${sets.join(", ")} WHERE id = $${
    args.length
  } RETURNING id, title, description`;
  const row = await db.oneOrNone(sql, args);
  if (!row) return { error: "อัปเดตไม่สำเร็จหรือไม่พบแบบสอบถาม" };
  return row;
};

export const getQuestionsBySurveyId = async (surveyId: number) => {
  const rows = await db.any(
    `SELECT 
       id, 
       survey_id, 
       text, 
       LOWER(TRIM(type)) AS type
     FROM questions 
     WHERE survey_id = $1 
     ORDER BY id ASC`,
    [surveyId]
  );
  return rows;
};
