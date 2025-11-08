// src/server/controllers/comments.controller.ts
import { db } from "../db.config";

/** ---------------- Sentiment Logic ---------------- */
export type Sentiment = "positive" | "neutral" | "negative";

const POSITIVE_RE = /(ดี(?:มาก|เยี่ยม)?|พอใจ|ยอดเยี่ยม|ประทับใจ|ชอบ|สะดวก|รวดเร็ว|เหมาะสม|เป็นกันเอง|น่าประทับใจ|ตอบเร็ว|ช่วยเหลือดี)/i;
const NEGATIVE_RE = /(แย่|ไม่ดี|ช้า|เสียใจ|ผิดหวัง|ห่วย|แย่มาก|แย่มากๆ|ช้ามาก|ไม่พอใจ|ยุ่งยาก|ซับซ้อน|รอคิวนาน|บริการแย่|ไม่สะดวก|ไม่เหมาะสม|รอนาน|ตอบช้า)/i;

export function classifySentiment(text: string | null | undefined): Sentiment {
  const t = (text || "").trim();
  if (!t) return "neutral";
  if (POSITIVE_RE.test(t)) return "positive";
  if (NEGATIVE_RE.test(t)) return "negative";
  return "neutral";
}

/** -------------- Theme Extraction (ง่าย ๆ) -------------- */
const THEME_MAP: Record<string, RegExp> = {
  "ความรวดเร็ว": /(เร็ว|รวดเร็ว|ไว|ตอบเร็ว|ดำเนินการเร็ว)/i,
  "ความสุภาพ": /(สุภาพ|อัธยาศัย|เป็นกันเอง|ยิ้มแย้ม)/i,
  "ความสะดวก/ขั้นตอน": /(สะดวก|ขั้นตอน|ยุ่งยาก|ซับซ้อน)/i,
  "การสื่อสาร/ข้อมูล": /(สื่อสาร|อธิบาย|ข้อมูล|ไม่ชัดเจน|แจ้ง)/i,
  "การรอคอย/คิว": /(คิว|รอนาน|รอคิวนาน)/i,
  "ระบบออนไลน์": /(ออนไลน์|เว็บไซต์|ระบบ|แอป|แอพ)/i,
  "สถานที่/สิ่งอำนวยความสะดวก": /(สถานที่|สะอาด|สิ่งอำนวยความสะดวก)/i,
};

export function extractThemes(text: string | null | undefined): string[] {
  const t = (text || "").trim();
  if (!t) return [];
  const matched: string[] = [];
  for (const [name, re] of Object.entries(THEME_MAP)) {
    if (re.test(t)) matched.push(name);
  }
  return matched;
}

/** ---------------- Types for API ---------------- */
export type CommentRow = {
  answer_id: number;
  department_code: string;
  department_name: string;
  user_group: string;
  created_at: string;
  question_text: string;
  comment: string;
  sentiment: Sentiment;
  sentiment_score: number | null; // (+1, 0, -1 แบบง่าย)
  themes: string[];
};

export type Summary = {
  bySent: { sentiment: Sentiment; cnt: number }[];
  byTheme: { theme: string; cnt: number }[];
};

/** ---------------- Search Comments ----------------
 * params:
 *  - department_code?  : string   (จำกัดเฉพาะหน่วยงาน)
 *  - survey_id         : number   (required)
 *  - q?                : string   (fulltext-like)
 *  - sentiment?        : "positive"|"neutral"|"negative"
 *  - limit?, offset?   : number
 */
export async function searchComments(params: {
  department_code?: string;
  survey_id: number;
  q?: string;
  sentiment?: Sentiment | "";
  limit?: number;
  offset?: number;
}): Promise<CommentRow[]> {
  const {
    department_code,
    survey_id,
    q,
    sentiment,
    limit = 100,
    offset = 0,
  } = params;

  const conds: string[] = [
    "r.survey_id = $1",
    "qz.type = 'text'", // เฉพาะข้อแบบ comment
    "COALESCE(NULLIF(TRIM(a.comment), ''), NULL) IS NOT NULL",
  ];
  const args: any[] = [survey_id];

  if (department_code) {
    conds.push("d.code = $2");
    args.push(department_code);
  }

  // ค้นคำแบบง่าย ๆ ทั้งใน comment และ question_text
  if (q && q.trim()) {
    const idx = args.length + 1;
    conds.push(`(a.comment ILIKE $${idx} OR qz.text ILIKE $${idx})`);
    args.push(`%${q.trim()}%`);
  }

  const sql = `
    SELECT
      a.id AS answer_id,
      d.code AS department_code,
      d.name AS department_name,
      r.user_group,
      r.created_at,
      qz.text AS question_text,
      a.comment
    FROM answers a
    JOIN responses r ON r.id = a.response_id
    JOIN questions qz ON qz.id = a.question_id
    JOIN departments d ON d.id = r.department_id
    WHERE ${conds.join(" AND ")}
    ORDER BY r.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const rows = await db.any(sql, args);

  // post-process sentiment + themes
  let out = rows.map((row: any) => {
    const s = classifySentiment(row.comment);
    const score = s === "positive" ? 1 : s === "negative" ? -1 : 0;
    const themes = extractThemes(row.comment);
    const obj: CommentRow = {
      answer_id: Number(row.answer_id),
      department_code: String(row.department_code),
      department_name: String(row.department_name),
      user_group: String(row.user_group),
      created_at: row.created_at,
      question_text: String(row.question_text),
      comment: String(row.comment),
      sentiment: s,
      sentiment_score: score,
      themes,
    };
    return obj;
  });

  // ฟิลเตอร์ตาม sentiment (หลังจาก classify แล้ว)
  if (sentiment === "positive" || sentiment === "neutral" || sentiment === "negative") {
    out = out.filter((x) => x.sentiment === sentiment);
  }

  return out;
}

/** ---------------- Summary ----------------
 * params:
 *  - department_code?: string
 *  - survey_id: number
 *  - q?: string
 *  - sentiment?: Sentiment|""
 *  คืนโครงสร้าง { bySent, byTheme }
 */
export async function getCommentsSummary(params: {
  department_code?: string;
  survey_id: number;
  q?: string;
  sentiment?: Sentiment | "";
}): Promise<Summary> {
  const items = await searchComments({
    department_code: params.department_code,
    survey_id: params.survey_id,
    q: params.q,
    sentiment: params.sentiment ?? "",
    limit: 5000, // เพื่อให้รวมสถิติครบในหน้า
    offset: 0,
  });

  // นับตาม sentiment
  const bySentCount: Record<Sentiment, number> = {
    positive: 0,
    neutral: 0,
    negative: 0,
  };
  // นับตามธีม
  const themeCount: Record<string, number> = {};

  for (const it of items) {
    bySentCount[it.sentiment] = (bySentCount[it.sentiment] ?? 0) + 1;
    for (const th of it.themes) {
      themeCount[th] = (themeCount[th] ?? 0) + 1;
    }
  }

  return {
    bySent: (["positive", "neutral", "negative"] as Sentiment[]).map((s) => ({
      sentiment: s,
      cnt: bySentCount[s] ?? 0,
    })),
    byTheme: Object.entries(themeCount)
      .map(([theme, cnt]) => ({ theme, cnt }))
      .sort((a, b) => b.cnt - a.cnt),
  };
}

// ------- Actions (CRUD) -------

export type ActionRow = {
  id: number;
  answer_id: number;
  department_id: number;
  department_code: string;
  department_name: string;
  title: string;
  status: "open" | "in_progress" | "done";
  assignee: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export async function listActions(params: {
  department_code?: string;
  status?: "open" | "in_progress" | "done";
  limit?: number;
  offset?: number;
}): Promise<ActionRow[]> {
  const { department_code, status, limit = 200, offset = 0 } = params;

  const conds: string[] = ["1=1"];
  const args: any[] = [];

  if (department_code) {
    conds.push(`d.code = $${args.length + 1}`);
    args.push(department_code);
  }
  if (status) {
    conds.push(`a.status = $${args.length + 1}`);
    args.push(status);
  }

  const sql = `
    SELECT
      a.id,
      a.answer_id,
      a.department_id,
      d.code AS department_code,
      d.name AS department_name,
      a.title,
      a.status,
      a.assignee,
      a.notes,
      a.created_at,
      a.updated_at
    FROM comment_actions a
    JOIN departments d ON d.id = a.department_id
    WHERE ${conds.join(" AND ")}
    ORDER BY a.updated_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  return db.any(sql, args);
}

export async function createAction(params: {
  answer_id: number;
  department_id: number;
  title: string;
  assignee?: string | null;
  notes?: string | null;
}): Promise<{ ok: true; id: number } | { error: string }> {
  const { answer_id, department_id, title, assignee = null, notes = null } = params;
  if (!answer_id || !department_id || !title?.trim()) {
    return { error: "ข้อมูลไม่ครบ (answer_id, department_id, title)" };
  }

  const ins = await db.one(
    `INSERT INTO comment_actions (answer_id, department_id, title, assignee, notes)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [answer_id, department_id, title.trim(), assignee, notes]
  );
  return { ok: true, id: ins.id as number };
}

export async function updateAction(params: {
  id: number;
  status?: "open" | "in_progress" | "done";
  title?: string;
  assignee?: string | null;
  notes?: string | null;
}): Promise<{ ok: true } | { error: string }> {
  const { id, status, title, assignee, notes } = params;
  if (!id) return { error: "ต้องระบุ id" };

  const sets: string[] = [];
  const args: any[] = [];

  if (status) {
    sets.push(`status = $${args.length + 1}`);
    args.push(status);
  }
  if (typeof title === "string") {
    sets.push(`title = $${args.length + 1}`);
    args.push(title.trim());
  }
  if (typeof assignee !== "undefined") {
    sets.push(`assignee = $${args.length + 1}`);
    args.push(assignee);
  }
  if (typeof notes !== "undefined") {
    sets.push(`notes = $${args.length + 1}`);
    args.push(notes);
  }

  if (!sets.length) return { error: "ไม่มีฟิลด์ให้ปรับปรุง" };

  // updated_at = NOW()
  sets.push(`updated_at = NOW()`);

  args.push(id);
  const sql = `UPDATE comment_actions SET ${sets.join(", ")} WHERE id = $${args.length}`;
  await db.none(sql, args);
  return { ok: true };
}