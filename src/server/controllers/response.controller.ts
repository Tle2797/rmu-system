// server/controllers/response.controller.ts
import { db } from "../db.config";

type Answer = { question_id: number; rating?: number; comment?: string };

export const submitResponse = async (body: any) => {
  const { survey_id, department_code, user_group, answers } = body ?? {};

  // ✅ ตรวจ payload ครบถ้วน
  if (!survey_id || !department_code || !user_group || !Array.isArray(answers)) {
    return { error: "ข้อมูลไม่ครบ" };
  }

  // ✅ ใช้ transaction: ถ้าพังระหว่างทางจะ rollback
  return db.tx(async (t) => {
    // 1) หา department_id จาก code
    const dep = await t.oneOrNone(
      "SELECT id FROM departments WHERE code = $1",
      [department_code]
    );
    if (!dep) return { error: "ไม่พบหน่วยงานนี้" };
    const department_id = dep.id as number;

    // 2) insert responses และเอา id กลับมา
    const resIns = await t.one(
      "INSERT INTO responses (survey_id, department_id, user_group) VALUES ($1,$2,$3) RETURNING id",
      [survey_id, department_id, user_group]
    );
    const response_id = resIns.id as number;

    // 3) insert answers ทีละข้อ
    for (const a of answers as Answer[]) {
      if (!a?.question_id) throw new Error("INVALID_ANSWER_PAYLOAD");
      const rating = typeof a?.rating === "number" ? a.rating : null;
      const comment = typeof a?.comment === "string" ? a.comment : "";

      await t.none(
        "INSERT INTO answers (response_id, question_id, rating, comment) VALUES ($1,$2,$3,$4)",
        [response_id, a.question_id, rating, comment]
      );
    }

    return { message: "บันทึกแบบประเมินเรียบร้อย" };
  }).catch((e) => {
    if (String(e?.message).includes("INVALID_ANSWER_PAYLOAD")) {
      return { error: "รูปแบบคำตอบไม่ถูกต้อง (ขาด question_id)" };
    }
    console.error("❌ submitResponse error:", e);
    return { error: "เกิดข้อผิดพลาดระหว่างบันทึกข้อมูล" };
  });
};
