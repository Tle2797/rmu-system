// src/app/(dashboard)/dashboard/[departmentCode]/yearly/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Users,
  ListChecks,
  Sparkle,
} from "lucide-react";
import {
  BarChart as ReBarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Bar,
} from "recharts";

/* ---------- Types ---------- */
type YearRow = {
  year: number | string;
  avg_rating: number | string | null;
  responses_count: number | string;
  answers_count: number | string;
};

type DeptYearlySummary =
  | {
      department_id: number;
      department_code?: string;
      department_name: string;
      items: YearRow[];
    }
  | { error: string };

/* ---------- Helpers ---------- */

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null) sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function num(v: number | string | null | undefined) {
  if (v == null) return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// ใช้ logic เดียวกับหน้าแดชบอร์ดหลัก
function evaluateGrade(avg?: number | null) {
  const s = typeof avg === "number" ? avg : 0;
  if (s >= 0 && s <= 1.0) return "เกณฑ์ต่ำที่สุด";
  if (s > 1.0 && s <= 2.0) return "เกณฑ์ต่ำ";
  if (s > 2.0 && s <= 3.0) return "เกณฑ์ปานกลาง";
  if (s > 3.0 && s <= 4.0) return "เกณฑ์ดี";
  if (s > 4.0 && s <= 5.0) return "เกณฑ์ดีมาก";
  return "-";
}

/* ---------- Custom Tooltip สำหรับกราฟ ---------- */

const YearlyTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;

  const p = payload[0];
  const avg = Number(p.value ?? 0);
  const grade = evaluateGrade(avg);
  const extra = (p.payload || {}) as {
    responses?: number;
    answers?: number;
  };

  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-800">ปี {label}</div>
      <div className="mt-1 text-slate-700">
        คะแนนเฉลี่ย:{" "}
        <span className="font-semibold">{avg.toFixed(2)}</span> / 5.00
      </div>
      <div className="mt-0.5 text-slate-700">
        ผลการประเมิน: <span className="font-semibold">{grade}</span>
      </div>
      {extra.responses != null && extra.answers != null && (
        <div className="mt-1 text-slate-500">
          ผู้ทำแบบประเมิน {extra.responses} คน • คำตอบ {extra.answers} รายการ
        </div>
      )}
    </div>
  );
};

/* ---------- Page Component ---------- */

export default function DeptYearlyPage() {
  const { departmentCode } = useParams<{ departmentCode: string }>();
  const qs = useSearchParams();
  const surveyId = Number(qs.get("survey_id") ?? 1);

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [data, setData] = useState<DeptYearlySummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr("");
        const q = buildQuery({ survey_id: String(surveyId) });
        const res = await fetch(
          `/api/departments/${departmentCode}/yearly${q}`
        );
        const json = (await res.json()) as DeptYearlySummary;
        if (!cancelled) setData(json);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "ไม่สามารถโหลดข้อมูลได้");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [departmentCode, surveyId]);

  const hasError = data && "error" in data;
  const deptName =
    !data || "error" in data ? "-" : data.department_name || "-";

  // รวมเป็น KPI
  const kpi = useMemo(() => {
    if (!data || "error" in data) {
      return {
        years: 0,
        totalResponses: 0,
        totalAnswers: 0,
        avgAll: null as number | null,
      };
    }
    const years = data.items.length;
    let totalResponses = 0;
    let totalAnswers = 0;
    let weightedSum = 0;
    let countForAvg = 0;

    for (const row of data.items) {
      const rCount = num(row.responses_count);
      const aCount = num(row.answers_count);
      const avg = num(row.avg_rating);

      totalResponses += rCount;
      totalAnswers += aCount;

      if (aCount > 0 && Number.isFinite(avg)) {
        weightedSum += avg * aCount;
        countForAvg += aCount;
      }
    }

    const avgAll = countForAvg > 0 ? weightedSum / countForAvg : null;
    return { years, totalResponses, totalAnswers, avgAll };
  }, [data]);

  const gradeAll = evaluateGrade(kpi.avgAll ?? null);

  // data สำหรับกราฟแท่ง
  const chartData = useMemo(() => {
    if (!data || "error" in data) return [];
    return [...data.items]
      .sort((a, b) => num(a.year) - num(b.year))
      .map((row) => ({
        year: num(row.year),
        avg: num(row.avg_rating),
        responses: num(row.responses_count),
        answers: num(row.answers_count),
      }));
  }, [data]);

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-50 via-white to-indigo-50 shadow-sm"
      >
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-sky-200/40 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
        </div>

        <div className="relative grid gap-4 md:grid-cols-[1fr_auto] p-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-xs text-sky-700 ring-1 ring-sky-200 shadow-sm">
              <BarChart3 className="size-3.5" />
              สรุปข้อมูลรายปี
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
              ผลการประเมินรายปี
            </h1>
            <p className="text-sm text-slate-600 mt-1">
              หน่วยงาน: {deptName}
            </p>
          </div>

          <div className="flex flex-col items-end justify-center gap-1 text-right">
            <div className="text-xs text-slate-500">
              คะแนนเฉลี่ยภาพรวมทุกปี
            </div>
            <div className="flex items-baseline gap-2">
              <div className="text-3xl md:text-4xl font-semibold text-slate-900">
                {kpi.avgAll != null ? kpi.avgAll.toFixed(2) : "-"}
              </div>
              <span className="text-sm text-slate-500">/ 5.00</span>
            </div>
            <div className="mt-1 inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-[11px] text-emerald-700 ring-1 ring-emerald-100">
              <Sparkle className="size-3" />
              ผลการประเมิน: {gradeAll}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Error / Loading */}
      {loading && (
        <div className="rounded-2xl border bg-white p-6 text-sm text-slate-500">
          กำลังโหลดข้อมูล...
        </div>
      )}
      {!loading && (err || hasError) && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">
          ไม่สามารถโหลดข้อมูลได้: {err || (data as any)?.error || "ไม่ทราบสาเหตุ"}
        </div>
      )}

      {/* KPI cards */}
      {!loading && !err && !hasError && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* จำนวนปี */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <CalendarDays className="size-4 text-sky-500" />
              จำนวนปีที่มีข้อมูล
            </div>
            <div className="mt-2 text-4xl font-semibold text-slate-900">
              {kpi.years}
            </div>
          </div>

          {/* ผู้ทำแบบประเมิน */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <Users className="size-4 text-sky-500" />
              จำนวนผู้ทำแบบประเมินรวมทุกปี
            </div>
            <div className="mt-2 text-4xl font-semibold text-slate-900">
              {kpi.totalResponses}
            </div>
          </div>

          {/* จำนวนคำตอบ */}
          <div className="rounded-2xl border bg-white p-5 shadow-sm">
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <ListChecks className="size-4 text-sky-500" />
              จำนวนคำตอบทั้งหมดรวมทุกปี
            </div>
            <div className="mt-2 text-4xl font-semibold text-slate-900">
              {kpi.totalAnswers}
            </div>
          </div>
        </div>
      )}

      {/* Bar chart */}
      {!loading && !err && !hasError && (
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                <BarChart3 className="size-4 text-sky-500" />
                กราฟแสดงคะแนนเฉลี่ยรายปี
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                แท่งยาวขึ้น = คะแนนเฉลี่ยสูงขึ้น (เต็ม 5 คะแนน)
              </p>
            </div>
            {chartData.length > 0 && (
              <div className="text-xs text-slate-500">
                ผู้ทำแบบประเมินรวม {kpi.totalResponses} คน • คำตอบ{" "}
                {kpi.totalAnswers} รายการ
              </div>
            )}
          </div>

          <div className="h-72 w-full">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-slate-500">
                — ยังไม่มีข้อมูลรายปี —
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ReBarChart
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 0, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis domain={[0, 5]} />
                  {/* ✅ tooltip แบบ custom แสดงผลการประเมิน */}
                  <Tooltip content={<YearlyTooltip />} />

                  <defs>
                    <linearGradient
                      id="yearGradient"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop offset="0%" stopColor="#38bdf8" />
                      <stop offset="100%" stopColor="#6366f1" />
                    </linearGradient>
                  </defs>

                  <Bar
                    dataKey="avg"
                    name="คะแนนเฉลี่ย"
                    radius={[6, 6, 0, 0]}
                    fill="url(#yearGradient)" // ✅ ไม่เป็นสีดำแล้ว
                  />
                </ReBarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
