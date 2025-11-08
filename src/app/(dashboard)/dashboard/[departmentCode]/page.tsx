// src/app/(dashboard)/dashboard/[departmentCode]/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import { FileSpreadsheet, FileText, Sparkle, Star, Users } from "lucide-react";

/* ================= Types ================= */
type SummaryRow = {
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

type DeptSummary =
  | { department_id: number; department_name: string; items: SummaryRow[] }
  | { error: string };

type DeptComments =
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

type Participation = {
  total_responses: number;
  with_comments: number;
  negative_comments: number;
  actions_created: number;
};

/* ================= Helpers ================= */
function evaluateGrade(avg?: number | null) {
  const s = typeof avg === "number" ? avg : 0;
  if (s >= 0 && s <= 1.0) return { label: "เกณฑ์ต่ำที่สุด", key: "lowest" } as const;
  if (s > 1.0 && s <= 2.0) return { label: "เกณฑ์ต่ำ", key: "low" } as const;
  if (s > 2.0 && s <= 3.0) return { label: "เกณฑ์ปานกลาง", key: "mid" } as const;
  if (s > 3.0 && s <= 4.0) return { label: "เกณฑ์ดี", key: "good" } as const;
  if (s > 4.0 && s <= 5.0) return { label: "เกณฑ์ดีมาก", key: "vgood" } as const;
  return { label: "-", key: "na" } as const;
}

function badgeClass(key: string) {
  const base =
    "inline-flex px-3 py-1 rounded-full text-sm ring-1 font-medium transition-all duration-200";
  switch (key) {
    case "lowest":
      return `${base} bg-red-100 text-red-700 ring-red-200`;
    case "low":
      return `${base} bg-orange-100 text-orange-700 ring-orange-200`;
    case "mid":
      return `${base} bg-yellow-100 text-yellow-800 ring-yellow-200`;
    case "good":
      return `${base} bg-green-100 text-green-700 ring-green-200`;
    case "vgood":
      return `${base} bg-emerald-100 text-emerald-700 ring-emerald-200`;
    default:
      return `${base} bg-gray-100 text-gray-700 ring-gray-200`;
  }
}

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v != null) sp.set(k, v);
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function formatStable(dt: string) {
  return dt.replace("T", " ").slice(0, 16);
}

const n = (v: number | null | undefined) => Number(v || 0);

/** วงแหวนคะแนนเฉลี่ย (SVG gauge) */
function AvgGauge({ value }: { value: number | null }) {
  const pct = value != null ? Math.max(0, Math.min(100, (value / 5) * 100)) : 0;
  const r = 28;
  const C = 2 * Math.PI * r;
  const dash = (pct / 100) * C;
  return (
    <svg viewBox="0 0 72 72" className="h-20 w-20 drop-shadow-sm">
      <defs>
        <linearGradient id="gauge" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" />
          <stop offset="100%" stopColor="#6366f1" />
        </linearGradient>
      </defs>
      <circle cx="36" cy="36" r={r} fill="none" stroke="#e5e7eb" strokeWidth="8" />
      <circle
        cx="36"
        cy="36"
        r={r}
        fill="none"
        stroke="url(#gauge)"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${dash} ${C - dash}`}
        transform="rotate(-90 36 36)"
      />
      <text
        x="36"
        y="41"
        textAnchor="middle"
        className="fill-gray-800 text-[16px] font-semibold"
      >
        {value != null ? value.toFixed(2) : "-"}
      </text>
    </svg>
  );
}

/* ================= Page ================= */
export default function DepartmentDashboardPage() {
  const { departmentCode } = useParams<{ departmentCode: string }>();
  const qs = useSearchParams();
  const surveyId = Number(qs.get("survey_id") ?? 1);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [summary, setSummary] = useState<DeptSummary | null>(null);
  const [comments, setComments] = useState<DeptComments | null>(null);
  const [participation, setParticipation] = useState<Participation | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr("");

        // summary + comments
        const qCommon = buildQuery({ survey_id: String(surveyId) });
        const u1 = `/api/departments/${departmentCode}/summary${qCommon}`;
        const u2 = `/api/departments/${departmentCode}/comments${buildQuery({
          survey_id: String(surveyId),
          limit: "50",
          offset: "0",
        })}`;

        // ดึงจำนวน "ผู้ทำแบบประเมิน" ด้วย /exec/participation (กรอง departments=code)
        const u3 = `/api/exec/participation${buildQuery({
          survey_id: String(surveyId),
          departments: departmentCode,
        })}`;

        const [r1, r2, r3] = await Promise.all([fetch(u1), fetch(u2), fetch(u3)]);
        const j1 = (await r1.json()) as DeptSummary;
        const j2 = (await r2.json()) as DeptComments;
        const j3 = (await r3.json()) as Participation;

        if (!cancelled) {
          setSummary(j1);
          setComments(j2);
          setParticipation(j3);
        }
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "เกิดข้อผิดพลาด");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [departmentCode, surveyId]);

  const deptName = useMemo(() => {
    if (!summary || "error" in summary) return "-";
    return summary.department_name || "-";
  }, [summary]);

  // รวม "จำนวนคำตอบทั้งหมด" จากสรุปต่อคำถาม
  const kpi = useMemo(() => {
    if (!summary || "error" in summary) return { avg: null as number | null, answers: 0 };
    let totalAnswers = 0,
      weightedSum = 0,
      totalCountForAvg = 0;

    for (const it of summary.items) {
      const r1 = n(it.r1),
        r2 = n(it.r2),
        r3 = n(it.r3),
        r4 = n(it.r4),
        r5 = n(it.r5);
      const count = r1 + r2 + r3 + r4 + r5;
      totalAnswers += count;
      if (it.avg_rating != null) {
        weightedSum += Number(it.avg_rating) * count;
        totalCountForAvg += count;
      }
    }
    const avg = totalCountForAvg > 0 ? weightedSum / totalCountForAvg : null;
    return { avg, answers: totalAnswers };
  }, [summary]);

  const grade = evaluateGrade(kpi.avg);

  const exportExcelHref = `/api/departments/${departmentCode}/export.xlsx${buildQuery({
    survey_id: String(surveyId),
  })}`;
  const exportPdfHref = `/api/departments/${departmentCode}/export.pdf${buildQuery({
    survey_id: String(surveyId),
  })}`;

  const respondents = participation?.total_responses ?? 0;

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm"
      >
        <div className="absolute inset-0">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
        </div>
        <div className="relative grid gap-4 md:grid-cols-[1fr_auto] p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-sky-700 ring-1 ring-sky-200 shadow-sm">
              <Sparkle className="size-3.5" /> RMU • Satisfaction Dashboard
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">แดชบอร์ดหน่วยงาน</h1>
            <p className="text-sm text-gray-600 mt-1">{deptName}</p>
          </div>
          <div className="flex items-center justify-end gap-2">
            <a
              href={exportExcelHref}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-white/70 transition shadow-sm backdrop-blur-sm bg-white/60"
            >
              <FileSpreadsheet className="size-4" /> ส่งออก Excel
            </a>
            <a
              href={exportPdfHref}
              className="inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm hover:bg-white/70 transition shadow-sm backdrop-blur-sm bg-white/60"
            >
              <FileText className="size-4" /> ส่งออก PDF
            </a>
          </div>
        </div>
      </motion.div>

      {/* KPI — เรียงใหม่: ผู้ทำแบบประเมิน • จำนวนคำตอบทั้งหมด • คะแนนเฉลี่ย */}
      {!loading && !err && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* 1) จำนวนผู้ทำแบบประเมิน */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border p-5 shadow-sm bg-white"
          >
            <div className="inline-flex items-center gap-2 text-xs text-gray-600">
              <Users className="size-4" /> ผู้ทำแบบประเมิน
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
              {respondents}
            </div>
            <div className="mt-1 text-xs text-gray-500">นับจากจำนวนครั้งการทำแบบประเมิน (Distinct responses)</div>
          </motion.div>

          {/* 2) จำนวนคำตอบทั้งหมด */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border p-5 shadow-sm bg-white"
          >
            <div className="inline-flex items-center gap-2 text-xs text-gray-600">
              <Users className="size-4" /> จำนวนคำตอบทั้งหมด
            </div>
            <div className="mt-2 text-4xl font-semibold tracking-tight text-gray-900">
              {kpi.answers}
            </div>
            <div className="mt-1 text-xs text-gray-500">รวมทุกเรทติ้งของทุกคำถาม</div>
          </motion.div>

          {/* 3) คะแนนเฉลี่ย + เกณฑ์ */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-100 via-white to-indigo-100 shadow-sm"
          >
            <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full bg-sky-200/50 blur-3xl" />
            <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
            <div className="relative grid gap-4 p-5 md:p-6 md:grid-cols-[1fr_auto]">
              <div>
                <div className="inline-flex items-center gap-2 text-xs text-sky-700">
                  <Star className="size-4" /> คะแนนเฉลี่ย
                </div>
                <div className="mt-1 flex items-end gap-3">
                  <div className="text-5xl md:text-6xl font-semibold tracking-tight text-gray-900">
                    {kpi.avg != null ? kpi.avg.toFixed(2) : "-"}
                  </div>
                  <span className="mb-1 text-sm text-gray-500">/ 5.00</span>
                </div>
                <div className="mt-2 text-sm text-gray-600">
                  ผลการประเมิน:
                  <span className={`ml-2 ${badgeClass(evaluateGrade(kpi.avg).key)}`}>
                    {evaluateGrade(kpi.avg).label}
                  </span>
                </div>
              </div>
              <div className="flex items-center justify-center">
                <AvgGauge value={kpi.avg} />
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* ตารางสรุปคะแนนรายคำถาม */}
      {!loading && !err && summary && !("error" in summary) && (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-4 border-b bg-white">
            <h2 className="text-lg font-semibold">สรุปคะแนนรายคำถาม</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm table-fixed">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr className="[&>th]:px-3 [&>th]:py-2 [&>th]:text-left">
                  <th className="w-[70px] text-center">ข้อ</th>
                  <th className="min-w-[360px]">คำถาม</th>
                  <th className="w-[60px] text-center">1★</th>
                  <th className="w-[60px] text-center">2★</th>
                  <th className="w-[60px] text-center">3★</th>
                  <th className="w-[60px] text-center">4★</th>
                  <th className="w-[60px] text-center">5★</th>
                  <th className="w-[120px] text-center">จำนวนคำตอบ</th>
                  <th className="w-[100px] text-center">ค่าเฉลี่ย</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {summary.items.map((it) => {
                  const r1 = n(it.r1), r2 = n(it.r2), r3 = n(it.r3), r4 = n(it.r4), r5 = n(it.r5);
                  const total = r1 + r2 + r3 + r4 + r5;
                  return (
                    <motion.tr
                      key={it.question_id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="[&>td]:px-3 [&>td]:py-3 hover:bg-sky-50/50 align-top"
                    >
                      <td className="text-center align-top whitespace-nowrap">{it.question_id}</td>
                      <td className="align-top">
                        <div className="font-medium text-gray-900 break-words whitespace-normal leading-6">
                          {it.question_text}
                        </div>
                        <div className="text-[11px] text-gray-500 mt-1">
                          ประเภท: {it.question_type === "rating" ? "ให้คะแนน" : "คำตอบข้อความ"}
                        </div>
                      </td>
                      <td className="text-center align-top whitespace-nowrap">{r1}</td>
                      <td className="text-center align-top whitespace-nowrap">{r2}</td>
                      <td className="text-center align-top whitespace-nowrap">{r3}</td>
                      <td className="text-center align-top whitespace-nowrap">{r4}</td>
                      <td className="text-center align-top whitespace-nowrap">{r5}</td>
                      <td className="text-center align-top whitespace-nowrap">{it.answers_count ?? total}</td>
                      <td className="text-center align-top whitespace-nowrap">
                        {it.avg_rating != null ? Number(it.avg_rating).toFixed(2) : "-"}
                      </td>
                    </motion.tr>
                  );
                })}
                {summary.items.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-3 py-8 text-center text-gray-500">
                      — ยังไม่มีข้อมูลในช่วงที่เลือก —
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ความคิดเห็นล่าสุด */}
      {!loading && !err && comments && !("error" in comments) && (
        <div className="rounded-2xl border bg-white overflow-hidden">
          <div className="p-4 border-b flex items-center justify-between">
            <h2 className="text-lg font-semibold">ความคิดเห็นล่าสุด</h2>
            <span className="text-xs text-gray-500">ทั้งหมด {comments.items.length} รายการ</span>
          </div>
          <div className="divide-y">
            {comments.items.length === 0 ? (
              <div className="p-6 text-gray-500 text-sm">— ไม่มีความคิดเห็น —</div>
            ) : (
              comments.items.map((c, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className="p-4"
                >
                  <div className="text-xs text-gray-500">
                    {formatStable(c.created_at)} • {c.user_group} • ข้อ {c.question_id}
                  </div>
                  <div className="mt-1 leading-relaxed">{c.comment}</div>
                  <div className="mt-1 text-[11px] text-gray-500 line-clamp-1">{c.question_text}</div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
