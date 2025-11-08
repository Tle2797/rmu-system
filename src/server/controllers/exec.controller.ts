// src/server/controllers/exec.controller.ts
import { db } from "../db.config";

/** ---------- Types ---------- */
export type RankRow = {
  department_code: string;
  department_name: string;
  score: number | null;
  answers: number;
  pct_high: number; // 0..1
  pct_low: number;  // 0..1
};

export type HeatCell = {
  department_code: string;
  department_name: string;
  question_id: number;
  question_text: string;
  avg_rating: number | null;
};

export type TrendPoint = {
  bucket: string; // YYYY-MM-DD หรือ YYYY-MM
  avg_rating: number | null;
  answers: number;
};

/** ---------- Helpers ---------- */
function toArray<T>(v: any): T[] {
  if (Array.isArray(v)) return v as T[];
  if (v == null) return [];
  return [v as T];
}

/**
 * NOTE: จุดสำคัญของ requirement นี้คือ
 * - ใช้ LEFT JOIN จาก departments -> responses -> answers
 * - ใส่ "ทุกเงื่อนไข" ลงใน ON ของ JOIN (ไม่ใส่ใน WHERE)
 *   เพื่อไม่ให้ตัดหน่วยงานที่ยังไม่มีข้อมูลออก
 */
export async function getRank(query: any): Promise<RankRow[]> {
  const surveyId = Number(query?.survey_id ?? 1);
  const from = (query?.from as string) || undefined; // "YYYY-MM-DD"
  const to   = (query?.to as string)   || undefined; // "YYYY-MM-DD"
  const userGroups = toArray<string>(query?.user_groups); // ["นักศึกษา","บุคลากร"] ...
  const ratingMin =
    query?.rating_min != null ? Number(query.rating_min) : undefined;
  const ratingMax =
    query?.rating_max != null ? Number(query.rating_max) : undefined;

  const params: any[] = [];

  // --- ON clauses for responses
  const onResp: string[] = [];
  onResp.push(`r.survey_id = $${params.push(surveyId)}`);
  if (from) onResp.push(`r.created_at >= $${params.push(from + " 00:00:00")}`);
  if (to)   onResp.push(`r.created_at <  $${params.push(to   + " 00:00:00")}`);
  if (userGroups.length) {
    onResp.push(`r.user_group = ANY($${params.push(userGroups)})`);
  }

  // --- ON clauses for answers
  const onAns: string[] = [];
  if (typeof ratingMin === "number") {
    onAns.push(`a.rating >= $${params.push(ratingMin)}`);
  }
  if (typeof ratingMax === "number") {
    onAns.push(`a.rating <= $${params.push(ratingMax)}`);
  }

  const sql = `
    SELECT
      d.code AS department_code,
      d.name AS department_name,
      -- คะแนนเฉลี่ย: เป็น NULL ถ้าไม่มีคำตอบเลย (ไม่ใช้ COALESCE ตรงนี้เพื่อบอกว่า "ยังไม่มีข้อมูล")
      AVG(a.rating)::numeric(10,4) AS score,
      -- จำนวนคำตอบทั้งหมดตามฟิลเตอร์
      COUNT(a.id)::int AS answers,
      -- % สูง (4–5) ถ้าไม่มีคำตอบ -> 0
      COALESCE(AVG(CASE WHEN a.rating >= 4 THEN 1.0 ELSE 0.0 END), 0)::float AS pct_high,
      -- % ต่ำ (1–2) ถ้าไม่มีคำตอบ -> 0
      COALESCE(AVG(CASE WHEN a.rating IS NOT NULL AND a.rating <= 2 THEN 1.0 ELSE 0.0 END), 0)::float AS pct_low
    FROM departments d
    LEFT JOIN responses r
      ON r.department_id = d.id
     ${onResp.length ? "AND " + onResp.join(" AND ") : ""}
    LEFT JOIN answers a
      ON a.response_id = r.id
     ${onAns.length ? "AND " + onAns.join(" AND ") : ""}
    GROUP BY d.code, d.name
    ORDER BY score DESC NULLS LAST, answers DESC, d.name ASC
  `;

  const rows = await db.any(sql, params);
  return rows.map((r: any) => ({
    department_code: r.department_code,
    department_name: r.department_name,
    score: r.score === null ? null : Number(r.score),
    answers: Number(r.answers) || 0,
    pct_high: Number(r.pct_high) || 0,
    pct_low: Number(r.pct_low) || 0,
  }));
}

/**
 * Heatmap เดิม (ยังใช้เฉพาะหน่วยงานที่มีคำตอบเท่านั้น)
 * ถ้าต้องการให้ทุกหน่วยงาน x ทุกคำถามโผล่ครบ ต้อง CROSS JOIN กับชุดคำถามของ survey
 * ซึ่งสามารถเพิ่มในอนาคตได้
 */
export async function getHeatmap(query: any): Promise<HeatCell[]> {
  const surveyId = Number(query?.survey_id ?? 1);
  const from = (query?.from as string) || undefined;
  const to   = (query?.to as string)   || undefined;
  const userGroups = toArray<string>(query?.user_groups);
  const ratingMin =
    query?.rating_min != null ? Number(query.rating_min) : undefined;
  const ratingMax =
    query?.rating_max != null ? Number(query.rating_max) : undefined;

  const params: any[] = [];

  const onResp: string[] = [];
  onResp.push(`r.survey_id = $${params.push(surveyId)}`);
  if (from) onResp.push(`r.created_at >= $${params.push(from + " 00:00:00")}`);
  if (to)   onResp.push(`r.created_at <  $${params.push(to   + " 00:00:00")}`);
  if (userGroups.length) {
    onResp.push(`r.user_group = ANY($${params.push(userGroups)})`);
  }

  const onAns: string[] = [];
  if (typeof ratingMin === "number") onAns.push(`a.rating >= $${params.push(ratingMin)}`);
  if (typeof ratingMax === "number") onAns.push(`a.rating <= $${params.push(ratingMax)}`);

  const sql = `
    SELECT
      d.code  AS department_code,
      d.name  AS department_name,
      q.id    AS question_id,
      q.text  AS question_text,
      AVG(a.rating)::numeric(10,4) AS avg_rating
    FROM departments d
    LEFT JOIN responses r
      ON r.department_id = d.id
     AND ${onResp.join(" AND ")}
    LEFT JOIN answers a
      ON a.response_id = r.id
     ${onAns.length ? "AND " + onAns.join(" AND ") : ""}
    JOIN questions q
      ON q.id = a.question_id
     AND q.type = 'rating'
    GROUP BY d.code, d.name, q.id, q.text
    ORDER BY d.code ASC, q.id ASC
  `;

  const rows = await db.any(sql, params);
  return rows.map((r: any) => ({
    department_code: r.department_code,
    department_name: r.department_name,
    question_id: Number(r.question_id),
    question_text: r.question_text,
    avg_rating: r.avg_rating === null ? null : Number(r.avg_rating),
  }));
}

export async function getTrend(query: any): Promise<TrendPoint[]> {
  const surveyId = Number(query?.survey_id ?? 1);
  const from = (query?.from as string) || undefined;
  const to   = (query?.to as string)   || undefined;
  const group = (query?.group as "day" | "month") === "month" ? "month" : "day";
  const userGroups = toArray<string>(query?.user_groups);
  const ratingMin =
    query?.rating_min != null ? Number(query.rating_min) : undefined;
  const ratingMax =
    query?.rating_max != null ? Number(query.rating_max) : undefined;

  const params: any[] = [];

  const onResp: string[] = [];
  onResp.push(`r.survey_id = $${params.push(surveyId)}`);
  if (from) onResp.push(`r.created_at >= $${params.push(from + " 00:00:00")}`);
  if (to)   onResp.push(`r.created_at <  $${params.push(to   + " 00:00:00")}`);
  if (userGroups.length) {
    onResp.push(`r.user_group = ANY($${params.push(userGroups)})`);
  }

  const onAns: string[] = [];
  if (typeof ratingMin === "number") onAns.push(`a.rating >= $${params.push(ratingMin)}`);
  if (typeof ratingMax === "number") onAns.push(`a.rating <= $${params.push(ratingMax)}`);

  const fmt = group === "month" ? "YYYY-MM" : "YYYY-MM-DD";
  const trunc = group === "month" ? "month" : "day";

  const sql = `
    SELECT
      TO_CHAR(date_trunc('${trunc}', r.created_at), '${fmt}') AS bucket,
      AVG(a.rating)::numeric(10,4) AS avg_rating,
      COUNT(a.id)::int AS answers
    FROM responses r
    LEFT JOIN answers a
      ON a.response_id = r.id
     ${onAns.length ? "AND " + onAns.join(" AND ") : ""}
    WHERE ${onResp.join(" AND ")}
    GROUP BY date_trunc('${trunc}', r.created_at)
    ORDER BY date_trunc('${trunc}', r.created_at) ASC
  `;

  const rows = await db.any(sql, params);
  return rows.map((r: any) => ({
    bucket: r.bucket,
    avg_rating: r.avg_rating === null ? null : Number(r.avg_rating),
    answers: Number(r.answers) || 0,
  }));
}
