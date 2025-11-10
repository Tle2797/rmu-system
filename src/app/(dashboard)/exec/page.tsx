// src/app/(dashboard)/exec/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  TrendingUp,
  BarChart3,
  LineChart as LineChartIcon,
  MessageCircle,
  Smile,
  Meh,
  Frown,
  Users,
  Building2,
} from "lucide-react";
import {
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";

/* ========= Types ========= */

type Overview = {
  departments_count: number;
  surveys_count: number;
  questions_count: number;
  responses_count: number;
  avg_score: number | null;
  pct_high: number; // 0..1
  pct_low: number;  // 0..1
};

type Participation = {
  total_responses: number;
  with_comments: number;
  negative_comments: number;
  actions_created: number;
};

type RankRow = {
  department_code: string;
  department_name: string;
  score: number | null;
  answers: number;
  pct_high: number;
  pct_low: number;
};

type TrendPoint = {
  bucket: string; // YYYY-MM
  avg_rating: number | null;
  answers: number;
};

type CommentSummary = {
  bySent: { sentiment: "positive" | "neutral" | "negative"; cnt: number }[];
  byTheme: { theme: string; cnt: number }[];
};

/* ========= Helpers ========= */

function evaluateGrade(avg?: number | null) {
  const s = typeof avg === "number" ? avg : 0;
  if (s >= 0 && s <= 1.0) return { label: "เกณฑ์ต่ำที่สุด", key: "lowest" } as const;
  if (s > 1.0 && s <= 2.0) return { label: "เกณฑ์ต่ำ", key: "low" } as const;
  if (s > 2.0 && s <= 3.0) return { label: "เกณฑ์ปานกลาง", key: "mid" } as const;
  if (s > 3.0 && s <= 4.0) return { label: "เกณฑ์ดี", key: "good" } as const;
  if (s > 4.0 && s <= 5.0) return { label: "เกณฑ์ดีมาก", key: "vgood" } as const;
  return { label: "-", key: "na" } as const;
}

function gradeBadgeClass(key: string) {
  const base =
    "inline-flex px-3 py-1 rounded-full text-xs md:text-sm ring-1 font-medium transition-all duration-200";
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

const n = (v: unknown) => (v == null ? 0 : Number(v) || 0);

/* ========= Custom Tooltip ========= */

function RankTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as RankRow & { gradeLabel?: string };
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-800">{row.department_name}</div>
      <div className="mt-1 space-y-0.5">
        <div>คะแนนเฉลี่ย: {row.score != null ? Number(row.score).toFixed(2) : "-"}</div>
        <div>จำนวนคำตอบ: {row.answers}</div>
        {row.gradeLabel && (
          <div>
            ผลการประเมิน:{" "}
            <span className={gradeBadgeClass(evaluateGrade(row.score).key)}>{row.gradeLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function TrendTooltip({ active, payload }: any) {
  if (!active || !payload || !payload.length) return null;
  const row = payload[0].payload as TrendPoint & { gradeLabel?: string };
  return (
    <div className="rounded-lg border bg-white px-3 py-2 text-xs shadow-md">
      <div className="font-semibold text-slate-800">เดือน: {row.bucket}</div>
      <div className="mt-1 space-y-0.5">
        <div>คะแนนเฉลี่ย: {row.avg_rating != null ? Number(row.avg_rating).toFixed(2) : "-"}</div>
        <div>จำนวนคำตอบ: {row.answers}</div>
        {row.gradeLabel && (
          <div>
            ผลการประเมิน:{" "}
            <span className={gradeBadgeClass(evaluateGrade(row.avg_rating).key)}>
              {row.gradeLabel}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========= Page ========= */

export default function ExecOverviewPage() {
  const surveyId = 1;

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  const [overview, setOverview] = useState<Overview | null>(null);
  const [participation, setParticipation] = useState<Participation | null>(null);
  const [rank, setRank] = useState<RankRow[]>([]);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [commentSummary, setCommentSummary] = useState<CommentSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setErr("");

        const qs = `?survey_id=${surveyId}`;

        const [oRes, pRes, rRes, tRes, cRes] = await Promise.all([
          fetch(`/api/exec/overview${qs}`),
          fetch(`/api/exec/participation${qs}`),
          fetch(`/api/exec/rank${qs}`),
          fetch(`/api/exec/trend${qs}&group=month`),
          fetch(`/api/comments/summary${qs}`),
        ]);

        if (!oRes.ok || !pRes.ok || !rRes.ok || !tRes.ok || !cRes.ok) {
          throw new Error("โหลดข้อมูลภาพรวมไม่สำเร็จ");
        }

        const [o, p, r, t, c] = await Promise.all([
          oRes.json(),
          pRes.json(),
          rRes.json(),
          tRes.json(),
          cRes.json(),
        ]);

        if (!cancelled) {
          setOverview(o as Overview);
          setParticipation(p as Participation);
          setRank(r as RankRow[]);
          setTrend(t as TrendPoint[]);
          setCommentSummary(c as CommentSummary);
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
  }, [surveyId]);

  const grade = useMemo(() => evaluateGrade(overview?.avg_score ?? null), [overview]);

  const rankData = useMemo(() => {
    const withScore = (rank || []).filter((r) => r.score != null);
    const top10 = withScore.slice(0, 10);
    return top10.map((row) => ({
      ...row,
      score: row.score != null ? Number(row.score) : null,
      gradeLabel: evaluateGrade(row.score).label,
    }));
  }, [rank]);

  const trendData = useMemo(
    () =>
      (trend || []).map((row) => ({
        ...row,
        avg_rating: row.avg_rating != null ? Number(row.avg_rating) : null,
        gradeLabel: evaluateGrade(row.avg_rating).label,
      })),
    [trend]
  );

  const sentCounts = useMemo(() => {
    const base = { positive: 0, neutral: 0, negative: 0 };
    if (!commentSummary) return base;
    for (const s of commentSummary.bySent || []) {
      base[s.sentiment] = s.cnt;
    }
    return base;
  }, [commentSummary]);

  const topThemes = useMemo(
    () => (commentSummary?.byTheme || []).slice(0, 8),
    [commentSummary]
  );

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
              <LayoutDashboard className="size-3.5" /> RMU • University Overview
            </div>
            <h1 className="mt-2 text-2xl md:text-3xl font-semibold tracking-tight">
              ภาพรวมมหาวิทยาลัย
            </h1>
          </div>
          {overview && (
            <div className="flex flex-col items-end justify-center gap-2 text-right">
              <div className="flex flex-wrap gap-2 justify-end">
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-sky-200">
                  <Building2 className="size-3.5 text-sky-600" />
                  หน่วยงานรวม:{" "}
                  <span className="font-semibold text-slate-800">
                    {overview.departments_count}
                  </span>
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-white/70 px-3 py-1 text-xs ring-1 ring-sky-200">
                  <Users className="size-3.5 text-sky-600" />
                  ครั้งการทำแบบประเมิน:{" "}
                  <span className="font-semibold text-slate-800">
                    {overview.responses_count}
                  </span>
                </span>
              </div>
            </div>
          )}
        </div>
      </motion.div>

      {/* Loading / Error */}
      {loading && <div className="text-sm text-slate-500">กำลังโหลดข้อมูลภาพรวม…</div>}
      {!loading && err && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {err}
        </div>
      )}

      {!loading && !err && (
        <>
          {/* KPI Cards */}
          <div className="grid gap-4 md:grid-cols-4">
            {/* Avg Score */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-100 via-white to-indigo-100 shadow-sm md:col-span-2"
            >
              <div className="absolute -top-14 -right-14 h-40 w-40 rounded-full bg-sky-200/50 blur-3xl" />
              <div className="absolute -bottom-20 -left-20 h-56 w-56 rounded-full bg-indigo-200/40 blur-3xl" />
              <div className="relative p-5 md:p-6">
                <div className="inline-flex items-center gap-2 text-xs text-sky-700">
                  <TrendingUp className="size-4" /> คะแนนเฉลี่ยรวมมหาวิทยาลัย
                </div>
                <div className="mt-1 flex items-baseline gap-3">
                  <div className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900">
                    {overview?.avg_score != null
                      ? Number(overview.avg_score).toFixed(2)
                      : "-"}
                  </div>
                  <span className="text-sm text-gray-500">/ 5.00</span>
                </div>
                <div className="mt-2 text-sm text-gray-600 flex flex-wrap items-center gap-2">
                  ผลการประเมิน:
                  <span className={gradeBadgeClass(grade.key)}>{grade.label}</span>
                </div>
              </div>
            </motion.div>

            {/* Participation */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                <Users className="size-4" /> การมีส่วนร่วม
              </div>
              <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
                {participation?.total_responses ?? 0}
              </div>
              <div className="mt-1 text-xs text-slate-500">
                ครั้งการทำแบบประเมินทั้งหมด
              </div>
              {participation && (
                <div className="mt-3 space-y-1 text-xs text-slate-600">
                </div>
              )}
            </motion.div>

            {/* Departments / Questions */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <div className="inline-flex items-center gap-2 text-xs text-slate-600">
                <Building2 className="size-4" /> ภาพรวมระบบ
              </div>
              <div className="mt-2 flex flex-col gap-1 text-sm text-slate-700">
                <div className="flex items-center justify-between">
                  <span>หน่วยงานในระบบ</span>
                  <span className="font-semibold">
                    {overview?.departments_count ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                </div>
                <div className="flex items-center justify-between">
                  <span>จำนวนคำถามทั้งหมด</span>
                  <span className="font-semibold">
                    {overview?.questions_count ?? 0}
                  </span>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Charts: Rank + Trend */}
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Rank Chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <BarChart3 className="size-4 text-sky-600" />
                    จัดอันดับหน่วยงานตามคะแนนเฉลี่ย (Top 10)
                  </div>
                </div>
              </div>
              <div className="mt-2 h-72">
                {rankData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">
                    ยังไม่มีข้อมูลจัดอันดับ
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={rankData}
                      layout="vertical"
                      margin={{ left: 80, right: 16, top: 8, bottom: 8 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" vertical={false} />
                      <XAxis type="number" domain={[0, 5]} />
                      <YAxis
                        type="category"
                        dataKey="department_name"
                        width={110}
                        tick={{ fontSize: 11 }}
                      />
                      <RechartsTooltip content={<RankTooltip />} />
                      <Bar dataKey="score" radius={[4, 4, 4, 4]} fill="#38bdf8" />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>

            {/* Trend Chart */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border bg-white p-4 shadow-sm flex flex-col"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <div>
                  <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                    <LineChartIcon className="size-4 text-indigo-600" />
                    เทรนด์คะแนนเฉลี่ยรายเดือน
                  </div>
                </div>
              </div>
              <div className="mt-2 h-72">
                {trendData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-slate-500">
                    ยังไม่มีข้อมูลเทรนด์
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={trendData} margin={{ left: 8, right: 16, top: 8, bottom: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="bucket"
                        tick={{ fontSize: 11 }}
                        padding={{ left: 4, right: 4 }}
                      />
                      <YAxis domain={[0, 5]} />
                      <RechartsTooltip content={<TrendTooltip />} />
                      <Line
                        type="monotone"
                        dataKey="avg_rating"
                        stroke="#0ea5e9"
                        strokeWidth={2}
                        dot={{ r: 3 }}
                        activeDot={{ r: 5 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </motion.div>
          </div>

          {/* Comment Summary */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border bg-white p-4 shadow-sm"
          >
            <div className="flex items-center justify-between gap-2 mb-3">
              <div>
                <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                  <MessageCircle className="size-4 text-sky-600" />
                  สรุปความคิดเห็นทั้งมหาวิทยาลัย
                </div>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[220px,1fr] items-start">
              {/* Sentiment cards */}
              <div className="space-y-2">
                <div className="rounded-xl border bg-slate-50/80 p-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                    อารมณ์ความคิดเห็น
                  </div>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center justify-between rounded-lg bg-emerald-50 px-2 py-1.5">
                      <span className="flex items-center gap-1 text-emerald-700">
                        <Smile className="size-3.5" /> เชิงบวก
                      </span>
                      <span className="font-semibold">
                        {sentCounts.positive ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-slate-50 px-2 py-1.5">
                      <span className="flex items-center gap-1 text-slate-700">
                        <Meh className="size-3.5" /> กลาง ๆ
                      </span>
                      <span className="font-semibold">
                        {sentCounts.neutral ?? 0}
                      </span>
                    </div>
                    <div className="flex items-center justify-between rounded-lg bg-rose-50 px-2 py-1.5">
                      <span className="flex items-center gap-1 text-rose-700">
                        <Frown className="size-3.5" /> เชิงลบ
                      </span>
                      <span className="font-semibold">
                        {sentCounts.negative ?? 0}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </div>
  );
}
