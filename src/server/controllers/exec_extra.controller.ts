// src/server/controllers/exec_extra.controller.ts
import { db } from "../db.config";

/** ---------------- Types ---------------- **/
export type ExecFilters = {
  survey_id?: number;       // ค่าเริ่มต้น 1
  from?: string;            // "YYYY-MM-DD"
  to?: string;              // "YYYY-MM-DD" (รวมทั้งวัน: < to+1day)
  groups?: string[];        // ["นักศึกษา","บุคลากร","บุคคลทั่วไป"]
  departments?: string[];   // ["IT001","LIB001"]
  rating_min?: number;      // 1..5
  rating_max?: number;      // 1..5
};

export type Overview = {
  departments_count: number;     // หน่วยงานที่มีข้อมูลในช่วงเวลา/ฟิลเตอร์
  surveys_count: number;         // จำนวนชุดแบบสอบถาม (ทั้งระบบ)
  questions_count: number;       // จำนวนคำถามทั้งหมดในฟอร์ม (ทุกประเภท)
  responses_count: number;       // จำนวน response (ครั้งการทำแบบประเมิน)
  avg_score: number | null;      // คะแนนเฉลี่ยรวม
  pct_high: number;              // สัดส่วน 4–5
  pct_low: number;               // สัดส่วน 1–2
};

export type Participation = {
  total_responses: number;
  with_comments: number;
  negative_comments: number; // rating ≤ 2 หรือมีคอมเมนต์
  actions_created: number;   // ไว้ต่อยอด ถ้ามีตาราง comment_actions
};

export type RatingDistribution = {
  r1: number; r2: number; r3: number; r4: number; r5: number;
};

/** ---------------- WHERE Builder ----------------
 * สร้างเงื่อนไขร่วมสำหรับทุก query ตามฟิลเตอร์จากผู้ใช้
 * - วันที่: from <= created_at < (to + 1 วัน)
 * - groups: r.user_group IN (...)
 * - departments: d.code IN (...)
 * - rating: a.rating BETWEEN rating_min..rating_max
 * - survey: r.survey_id = $1 (ค่าแรกเสมอ)
 */
function buildWhere(f: ExecFilters) {
  const params: any[] = [];
  const conds: string[] = [];

  // survey_id (บังคับเป็นอันดับแรกเพื่อ index)
  const surveyId = f.survey_id ?? 1;
  params.push(surveyId);
  conds.push(`r.survey_id = $${params.length}`);

  // from
  if (f.from) {
    params.push(f.from);
    conds.push(`r.created_at >= $${params.length}::date`);
  }
  // to (รวมทั้งวัน)
  if (f.to) {
    params.push(f.to);
    conds.push(`r.created_at < ($${params.length}::date + INTERVAL '1 day')`);
  }

  // groups
  if (Array.isArray(f.groups) && f.groups.length > 0) {
    params.push(f.groups);
    conds.push(`r.user_group = ANY($${params.length}::text[])`);
  }

  // departments (รับเป็น code)
  if (Array.isArray(f.departments) && f.departments.length > 0) {
    params.push(f.departments);
    conds.push(`d.code = ANY($${params.length}::text[])`);
  }

  // rating range
  const rmin = typeof f.rating_min === "number" ? f.rating_min : 1;
  const rmax = typeof f.rating_max === "number" ? f.rating_max : 5;
  params.push(rmin, rmax);
  conds.push(`(a.rating BETWEEN $${params.length - 1} AND $${params.length})`);

  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  return { where, params };
}

/** ---------------- 1) Overview ---------------- **/
export async function getOverview(f: ExecFilters): Promise<Overview> {
  const { where, params } = buildWhere(f);

  // หน่วยงานที่ "มีข้อมูล" ตามช่วง/ฟิลเตอร์
  const deptSql = `
    SELECT COUNT(DISTINCT d.id)::int AS departments_count
    FROM responses r
    JOIN departments d ON d.id = r.department_id
    JOIN answers a     ON a.response_id = r.id
    ${where};
  `;

  const respSql = `
    SELECT COUNT(DISTINCT r.id)::int AS responses_count
    FROM responses r
    JOIN answers a ON a.response_id = r.id
    JOIN departments d ON d.id = r.department_id
    ${where};
  `;

  // คะแนนรวม + สัดส่วนสูง/ต่ำ
  const scoreSql = `
    SELECT
      ROUND(AVG(a.rating)::numeric, 2)::float AS avg_score,
      COALESCE(SUM(CASE WHEN a.rating IN (4,5) THEN 1 ELSE 0 END)::float / NULLIF(COUNT(a.id),0), 0) AS pct_high,
      COALESCE(SUM(CASE WHEN a.rating IN (1,2) THEN 1 ELSE 0 END)::float / NULLIF(COUNT(a.id),0), 0) AS pct_low
    FROM responses r
    JOIN answers a ON a.response_id = r.id
    JOIN departments d ON d.id = r.department_id
    ${where};
  `;

  // จำนวน surveys & questions ทั้งระบบ (ไม่อิงช่วงเวลา)
  const sysSql = `
    SELECT
      (SELECT COUNT(*)::int FROM surveys) AS surveys_count,
      (SELECT COUNT(*)::int FROM questions) AS questions_count
  `;

  const [deptRow, respRow, scoreRow, sysRow] = await Promise.all([
    db.one(deptSql, params),
    db.one(respSql, params),
    db.one(scoreSql, params),
    db.one(sysSql)
  ]);

  return {
    departments_count: deptRow.departments_count || 0,
    surveys_count: sysRow.surveys_count || 0,
    questions_count: sysRow.questions_count || 0,
    responses_count: respRow.responses_count || 0,
    avg_score: scoreRow.avg_score ?? null,
    pct_high: Number(scoreRow.pct_high) || 0,
    pct_low: Number(scoreRow.pct_low) || 0
  };
}

/** ---------------- 2) Participation ---------------- **/
export async function getParticipation(f: ExecFilters): Promise<Participation> {
  const { where, params } = buildWhere(f);

  // หมายเหตุ: ใช้ DISTINCT r.id เพื่อวัดระดับ "ครั้งการทำ" ไม่ใช่จำนวนแถวคำตอบ
  const sql = `
    WITH base AS (
      SELECT r.id AS response_id, a.rating, a.comment
      FROM responses r
      JOIN answers a ON a.response_id = r.id
      JOIN departments d ON d.id = r.department_id
      ${where}
    )
    SELECT
      (SELECT COUNT(DISTINCT response_id)::int FROM base) AS total_responses,
      (SELECT COUNT(DISTINCT response_id)::int FROM base WHERE comment IS NOT NULL AND comment <> '') AS with_comments,
      (
        SELECT COUNT(DISTINCT response_id)::int
        FROM base
        WHERE (rating IS NOT NULL AND rating <= 2) OR (comment IS NOT NULL AND comment <> '')
      ) AS negative_comments
  `;
  const row = await db.one(sql, params);

  // actions_created: ถ้าอนาคตมีตาราง comment_actions ให้คิวรีจริง
  return {
    total_responses: row.total_responses || 0,
    with_comments: row.with_comments || 0,
    negative_comments: row.negative_comments || 0,
    actions_created: 0
  };
}

/** ---------------- 3) Rating Distribution ---------------- **/
export async function getRatingDistribution(f: ExecFilters): Promise<RatingDistribution> {
  const { where, params } = buildWhere(f);
  const sql = `
    SELECT
      SUM(CASE WHEN a.rating = 1 THEN 1 ELSE 0 END)::int AS r1,
      SUM(CASE WHEN a.rating = 2 THEN 1 ELSE 0 END)::int AS r2,
      SUM(CASE WHEN a.rating = 3 THEN 1 ELSE 0 END)::int AS r3,
      SUM(CASE WHEN a.rating = 4 THEN 1 ELSE 0 END)::int AS r4,
      SUM(CASE WHEN a.rating = 5 THEN 1 ELSE 0 END)::int AS r5
    FROM responses r
    JOIN answers a ON a.response_id = r.id
    JOIN departments d ON d.id = r.department_id
    ${where};
  `;
  const row = await db.one(sql, params);
  return {
    r1: row.r1 || 0,
    r2: row.r2 || 0,
    r3: row.r3 || 0,
    r4: row.r4 || 0,
    r5: row.r5 || 0
  };
}
