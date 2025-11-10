// src/server/controllers/dashboard.controller.ts
import { db } from "../db.config";
import ExcelJS from "exceljs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { promises as fs } from "fs";

/** รูปแบบข้อมูลแถวสรุปต่อคำถาม */
export type SummaryRow = {
  question_id: number;
  question_text: string;
  question_type: "rating" | "text";
  avg_rating: number | null;
  answers_count: number;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  r5: number | null;
};

export type DeptSummary =
  | { department_id: number; department_name: string; items: SummaryRow[] }
  | { error: string };

export type DeptComments =
  | {
      department_id: number;
      items: Array<{
        comment: string;
        question_id: number;
        question_text: string;
        user_group: string;
        created_at: string;
      }>;
    }
  | { error: string };

/** ✅ รูปแบบข้อมูลสรุปผลรายปี (ให้ตรงกับหน้า yearly) */
export type DeptYearlyItem = {
  year: number;
  avg_rating: number | null;
  responses_count: number; // จำนวนผู้ทำแบบประเมิน (DISTINCT responses)
  answers_count: number;   // จำนวนคำตอบทั้งหมด (rows ใน answers)
};

export type DeptYearlyStats =
  | {
      department_id: number;
      department_name: string;
      items: DeptYearlyItem[];
    }
  | { error: string };

/* ===========================================================
   ✅ Helper: แปลง "to (inclusive)" -> "toExclusive (exclusive)"
   =========================================================== */
function toExclusiveDate(to?: string): string | undefined {
  if (!to) return undefined;
  const d = new Date(to + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/* ===========================================================
   1) สรุปผลรายคำถามของ "หน่วยงานหนึ่ง"
   - from >= from::date
   - to   < (to+1)::date
   - ✅ answers_count:
       * type='rating' → นับทุกคำตอบของข้อ
       * type='text'   → นับเฉพาะ comment ที่ไม่ว่าง
   =========================================================== */
export const getDeptSummary = async (
  code: string,
  surveyId: number,
  from?: string,
  to?: string
): Promise<DeptSummary> => {
  const dep = await db.oneOrNone(
    "SELECT id, name FROM departments WHERE code = $1",
    [code]
  );
  if (!dep) return { error: "ไม่พบหน่วยงานนี้" };

  const toEx = toExclusiveDate(to);

  const conds: string[] = ["q.survey_id = $1", "r.department_id = $2"];
  const params: any[] = [surveyId, dep.id];

  if (from) {
    params.push(from);
    conds.push(`r.created_at >= $${params.length}::date`);
  }
  if (toEx) {
    params.push(toEx);
    conds.push(`r.created_at < $${params.length}::date`);
  }

  const sql = `
    SELECT
      q.id   AS question_id,
      q.text AS question_text,
      q.type AS question_type,
      ROUND(AVG(a.rating)::numeric, 2) AS avg_rating,

      -- ✅ นับจำนวนคำตอบแบบแยกตามประเภทคำถาม
      CASE 
        WHEN q.type = 'text' THEN
          -- เฉพาะ comment ที่ไม่ว่าง
          COUNT(NULLIF(TRIM(COALESCE(a.comment, '')), ''))
        ELSE
          -- คำถามให้คะแนน: นับทุกแถวคำตอบ
          COUNT(a.id)
      END AS answers_count,

      SUM(CASE WHEN a.rating = 1 THEN 1 ELSE 0 END) AS r1,
      SUM(CASE WHEN a.rating = 2 THEN 1 ELSE 0 END) AS r2,
      SUM(CASE WHEN a.rating = 3 THEN 1 ELSE 0 END) AS r3,
      SUM(CASE WHEN a.rating = 4 THEN 1 ELSE 0 END) AS r4,
      SUM(CASE WHEN a.rating = 5 THEN 1 ELSE 0 END) AS r5
    FROM questions q
    LEFT JOIN answers a ON a.question_id = q.id
    LEFT JOIN responses r ON r.id = a.response_id
    WHERE ${conds.join(" AND ")}
    GROUP BY q.id, q.text, q.type
    ORDER BY q.id ASC
  `;

  const items = await db.any<SummaryRow>(sql, params);
  return {
    department_id: dep.id as number,
    department_name: dep.name as string,
    items,
  };
};

/* ===========================================================
   2) คอมเมนต์ (เฉพาะคำถาม type='text') ของหน่วยงาน
   =========================================================== */
export const getDeptComments = async (
  code: string,
  surveyId: number,
  limit = 50,
  offset = 0,
  from?: string,
  to?: string
): Promise<DeptComments> => {
  const dep = await db.oneOrNone("SELECT id FROM departments WHERE code = $1", [
    code,
  ]);
  if (!dep) return { error: "ไม่พบหน่วยงานนี้" };

  const toEx = toExclusiveDate(to);

  const conds: string[] = [
    "r.survey_id = $1",
    "r.department_id = $2",
    "q.type = 'text'",
  ];
  const params: any[] = [surveyId, dep.id];

  if (from) {
    params.push(from);
    conds.push(`r.created_at >= $${params.length}::date`);
  }
  if (toEx) {
    params.push(toEx);
    conds.push(`r.created_at < $${params.length}::date`);
  }
  params.push(limit);
  params.push(offset);

  const sql = `
    SELECT
      a.comment, a.question_id,
      q.text AS question_text,
      r.user_group,
      r.created_at
    FROM answers a
    JOIN responses r ON r.id = a.response_id
    JOIN questions q ON q.id = a.question_id
    WHERE ${conds.join(" AND ")}
      AND COALESCE(NULLIF(TRIM(a.comment), ''), NULL) IS NOT NULL
    ORDER BY r.created_at DESC
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;

  const items = await db.any(sql, params);
  return { department_id: dep.id as number, items };
};

/* ===========================================================
   3) Export Excel (.xlsx)
   - ใช้ answers_count ตาม logic ใหม่
   =========================================================== */
export const exportDeptExcel = async (
  code: string,
  surveyId: number,
  from?: string,
  to?: string
): Promise<ArrayBuffer | { error: string }> => {
  const summary = await getDeptSummary(code, surveyId, from, to);
  if ("error" in summary) return summary;

  const comments = await getDeptComments(code, surveyId, 1000, 0, from, to);
  if ("error" in comments) return comments;

  const wb = new ExcelJS.Workbook();

  const ws1 = wb.addWorksheet("Summary", {
    views: [{ state: "frozen", xSplit: 0, ySplit: 4 }],
  });

  ws1.mergeCells("A1", "L1");
  ws1.mergeCells("A2", "L2");
  ws1.mergeCells("A3", "L3");

  ws1.getCell("A1").value = `รายงานความพึงพอใจในการให้บริการ`;
  ws1.getCell("A2").value = `หน่วยงาน: ${summary.department_name} (${code})`;
  ws1.getCell("A3").value = `Survey ID: ${surveyId} | ช่วงวันที่: ${
    from || "-"
  } ถึง ${to || "-"}`;

  [1, 2, 3].forEach((r) => {
    const cell = ws1.getCell(`A${r}`);
    cell.font = { name: "Sarabun", bold: r === 1, size: r === 1 ? 14 : 11 };
    cell.alignment = { vertical: "middle", horizontal: "left" };
  });

  const headerRow = ws1.getRow(4);
  headerRow.values = [
    "QID",
    "คำถาม",
    "ประเภท",
    "เฉลี่ย",
    "จำนวน",
    "1★",
    "2★",
    "3★",
    "4★",
    "5★",
    "% สูง (4–5)",
    "% ต่ำ (1–2)",
  ];

  ws1.columns = [
    { key: "qid", width: 8 },
    { key: "qtext", width: 60 },
    { key: "qtype", width: 10 },
    { key: "avg", width: 10 },
    { key: "count", width: 12 },
    { key: "r1", width: 8 },
    { key: "r2", width: 8 },
    { key: "r3", width: 8 },
    { key: "r4", width: 8 },
    { key: "r5", width: 8 },
    { key: "pctHigh", width: 12 },
    { key: "pctLow", width: 12 },
  ];

  headerRow.font = { name: "Sarabun", bold: true };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 20;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  });

  let rowIdx = 5;
  summary.items.forEach((it) => {
    const r1 = Number(it.r1 || 0),
      r2 = Number(it.r2 || 0),
      r3 = Number(it.r3 || 0),
      r4 = Number(it.r4 || 0),
      r5 = Number(it.r5 || 0);
    const total = r1 + r2 + r3 + r4 + r5;

    const pctHigh = total ? (r4 + r5) / total : 0;
    const pctLow = total ? (r1 + r2) / total : 0;

    ws1.addRow({
      qid: it.question_id,
      qtext: it.question_text,
      qtype: it.question_type,
      avg: it.avg_rating ?? null,
      count: it.answers_count ?? 0,
      r1,
      r2,
      r3,
      r4,
      r5,
      pctHigh,
      pctLow,
    });

    const row = ws1.getRow(rowIdx);
    row.font = { name: "Sarabun", size: 11 };
    row.alignment = { vertical: "top" };

    row.eachCell((cell, colNumber) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E5E5" } },
        left: { style: "thin", color: { argb: "FFE5E5E5" } },
        bottom: { style: "thin", color: { argb: "FFE5E5E5" } },
        right: { style: "thin", color: { argb: "FFE5E5E5" } },
      };

      if (
        [
          "avg",
          "count",
          "r1",
          "r2",
          "r3",
          "r4",
          "r5",
          "pctHigh",
          "pctLow",
        ].includes(ws1.columns[colNumber - 1].key as string)
      ) {
        cell.alignment = { vertical: "top", horizontal: "center" };
      }
    });

    ws1.getCell(`B${rowIdx}`).alignment = { wrapText: true, vertical: "top" };
    ws1.getCell(`D${rowIdx}`).numFmt = "0.00";
    ws1.getCell(`K${rowIdx}`).numFmt = "0.0%";
    ws1.getCell(`L${rowIdx}`).numFmt = "0.0%";

    rowIdx++;
  });

  ws1.autoFilter = {
    from: { row: 4, column: 1 },
    to: { row: 4, column: 12 },
  };

  const ws2 = wb.addWorksheet("Comments", {
    views: [{ state: "frozen", ySplit: 2 }],
  });

  ws2.mergeCells("A1", "D1");
  ws2.getCell("A1").value = `ความคิดเห็น (หน่วยงาน: ${
    summary.department_name
  } – ${code})  ช่วงวันที่: ${from || "-"} ถึง ${to || "-"}`;
  ws2.getCell("A1").font = { name: "Sarabun", bold: true, size: 12 };

  const header2 = ws2.getRow(2);
  header2.values = ["วันที่", "กลุ่มผู้ใช้", "ข้อ", "ความคิดเห็น"];
  ws2.columns = [
    { key: "date", width: 22 },
    { key: "group", width: 16 },
    { key: "qid", width: 8 },
    { key: "comment", width: 80 },
  ];
  header2.font = { name: "Sarabun", bold: true };
  header2.alignment = { vertical: "middle", horizontal: "center" };
  header2.height = 18;
  header2.eachCell((cell) => {
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFEFEFEF" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFBFBFBF" } },
      left: { style: "thin", color: { argb: "FFBFBFBF" } },
      bottom: { style: "thin", color: { argb: "FFBFBFBF" } },
      right: { style: "thin", color: { argb: "FFBFBFBF" } },
    };
  });

  let r = 3;
  comments.items.forEach((c) => {
    ws2.addRow({
      date: new Date(c.created_at),
      group: c.user_group,
      qid: c.question_id,
      comment: c.comment,
    });

    const row = ws2.getRow(r);
    row.font = { name: "Sarabun", size: 11 };
    row.alignment = { vertical: "top" };

    ws2.getCell(`A${r}`).numFmt = "yyyy-mm-dd hh:mm";
    ws2.getCell(`D${r}`).alignment = { wrapText: true, vertical: "top" };

    row.eachCell((cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFE5E5E5" } },
        left: { style: "thin", color: { argb: "FFE5E5E5" } },
        bottom: { style: "thin", color: { argb: "FFE5E5E5" } },
        right: { style: "thin", color: { argb: "FFE5E5E5" } },
      };
    });

    r++;
  });

  ws2.autoFilter = {
    from: { row: 2, column: 1 },
    to: { row: 2, column: 4 },
  };

  const buf = await wb.xlsx.writeBuffer();
  return buf;
};

/* ===========================================================
   4) Export PDF (.pdf)
   =========================================================== */
export const exportDeptPdf = async (
  code: string,
  surveyId: number,
  from?: string,
  to?: string
): Promise<Uint8Array | { error: string }> => {
  const summary = await getDeptSummary(code, surveyId, from, to);
  if ("error" in summary) return summary;

  const comments = await getDeptComments(code, surveyId, 300, 0, from, to);
  if ("error" in comments) return comments;

  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const regularFontBytes = await fs.readFile(
    "./public/fonts/Sarabun-Regular.ttf"
  );
  const boldFontBytes = await fs.readFile("./public/fonts/Sarabun-Bold.ttf");

  const fontRegular = await pdf.embedFont(regularFontBytes, { subset: true });
  const fontBold = await pdf.embedFont(boldFontBytes, { subset: true });

  const pageWidth = 595;
  const pageHeight = 842;
  const margin = 40;
  const lineGap = 4;
  const headerSize = 16;
  const normalSize = 11;
  const smallSize = 10;

  const strokeGray = rgb(0.8, 0.8, 0.8);
  const textBlack = rgb(0, 0, 0);

  const addPage = () => pdf.addPage([pageWidth, pageHeight]);
  let page = addPage();
  let y = pageHeight - margin;

  const drawText = (
    text: string,
    x: number,
    size = normalSize,
    bold = false
  ) => {
    page.drawText(text, {
      x,
      y,
      size,
      font: bold ? fontBold : fontRegular,
      color: textBlack,
    });
  };

  const drawLine = (x1: number, y1: number, x2: number, y2: number) => {
    page.drawLine({
      start: { x: x1, y: y1 },
      end: { x: x2, y: y2 },
      thickness: 0.5,
      color: strokeGray,
    });
  };

  const drawRect = (x: number, yTop: number, w: number, h: number) => {
    page.drawRectangle({
      x,
      y: yTop - h,
      width: w,
      height: h,
      borderColor: strokeGray,
      borderWidth: 0.5,
    });
  };

  const ensureSpace = (need: number) => {
    if (y - need < margin + 40) {
      y = margin + 20;
      drawLine(margin, y, pageWidth - margin, y);
      y -= 10;
      drawText(`หน้าที่ ${pdf.getPageIndices().length}`, margin, smallSize);
      page = addPage();
      y = pageHeight - margin;
    }
  };

  const wrapText = (
    text: string,
    maxWidth: number,
    size = normalSize,
    bold = false
  ) => {
    const font = bold ? fontBold : fontRegular;
    const measure = (t: string) => font.widthOfTextAtSize(t, size);

    const words = (text || "").trim().length
      ? (text || "").split(/\s+/)
      : [text || ""];
    const lines: string[] = [];
    let line = "";

    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (measure(test) <= maxWidth) {
        line = test;
      } else {
        if (line) lines.push(line);
        let buf = "";
        for (const ch of w) {
          const test2 = buf ? buf + ch : ch;
          if (measure(test2) <= maxWidth) buf = test2;
          else {
            if (buf) lines.push(buf);
            buf = ch;
          }
        }
        line = buf;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  const title = "รายงานความพึงพอใจในการให้บริการ";
  const titleWidth = fontBold.widthOfTextAtSize(title, headerSize);
  const titleX = (pageWidth - titleWidth) / 2;
  page.drawText(title, {
    x: titleX,
    y,
    size: headerSize,
    font: fontBold,
    color: textBlack,
  });
  y -= headerSize + 8;

  drawText(
    `หน่วยงาน: ${summary.department_name} (${code})`,
    margin,
    normalSize
  );
  y -= normalSize + 2;
  drawText(
    `Survey ID: ${surveyId} | ช่วงวันที่: ${from || "-"} ถึง ${to || "-"}`,
    margin,
    normalSize
  );
  y -= normalSize + 10;

  drawText("สรุปคะแนนรายคำถาม", margin, 13, true);
  y -= 18;

  const colW = [45, 275, 60, 60, 60, 60];
  const colX: number[] = [margin];
  for (let i = 1; i < colW.length; i++) colX[i] = colX[i - 1] + colW[i - 1];

  const headerH = 20;
  ensureSpace(headerH + 8);

  for (let i = 0; i < colW.length; i++) drawRect(colX[i], y, colW[i], headerH);

  page.drawText("ข้อที่", {
    x: colX[0] + 4,
    y: y - 15,
    size: smallSize,
    font: fontBold,
  });
  page.drawText("คำถาม", {
    x: colX[1] + 4,
    y: y - 15,
    size: smallSize,
    font: fontBold,
  });
  page.drawText("เฉลี่ย", {
    x: colX[2] + 4,
    y: y - 15,
    size: smallSize,
    font: fontBold,
  });
  page.drawText("จำนวน", {
    x: colX[3] + 4,
    y: y - 15,
    size: smallSize,
    font: fontBold,
  });
  page.drawText("สูง", {
    x: colX[4] + 4,
    y: y - 15,
    size: smallSize,
    font: fontBold,
  });
  page.drawText("ต่ำ", {
    x: colX[5] + 4,
    y: y - 15,
    size: smallSize,
    font: fontBold,
  });

  y -= headerH;

  for (const it of summary.items) {
    const total =
      Number(it.r1 || 0) +
      Number(it.r2 || 0) +
      Number(it.r3 || 0) +
      Number(it.r4 || 0) +
      Number(it.r5 || 0);

    const high = total
      ? ((Number(it.r4 || 0) + Number(it.r5 || 0)) / total) * 100
      : 0;
    const low = total
      ? ((Number(it.r1 || 0) + Number(it.r2 || 0)) / total) * 100
      : 0;

    const qLines = wrapText(it.question_text || "-", colW[1] - 8, smallSize);
    const rowH = Math.max(18, qLines.length * (smallSize + lineGap) + 6);

    ensureSpace(rowH + 2);

    for (let i = 0; i < colW.length; i++) drawRect(colX[i], y, colW[i], rowH);

    page.drawText(String(it.question_id), {
      x: colX[0] + 4,
      y: y - 14,
      size: smallSize,
      font: fontRegular,
    });
    qLines.forEach((ln, i) => {
      page.drawText(ln, {
        x: colX[1] + 4,
        y: y - 14 - i * (smallSize + lineGap),
        size: smallSize,
        font: fontRegular,
      });
    });
    page.drawText(
      it.avg_rating != null ? String(it.avg_rating) : "-",
      {
        x: colX[2] + 4,
        y: y - 14,
        size: smallSize,
        font: fontRegular,
      }
    );
    page.drawText(String(it.answers_count ?? 0), {
      x: colX[3] + 4,
      y: y - 14,
      size: smallSize,
      font: fontRegular,
    });
    page.drawText(high.toFixed(1) + "%", {
      x: colX[4] + 4,
      y: y - 14,
      size: smallSize,
      font: fontRegular,
    });
    page.drawText(low.toFixed(1) + "%", {
      x: colX[5] + 4,
      y: y - 14,
      size: smallSize,
      font: fontRegular,
    });

    y -= rowH;
  }

  y -= 16;

  ensureSpace(30);
  drawText("ความคิดเห็นล่าสุด", margin, 13, true);
  y -= 18;

  if (comments.items.length === 0) {
    ensureSpace(16);
    drawText("— ยังไม่มีความคิดเห็น —", margin, normalSize);
  } else {
    const cW = [140, 80, 40, 255];
    const cX: number[] = [margin];
    for (let i = 1; i < cW.length; i++) cX[i] = cX[i - 1] + cW[i - 1];

    const headerH2 = 20;

    ensureSpace(headerH2 + 8);
    for (let i = 0; i < cW.length; i++) drawRect(cX[i], y, cW[i], headerH2);

    page.drawText("วันที่", {
      x: cX[0] + 4,
      y: y - 15,
      size: smallSize,
      font: fontBold,
    });
    page.drawText("กลุ่มผู้ใช้", {
      x: cX[1] + 4,
      y: y - 15,
      size: smallSize,
      font: fontBold,
    });
    page.drawText("ข้อ", {
      x: cX[2] + 4,
      y: y - 15,
      size: smallSize,
      font: fontBold,
    });
    page.drawText("ความคิดเห็น", {
      x: cX[3] + 4,
      y: y - 15,
      size: smallSize,
      font: fontBold,
    });

    y -= headerH2;

    for (const cm of comments.items) {
      const dateStr = new Date(cm.created_at).toLocaleString("th-TH");
      const commentLines = wrapText(
        cm.comment || "-",
        cW[3] - 8,
        smallSize
      );
      const rowH = Math.max(
        18,
        commentLines.length * (smallSize + lineGap) + 6
      );

      ensureSpace(rowH + 2);

      for (let i = 0; i < cW.length; i++) drawRect(cX[i], y, cW[i], rowH);

      page.drawText(dateStr, {
        x: cX[0] + 4,
        y: y - 14,
        size: smallSize,
        font: fontRegular,
      });
      page.drawText(cm.user_group, {
        x: cX[1] + 4,
        y: y - 14,
        size: smallSize,
        font: fontRegular,
      });
      page.drawText(String(cm.question_id), {
        x: cX[2] + 4,
        y: y - 14,
        size: smallSize,
        font: fontRegular,
      });

      commentLines.forEach((ln, i) => {
        page.drawText(ln, {
          x: cX[3] + 4,
          y: y - 14 - i * (smallSize + lineGap),
          size: smallSize,
          font: fontRegular,
        });
      });

      y -= rowH;
    }
  }

  ensureSpace(20);
  y = margin + 20;
  drawLine(margin, y, pageWidth - margin, y);
  y -= 10;
  drawText(`หน้าที่ ${pdf.getPageIndices().length}`, margin, smallSize);

  const pdfBytes = await pdf.save();
  return pdfBytes;
};

/* ===========================================================
   5) ✅ สรุปผลรายปีของหน่วยงาน (Yearly Stats)
   - ส่งออกเป็น { department_id, department_name, items: [...] }
   - ให้ตรงกับหน้า src/app/(dashboard)/dashboard/[departmentCode]/yearly/page.tsx
   =========================================================== */
export const getDeptYearlyStats = async (
  code: string,
  surveyId: number
): Promise<DeptYearlyStats> => {
  const dep = await db.oneOrNone<{ id: number; name: string }>(
    "SELECT id, name FROM departments WHERE code = $1",
    [code]
  );

  if (!dep) return { error: "ไม่พบหน่วยงานนี้" };

  const sql = `
    SELECT
      EXTRACT(YEAR FROM r.created_at)::int AS year,
      ROUND(AVG(a.rating)::numeric, 2)      AS avg_rating,
      COUNT(DISTINCT r.id)                  AS responses_count,
      COUNT(a.id)                           AS answers_count
    FROM responses r
    JOIN answers   a ON a.response_id = r.id
    JOIN questions q ON q.id = a.question_id
    WHERE r.department_id = $1
      AND q.survey_id = $2
      AND q.type = 'rating'
      AND a.rating IS NOT NULL
    GROUP BY year
    ORDER BY year ASC
  `;

  const items = await db.any<DeptYearlyItem>(sql, [dep.id, surveyId]);

  return {
    department_id: dep.id,
    department_name: dep.name,
    items,
  };
};
