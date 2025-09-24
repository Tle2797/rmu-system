"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import GlobalFilters, { Filters } from "@/components/filters/GlobalFilters";
import { toThaiDisplay } from "@/server/utils/date";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  Area,
  Line,
} from "recharts";
import { Download, ExternalLink, Search as SearchIcon, X as XIcon, RefreshCcw } from "lucide-react";

/* ----------------- Types ----------------- */
type Overview = {
  departments_count: number;
  surveys_count: number;
  questions_count: number;
  responses_count: number;
  avg_score: number | null;
  pct_high: number;
  pct_low: number;
};
type Participation = { total_responses: number; with_comments: number; negative_comments: number; actions_created: number };
type RatingDistribution = { r1: number; r2: number; r3: number; r4: number; r5: number };
type TrendPoint = { bucket: string; avg_rating: number | null; answers: number };
type TrendGroup = "day" | "month" | "year";
type RankRow = {
  department_code: string;
  department_name: string;
  score: number | null;
  answers: number;
  pct_high: number;
  pct_low: number;
};

/* ----------------- Page ----------------- */
export default function ExecHomePage() {
  const [filters, setFilters] = useState<Filters>({ survey_id: 1 });

  const [overview, setOverview] = useState<Overview | null>(null);
  const [dist, setDist] = useState<RatingDistribution | null>(null);
  const [trend, setTrend] = useState<TrendPoint[]>([]);
  const [trendGroup, setTrendGroup] = useState<TrendGroup>("month");
  const [rank, setRank] = useState<RankRow[]>([]);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  // หน่วยงานทั้งหมด: ค้นหา + แบ่งหน้า
  const [deptSearch, setDeptSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  useEffect(() => setPage(1), [filters]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);
        const params = { ...filters };
        const [ov, rd, tr, rk] = await Promise.all([
          axios.get("/api/exec/overview", { params }),
          axios.get("/api/exec/rating-distribution", { params }),
          axios.get("/api/exec/trend", { params: { ...params, group: trendGroup } }),
          axios.get("/api/exec/rank", { params }),
        ]);
        if (!mounted) return;
        setOverview(ov.data || null);
        setDist(rd.data || null);
        setTrend(Array.isArray(tr.data) ? tr.data : []);
        setRank(Array.isArray(rk.data) ? rk.data : []);
      } catch {
        if (!mounted) return;
        setErr("โหลดข้อมูลไม่สำเร็จ กรุณาลองใหม่อีกครั้ง");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [filters, trendGroup]);

  // KPI
  const kpi = useMemo(() => {
    if (!overview) return null;
    const avg = typeof overview.avg_score === "number" ? overview.avg_score : 0;
    const hi = Math.round((overview.pct_high || 0) * 100);
    return {
      avg,
      hi,
      responses: overview.responses_count || 0,
      departments: overview.departments_count || 0,
      questions: overview.questions_count || 0,
      surveys: overview.surveys_count || 0,
    };
  }, [overview]);

  // Dist
  const totalDist = useMemo(() => (!dist ? 0 : dist.r1 + dist.r2 + dist.r3 + dist.r4 + dist.r5), [dist]);
  const distData = useMemo(
    () => [
      { name: "1 ดาว", value: dist?.r1 ?? 0 },
      { name: "2 ดาว", value: dist?.r2 ?? 0 },
      { name: "3 ดาว", value: dist?.r3 ?? 0 },
      { name: "4 ดาว", value: dist?.r4 ?? 0 },
      { name: "5 ดาว", value: dist?.r5 ?? 0 },
    ],
    [dist]
  );

  const COLORS = ["#ef4444", "#f59e0b", "#eab308", "#22c55e", "#16a34a"];
  const BLUE = "#2563eb";
  const SLATE = "#475569";

  const formatBucket = (bucket: string, group: TrendGroup) => {
    if (!bucket) return "-";
    if (group === "day") return toThaiDisplay(bucket);
    if (group === "month") {
      const [y, m] = bucket.split("-");
      return `${m}/${y}`;
    }
    return bucket;
  };

  // หน่วยงานทั้งหมด (ค้นหา + แบ่งหน้า)
  const filteredAll = useMemo(() => {
    const q = deptSearch.trim().toLowerCase();
    const rows = q
      ? rank.filter(
          (r) => r.department_name.toLowerCase().includes(q) || r.department_code.toLowerCase().includes(q)
        )
      : rank;
    const start = (page - 1) * pageSize;
    return {
      total: rows.length,
      pages: Math.max(1, Math.ceil(rows.length / pageSize)),
      rowsAll: rows,
      rows: rows.slice(start, start + pageSize),
    };
  }, [rank, deptSearch, page, pageSize]);

  const changePage = (to: number) => setPage(Math.max(1, Math.min(to, filteredAll.pages)));

  // ---------- Export ----------
  const fileDate = new Date().toISOString().slice(0, 10);
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };
  const csvEscape = (v: unknown) => {
    const s = String(v ?? "");
    const needsQuote = /[",\r\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
  };
  const exportAllCSV = () => {
    const headers = ["ลำดับ", "รหัสหน่วยงาน", "ชื่อหน่วยงาน", "คะแนนเฉลี่ย", "จำนวนคำตอบ", "% สูง (4–5)", "% ต่ำ (1–2)"];
    const lines = [headers.join(",")];
    filteredAll.rowsAll.forEach((r, i) => {
      const score = r.score ?? 0;
      const hi = Math.round((r.pct_high || 0) * 100);
      const lo = Math.round((r.pct_low || 0) * 100);
      lines.push(
        [
          csvEscape(i + 1),
          csvEscape(r.department_code),
          csvEscape(r.department_name),
          csvEscape(score.toFixed(2)),
          csvEscape(r.answers),
          csvEscape(`${hi}%`),
          csvEscape(`${lo}%`),
        ].join(",")
      );
    });
    const csvContent = "\uFEFF" + lines.join("\r\n");
    downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `exec_all-departments_${fileDate}.csv`);
  };
  const exportAllXLSX = async () => {
    try {
      const XLSX: any = await import("xlsx");
      const data = filteredAll.rowsAll.map((r, i) => {
        const score = r.score ?? 0;
        const hi = Math.round((r.pct_high || 0) * 100);
        const lo = Math.round((r.pct_low || 0) * 100);
        return {
          ลำดับ: i + 1,
          รหัสหน่วยงาน: r.department_code,
          ชื่อหน่วยงาน: r.department_name,
          คะแนนเฉลี่ย: Number(score.toFixed(2)),
          จำนวนคำตอบ: r.answers,
          "% สูง (4–5)": hi,
          "% ต่ำ (1–2)": lo,
        };
      });
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "All Departments");
      XLSX.writeFile(wb, `exec_all-departments_${fileDate}.xlsx`);
    } catch {
      exportAllCSV();
    }
  };
  const onExportAll = () => exportAllXLSX();

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-sky-50 via-white to-white">
      <div className="mx-auto max-w-7xl px-4 pb-10 pt-4 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-4 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ภาพรวมมหาวิทยาลัย</h1>
            <p className="mt-1 text-sm text-slate-600">สรุปภาพรวมทุกหน่วยงาน — ปรับช่วงเวลา/กลุ่ม/ช่วงคะแนนเพื่อวิเคราะห์เชิงลึก</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-medium text-sky-700 ring-1 ring-sky-200">Exec Dashboard</span>
          </div>
        </header>

        {/* Filters */}
        <div className="rounded-2xl border border-sky-100 bg-white/70 p-3 backdrop-blur-sm ring-1 ring-white/50">
          <GlobalFilters value={filters} onChange={setFilters} />
        </div>

        {/* Error */}
        {err && <ErrorAlert message={err} />}

        {/* KPIs — สไตล์เข้ากับหัวตาราง */}
        <section className="mt-4">
          {loading && !kpi ? (
            <KpiSkeleton />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <KpiCard title="หน่วยงานที่มีข้อมูล" value={kpi?.departments ?? "-"} icon="🏛️" />
              <KpiCard title="แบบสอบถาม" value={kpi?.surveys ?? "-"} icon="📋" />
              <KpiCard title="จำนวนคำถาม" value={kpi?.questions ?? "-"} icon="❓" />
              <KpiCard title="ผู้ทำแบบประเมิน" value={(kpi?.responses ?? 0).toLocaleString()} icon="👥" />
              <KpiCard title="คะแนนเฉลี่ยรวม" value={kpi ? kpi.avg.toFixed(2) : "-"} icon="⭐" emphasize />
              <KpiCard title="% สูง (4–5)" value={kpi ? `${kpi.hi}%` : "-"} icon="📈" />
            </div>
          )}
        </section>

        {/* Distribution — การ์ด/เฮดเดอร์สไตล์เดียวกับตารางหลัก */}
        <section className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
          <ChartCard
            title="การกระจายคะแนน (แท่ง)"
            loading={loading && !dist}
            onRefresh={() => setFilters({ ...filters })}
          >
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={distData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" stroke={SLATE} />
                <YAxis allowDecimals={false} stroke={SLATE} />
                <Tooltip />
                <Legend />
                <Bar dataKey="value" name="จำนวน" fill={BLUE} radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-2 text-xs text-slate-500">
              รวมทั้งหมด: <span className="font-medium">{totalDist.toLocaleString()}</span> ครั้ง
            </div>
          </ChartCard>

          <ChartCard title="การกระจายคะแนน (วงกลม)" loading={loading && !dist}>
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Tooltip />
                <Legend />
                <Pie data={distData} dataKey="value" nameKey="name" outerRadius={100} label>
                  {distData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Trend — เฮดเดอร์/ขอบ/ปุ่มให้เข้าชุด */}
        <section className="mt-4 rounded-2xl border border-sky-100 bg-white overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100 px-3 py-2">
            <div className="font-medium text-slate-900">เทรนด์คะแนนเฉลี่ย & จำนวนคำตอบ</div>
            <div className="flex items-center gap-2">
              <Segmented
                value={trendGroup}
                onChange={(v) => setTrendGroup(v as TrendGroup)}
                options={[{ label: "รายวัน", value: "day" }, { label: "รายเดือน", value: "month" }]}
              />
              <button
                onClick={() => setFilters({ ...filters })}
                className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-2 py-1 text-xs text-slate-700 hover:bg-sky-50"
                title="รีเฟรช"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                รีเฟรช
              </button>
            </div>
          </div>
          <div className="p-3">
            {loading && !trend.length ? (
              <ChartSkeleton height={320} />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <ComposedChart data={trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="bucket" stroke={SLATE} tickFormatter={(v: string) => formatBucket(v, trendGroup)} />
                  <YAxis yAxisId="left" domain={[0, 5]} allowDecimals={false} stroke={SLATE} label={{ value: "คะแนนเฉลี่ย", angle: -90, position: "insideLeft" }} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} stroke={SLATE} label={{ value: "จำนวนคำตอบ", angle: 90, position: "insideRight" }} />
                  <Tooltip labelFormatter={(v) => formatBucket(String(v), trendGroup)} />
                  <Legend />
                  <Area yAxisId="right" type="monotone" dataKey={(d: TrendPoint) => Number(d.answers)} name="จำนวนคำตอบ" fill="#c7d2fe" stroke="#6366f1" />
                  <Line yAxisId="left" type="monotone" dataKey={(d: TrendPoint) => (typeof d.avg_rating === "number" ? d.avg_rating : Number(d.avg_rating) || 0)} name="คะแนนเฉลี่ย" stroke="#0ea5e9" strokeWidth={2.2} dot={{ r: 2.5 }} activeDot={{ r: 4 }} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* หน่วยงานทั้งหมด — อ้างอิงโทนหลัก */}
        <section className="mt-6 rounded-2xl border border-sky-100 bg-white overflow-hidden">
          <div className="flex flex-col gap-2 border-b border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100 px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-medium text-slate-900">หน่วยงานทั้งหมด</div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <input
                  className="w-[240px] rounded-lg border border-sky-300 bg-white pl-8 pr-8 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                  placeholder="ค้นหา (รหัส/ชื่อหน่วยงาน)"
                  value={deptSearch}
                  onChange={(e) => { setDeptSearch(e.target.value); setPage(1); }}
                />
                {deptSearch && (
                  <button
                    onClick={() => setDeptSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:text-slate-600"
                    aria-label="ล้างคำค้นหา"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Page size */}
              <select
                className="rounded-lg border border-sky-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              >
                {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n} แถว/หน้า</option>)}
              </select>

              {/* Export */}
              <button
                onClick={onExportAll}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-3 py-2 text-sm text-white hover:bg-sky-700"
                title="ส่งออกข้อมูลทั้งหมด (ตามการค้นหาปัจจุบัน) เป็น Excel"
              >
                <Download className="h-4 w-4" />
                ส่งออก Excel
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-[860px] w-full text-sm">
              <thead className="bg-gradient-to-r from-sky-50 to-sky-100 border-b border-sky-200">
                <tr>
                  <th className="p-2 text-left w-20 font-semibold text-slate-800">ลำดับ</th>
                  <th className="p-2 text-left font-semibold text-slate-800">หน่วยงาน</th>
                  <th className="p-2 text-right font-semibold text-slate-800">คะแนนเฉลี่ย</th>
                  <th className="p-2 text-right font-semibold text-slate-800">จำนวนคำตอบ</th>
                  <th className="p-2 text-right font-semibold text-slate-800">% สูง (4–5)</th>
                  <th className="p-2 text-right font-semibold text-slate-800">% ต่ำ (1–2)</th>
                  <th className="p-2 text-right w-28 font-semibold text-slate-800">เปิดดู</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-sky-50/30">
                {filteredAll.rows.map((r, i) => {
                  const idx = (page - 1) * pageSize + i + 1;
                  const score = r.score ?? 0;
                  const hi = Math.round((r.pct_high || 0) * 100);
                  const lo = Math.round((r.pct_low || 0) * 100);
                  return (
                    <tr key={r.department_code} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                      <td className="p-2">{idx}</td>
                      <td className="p-2">
                        <div className="font-medium text-slate-800">{r.department_name}</div>
                        <div className="text-xs text-slate-500">{r.department_code}</div>
                      </td>
                      <td className="p-2 text-right">{score.toFixed(2)}</td>
                      <td className="p-2 text-right">{r.answers.toLocaleString()}</td>
                      <td className="p-2 text-right">
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700 ring-1 ring-emerald-200 text-xs">{hi}%</span>
                      </td>
                      <td className="p-2 text-right">
                        <span className="rounded-full bg-rose-50 px-2 py-0.5 text-rose-700 ring-1 ring-rose-200 text-xs">{lo}%</span>
                      </td>
                      <td className="p-2 text-right">
                        <a
                          className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-700"
                          href={`/dashboard/${r.department_code}`}
                          title="เปิดแดชบอร์ดหน่วยงาน"
                          target="_blank"
                          rel="noreferrer"
                        >
                          <ExternalLink className="h-4 w-4" />
                          เปิดดู
                        </a>
                      </td>
                    </tr>
                  );
                })}
                {!filteredAll.rows.length && (
                  <tr>
                    <td className="p-4 text-slate-500" colSpan={7}>
                      ไม่มีข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex items-center justify-between gap-2 border-t border-sky-100 bg-white px-3 py-2 text-xs text-slate-600">
            <div>
              แสดง {(filteredAll.total === 0 ? 0 : (page - 1) * pageSize + 1).toLocaleString()} -{" "}
              {Math.min(filteredAll.total, page * pageSize).toLocaleString()} จาก{" "}
              {filteredAll.total.toLocaleString()} รายการ
            </div>
            <div className="flex items-center gap-2">
              <button
                className="rounded-lg border border-sky-200 px-2 py-1 hover:bg-sky-50 disabled:opacity-60"
                onClick={() => changePage(page - 1)}
                disabled={page <= 1}
              >
                ก่อนหน้า
              </button>
              <span>หน้า {page} / {filteredAll.pages}</span>
              <button
                className="rounded-lg bg-sky-600 px-2 py-1 text-white hover:bg-sky-700 disabled:opacity-60"
                onClick={() => changePage(page + 1)}
                disabled={page >= filteredAll.pages}
              >
                ถัดไป
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ----------------- UI Components ----------------- */
function ErrorAlert({ message }: { message: string }) {
  return (
    <div role="alert" className="mt-3 rounded-xl border border-red-200 bg-red-50 p-3 text-red-800">
      <div className="flex items-start gap-2">
        <span className="text-lg">⚠️</span>
        <div>
          <div className="font-medium">เกิดข้อผิดพลาด</div>
          <div className="text-sm">{message}</div>
        </div>
      </div>
    </div>
  );
}

function KpiCard({ title, value, emphasize, icon }: { title: string; value: string | number; emphasize?: boolean; icon?: string }) {
  return (
    <div className={`group relative overflow-hidden rounded-2xl border bg-white p-4 ring-1 ring-transparent transition hover:shadow-md ${
      emphasize ? "border-sky-200 ring-sky-100" : "border-slate-200"
    }`}>
      <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-sky-50 opacity-70 transition group-hover:scale-110" />
      <div className="text-xs text-slate-500">{title}</div>
      <div className={`mt-1 ${emphasize ? "text-2xl" : "text-xl"} font-semibold tracking-tight text-slate-900`}>{value}</div>
      {icon && <div className="absolute bottom-2 right-3 text-xl opacity-70">{icon}</div>}
    </div>
  );
}

function KpiSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-20 animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />
      ))}
    </div>
  );
}

function ChartSkeleton({ height = 260 }: { height?: number }) {
  return <div style={{ height }} className="w-full animate-pulse rounded-xl border border-slate-200 bg-slate-100" />;
}

function ChartCard({
  title,
  children,
  loading,
  onRefresh,
}: {
  title: string;
  children: React.ReactNode;
  loading?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-sky-100 bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100 px-3 py-2">
        <div className="font-medium text-slate-900">{title}</div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 px-2 py-1 text-xs text-slate-700 hover:bg-sky-50"
            title="รีเฟรช"
          >
            <RefreshCcw className="h-3.5 w-3.5" />
            รีเฟรช
          </button>
        )}
      </div>
      <div className="p-3">{loading ? <ChartSkeleton /> : children}</div>
    </div>
  );
}

function Segmented({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { label: string; value: string }[];
}) {
  return (
    <div className="inline-flex items-center rounded-xl border border-sky-200 bg-white p-1 text-xs">
      {options.map((op) => {
        const active = op.value === value;
        return (
          <button
            key={op.value}
            onClick={() => onChange(op.value)}
            className={`rounded-lg px-3 py-1.5 transition ${active ? "bg-sky-600 text-white" : "text-slate-700 hover:bg-sky-50"}`}
            aria-pressed={active}
          >
            {op.label}
          </button>
        );
      })}
    </div>
  );
}
