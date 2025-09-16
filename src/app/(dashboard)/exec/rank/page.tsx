"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import GlobalFilters, { Filters } from "@/components/filters/GlobalFilters";

/** ---------- Types ---------- */
type HeatRow = {
  department_code: string;
  department_name: string;
  question_id: number;
  question_text: string;
  avg_rating: number | null;
};

type Question = { id: number; text: string };
type Department = { code: string; name: string };

type MatrixData = {
  questions: Question[];
  depts: Department[];
  map: Map<string, number | null>; // key = `${deptCode}-${questionId}`
};

type RankRow = {
  department_code: string;
  department_name: string;
  score: number | null;
  answers: number;
  pct_high: number; // 0..1
  pct_low: number;  // 0..1
};

const PAGE_SIZE = 10;

/** ---------- Page ---------- */
export default function ExecRankPage() {
  // ✔ ฟิลเตอร์กลาง (default = survey 1)
  const [filters, setFilters] = useState<Filters>({ survey_id: 1 });

  // ✔ สถานะ Heatmap
  const [matrix, setMatrix] = useState<MatrixData>({
    questions: [],
    depts: [],
    map: new Map(),
  });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  // ✔ สถานะ Ranking
  const [rank, setRank] = useState<RankRow[]>([]);
  const [loadingRank, setLoadingRank] = useState(false);

  // ✔ อ้างอิงตัวเลื่อนแนวนอน
  const scrollerRef = useRef<HTMLDivElement | null>(null);

  // ✔ แบ่งหน้า Heatmap
  const [page, setPage] = useState(1);

  // -------- Deep-link ผ่าน URL --------
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // (1) ตอน mount: อ่าน query → ตั้งค่า filters เริ่มต้น
  useEffect(() => {
    const from = searchParams.get("from") || undefined;
    const to = searchParams.get("to") || undefined;
    const groups = searchParams.get("groups")?.split(",").filter(Boolean);
    const departments = searchParams.get("departments")?.split(",").filter(Boolean);
    const rating_min = searchParams.get("rating_min")
      ? Number(searchParams.get("rating_min"))
      : undefined;
    const rating_max = searchParams.get("rating_max")
      ? Number(searchParams.get("rating_max"))
      : undefined;
    const survey_id = searchParams.get("survey_id")
      ? Number(searchParams.get("survey_id"))
      : 1;

    setFilters({ survey_id, from, to, groups, departments, rating_min, rating_max });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ทำครั้งเดียว

  // (2) เมื่อ filters เปลี่ยน: อัปเดต query string (แชร์ลิงก์ได้)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (filters.groups?.length) sp.set("groups", filters.groups.join(","));
    if (filters.departments?.length) sp.set("departments", filters.departments.join(","));
    if (filters.rating_min != null) sp.set("rating_min", String(filters.rating_min));
    if (filters.rating_max != null) sp.set("rating_max", String(filters.rating_max));
    sp.set("survey_id", String(filters.survey_id ?? 1));
    router.replace(`${pathname}?${sp.toString()}`);
  }, [filters, router, pathname]);

  // -------- โหลด Heatmap ตามฟิลเตอร์ --------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setErr("");
        setLoading(true);

        const res = await axios.get<HeatRow[]>("/api/exec/heatmap", {
          params: { ...filters },
        });
        const rows = Array.isArray(res.data) ? res.data : [];

        // ✅ สร้างรายการหน่วยงาน (ไม่ซ้ำ)
        const deptKeys = Array.from(
          new Set(rows.map((r) => `${r.department_code}|${r.department_name}`))
        );
        const depts: Department[] = deptKeys.map((k) => {
          const [code, name] = k.split("|");
          return { code, name };
        });

        // ✅ สร้างรายการคำถาม (ไม่ซ้ำ)
        const qKeys = Array.from(
          new Set(rows.map((r) => `${r.question_id}|${r.question_text}`))
        );
        const questions: Question[] = qKeys.map((k) => {
          const [idStr, text] = k.split("|");
          return { id: Number(idStr), text };
        });

        // ✅ ทำแผนที่ค่าเฉลี่ยต่อเซลล์
        const map = new Map<string, number | null>();
        for (const r of rows) {
          map.set(`${r.department_code}-${r.question_id}`, r.avg_rating);
        }

        if (!mounted) return;
        setMatrix({ questions, depts, map });
        setPage(1); // รีเซ็ตหน้าเมื่อข้อมูล/ฟิลเตอร์เปลี่ยน
        // รีเซ็ต scroll ไปซ้ายสุด
        requestAnimationFrame(() => scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" }));
      } catch (e) {
        if (!mounted) return;
        setErr("โหลด Heatmap ไม่สำเร็จ");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [filters]);

  // -------- โหลด Ranking (Top/Bottom) --------
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingRank(true);
        const rk = await axios.get<RankRow[]>("/api/exec/rank", { params: { ...filters } });
        if (!mounted) return;
        setRank(Array.isArray(rk.data) ? rk.data : []);
      } catch {
        if (!mounted) return;
      } finally {
        if (mounted) setLoadingRank(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [filters]);

  // -------- ปรับปรุงประสิทธิภาพ: avgMap (เฉลี่ยต่อหน่วยงานคำนวณครั้งเดียว) --------
  const avgMap = useMemo(() => {
    const m = new Map<string, number | null>();
    for (const d of matrix.depts) {
      let sum = 0, cnt = 0;
      for (const q of matrix.questions) {
        const v = matrix.map.get(`${d.code}-${q.id}`);
        if (typeof v === "number") {
          sum += v;
          cnt++;
        }
      }
      m.set(d.code, cnt ? +(sum / cnt).toFixed(2) : null);
    }
    return m;
  }, [matrix.depts, matrix.questions, matrix.map]);

  // -------- เรียงลำดับหน่วยงาน: คะแนนเฉลี่ยมาก → น้อย (null อยู่ล่างสุด) --------
  const sortedDepts = useMemo(() => {
    const depts = [...matrix.depts];
    depts.sort((a, b) => {
      const av = avgMap.get(a.code);
      const bv = avgMap.get(b.code);
      if (av == null && bv == null) return a.name.localeCompare(b.name, "th");
      if (av == null) return 1;
      if (bv == null) return -1;
      if (bv !== av) return bv - av; // มากไปน้อย
      // tie-breaker: ชื่อ ก-ฮ/ก-ฮ
      return a.name.localeCompare(b.name, "th");
    });
    return depts;
  }, [matrix.depts, avgMap]);

  // -------- แบ่งหน้า --------
  const totalPages = Math.max(1, Math.ceil(sortedDepts.length / PAGE_SIZE));
  const startIdx = (page - 1) * PAGE_SIZE;
  const endIdx = Math.min(sortedDepts.length, startIdx + PAGE_SIZE);
  const pagedDepts = sortedDepts.slice(startIdx, endIdx);

  // -------- สรุปข้อความหัวตาราง --------
  const headerHint = useMemo(() => {
    const qCount = matrix.questions.length;
    const dCount = matrix.depts.length;
    return `หน่วยงาน ${dCount.toLocaleString()} หน่วยงาน × คำถาม ${qCount.toLocaleString()} ข้อ`;
  }, [matrix.questions.length, matrix.depts.length]);

  // -------- ฟังก์ชันเลื่อนตาราง --------
  const scrollByCols = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = 8 * 72; // เลื่อนทีละ ~8 คอลัมน์ (คอลัมน์ละ ~72px)
    el.scrollBy({ left: dir === "left" ? -step : step, behavior: "smooth" });
  };

  // -------- เลื่อนด้วยคีย์บอร์ด (← →) --------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") scrollByCols("left");
      if (e.key === "ArrowRight") scrollByCols("right");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // -------- สีพื้นของเซลล์ตามเกณฑ์คะแนน --------
  const cellBg = (v: number | null | undefined) => {
    if (v == null) return "bg-slate-100 text-slate-500";
    if (v >= 4.5) return "bg-emerald-200 text-emerald-900";
    if (v >= 4.0) return "bg-green-200 text-green-900";
    if (v >= 3.5) return "bg-yellow-200 text-yellow-900";
    if (v >= 3.0) return "bg-amber-200 text-amber-900";
    return "bg-red-200 text-red-900";
  };

  // -------- คลิกเซลล์ = กรองหน่วยงานนั้นต่อทันที --------
  const onCellClick = (deptCode: string, qid: number) => {
    setFilters((prev) => ({ ...prev, departments: [deptCode] }));
  };

  // -------- เตรียม Top 5 / Bottom 5 --------
  const top5 = useMemo(() => rank.filter((r) => r.score != null).slice(0, 5), [rank]);
  const bottom5 = useMemo(() => {
    const arr = rank.filter((r) => r.score != null);
    return arr.slice(-5).reverse();
  }, [rank]);

  // -------- เปลี่ยนหน้า --------
  const goPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    // รีเซ็ต scroll แนวนอนเมื่อเปลี่ยนหน้า
    requestAnimationFrame(() => scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" }));
  };

  return (
    <div className="max-w-[1200px] mx-auto p-4 space-y-6">
      {/* หัวเรื่อง */}
      <header>
        <h1 className="text-xl font-semibold">จัดอันดับหน่วยงาน & Heatmap</h1>
        <p className="text-slate-600 text-sm">Heatmap (หน่วยงาน × คำถาม) — {headerHint}</p>
      </header>

      {/* ฟิลเตอร์กลาง */}
      <GlobalFilters value={filters} onChange={setFilters} />

      {/* HEATMAP */}
      <section className="relative rounded-2xl border bg-white">
        {/* Header */}
        <div className="p-3 border-b bg-slate-50 flex items-center justify-between rounded-t-2xl">
          <div>
            <div className="font-medium">Heatmap (หน่วยงาน × คำถาม)</div>
            <p className="text-xs text-slate-500">
              คลิกเซลล์เพื่อกรองเฉพาะหน่วยงานนั้น • แสดงหน่วยงาน {startIdx + 1}-{endIdx} จากทั้งหมด {sortedDepts.length}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => scrollByCols("left")}
              className="px-2 py-1.5 text-sm rounded-lg border hover:bg-slate-50"
            >
              ← เลื่อน
            </button>
            <button
              onClick={() => scrollByCols("right")}
              className="px-2 py-1.5 text-sm rounded-lg border hover:bg-slate-50"
            >
              เลื่อน →
            </button>
          </div>
        </div>

        <div className="relative">
          {/* เงา gradient ฝั่งขวา (สวยงาม) */}
          <div className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white to-transparent z-20 rounded-br-2xl" />

          <div ref={scrollerRef} className="overflow-x-auto">
            {loading ? (
              <HeatmapSkeleton />
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_rgba(0,0,0,0.06)]">
                  <tr className="border-b">
                    <th className="sticky left-0 z-20 bg-white p-2 text-left w-[260px]">
                      หน่วยงาน \ คำถาม
                    </th>
                    {matrix.questions.map((q) => (
                      <th
                        key={q.id}
                        className="p-2 text-center w-[72px] min-w-[72px] max-w-[72px]"
                      >
                        <div className="font-medium">Q{q.id}</div>
                        <div className="text-[11px] text-slate-500 truncate" title={q.text}>
                          {q.text}
                        </div>
                      </th>
                    ))}
                    <th className="p-2 text-center w-[88px] min-w-[88px] max-w-[88px] bg-slate-50">
                      เฉลี่ย
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pagedDepts.map((d) => {
                    const avg = avgMap.get(d.code) ?? null; // ✅ ใช้ avgMap
                    return (
                      <tr key={d.code} className="border-b last:border-0">
                        <td className="sticky left-0 z-10 bg-white p-2 pr-6">
                          <a
                            href={`/dashboard/${d.code}`}
                            className="font-medium text-blue-600 hover:underline"
                            title={`เปิดแดชบอร์ดของ ${d.name}`}
                          >
                            {d.name}
                          </a>
                          <div className="text-xs text-slate-500">{d.code}</div>
                        </td>

                        {matrix.questions.map((q) => {
                          const val = matrix.map.get(`${d.code}-${q.id}`);
                          return (
                            <td key={q.id} className="p-2 text-center">
                              <button
                                title={`${d.name} • Q${q.id} • ${q.text} = ${val ?? "-"}`}
                                onClick={() => onCellClick(d.code, q.id)}
                                className={`w-[64px] h-[40px] rounded-lg ${cellBg(val)} 
                                  border border-black/5 shadow-sm 
                                  hover:scale-[1.03] transition-transform`}
                              >
                                <span className="font-medium">{val ?? "-"}</span>
                              </button>
                            </td>
                          );
                        })}

                        <td className="p-2 text-center bg-slate-50">
                          <a
                            href={`/dashboard/${d.code}`}
                            className="inline-flex items-center justify-center w-[72px] h-[40px] rounded-lg bg-blue-50 text-blue-700 font-semibold border border-blue-100 hover:bg-blue-100"
                            title={`เปิดแดชบอร์ดของ ${d.name}`}
                          >
                            {avg == null ? "-" : avg.toFixed(2)}
                          </a>
                        </td>
                      </tr>
                    );
                  })}

                  {!loading && !pagedDepts.length && (
                    <tr>
                      <td
                        className="p-3 text-slate-500"
                        colSpan={1 + matrix.questions.length + 1}
                      >
                        ไม่มีข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Legend + Pagination */}
        <div className="p-3 border-t bg-white rounded-b-2xl flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600">
            <span>Legend:</span>
            <LegendChip label="≤ 2.9" className="bg-red-200 text-red-900" />
            <LegendChip label="3.0 – 3.49" className="bg-amber-200 text-amber-900" />
            <LegendChip label="3.5 – 3.99" className="bg-yellow-200 text-yellow-900" />
            <LegendChip label="4.0 – 4.49" className="bg-green-200 text-green-900" />
            <LegendChip label="≥ 4.5" className="bg-emerald-200 text-emerald-900" />
          </div>

          {/* Pagination Controls */}
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-50"
            >
              ก่อนหน้า
            </button>
            <div className="px-2">
              หน้า <span className="font-semibold">{page}</span> / {totalPages}
            </div>
            <button
              onClick={() => goPage(page + 1)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 rounded-lg border disabled:opacity-50"
            >
              ถัดไป
            </button>
          </div>
        </div>
      </section>

      {/* TOP / BOTTOM */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <RankTable title="TOP 5 หน่วยงาน" rows={top5} highlight="top" loading={loadingRank} />
        <RankTable
          title="BOTTOM 5 หน่วยงาน"
          rows={bottom5}
          highlight="bottom"
          loading={loadingRank}
        />
      </section>

      {err && <p className="text-sm text-red-600">{err}</p>}
    </div>
  );
}

/** ---------- Legend ---------- */
function LegendChip({ label, className }: { label: string; className: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 px-2 py-1 rounded-lg border border-black/5 ${className}`}
    >
      <span className="inline-block w-3 h-3 rounded-sm bg-black/20 mix-blend-multiply" />
      {label}
    </span>
  );
}

/** ---------- Loading Skeleton ---------- */
function HeatmapSkeleton() {
  return (
    <div className="p-3">
      <div className="space-y-2">
        {[...Array(8)].map((_, r) => (
          <div key={r} className="flex gap-2">
            <div className="h-10 w-64 bg-slate-100 animate-pulse rounded-md" />
            {[...Array(10)].map((__, c) => (
              <div key={c} className="h-10 w-16 bg-slate-100 animate-pulse rounded-md" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** ---------- Rank Table ---------- */
function RankTable({
  title,
  rows,
  highlight,
  loading,
}: {
  title: string;
  rows: RankRow[];
  highlight: "top" | "bottom";
  loading?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-white overflow-hidden">
      <div className="p-3 border-b bg-slate-50 font-medium">{title}</div>
      <div className="overflow-x-auto">
        <table className="min-w-[680px] w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="p-2 text-left w-10">#</th>
              <th className="p-2 text-left">หน่วยงาน</th>
              <th className="p-2 text-right">คะแนนเฉลี่ย</th>
              <th className="p-2 text-right">จำนวนคำตอบ</th>
              <th className="p-2 text-right">% สูง</th>
              <th className="p-2 text-right">% ต่ำ</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={6}>
                  กำลังโหลด…
                </td>
              </tr>
            )}
            {!loading &&
              rows.map((r, i) => {
                const hi = Math.round((r.pct_high || 0) * 100);
                const lo = Math.round((r.pct_low || 0) * 100);
                const badge =
                  highlight === "top" && i < 3
                    ? ["🥇", "🥈", "🥉"][i]
                    : highlight === "bottom" && i < 3
                    ? "⚠️"
                    : null;

                return (
                  <tr key={r.department_code} className="border-b last:border-0">
                    <td className="p-2">{i + 1}</td>
                    <td className="p-2">
                      <a
                        href={`/dashboard/${r.department_code}`}
                        className="text-blue-600 hover:underline"
                      >
                        {r.department_name}
                      </a>{" "}
                      <span className="text-xs text-slate-500">({r.department_code})</span>{" "}
                      {badge && <span className="ml-1">{badge}</span>}
                    </td>
                    <td className="p-2 text-right">{(r.score ?? 0).toFixed(2)}</td>
                    <td className="p-2 text-right">{r.answers.toLocaleString()}</td>
                    <td className="p-2 text-right">{hi}%</td>
                    <td className="p-2 text-right">{lo}%</td>
                  </tr>
                );
              })}
            {!loading && !rows.length && (
              <tr>
                <td className="p-3 text-slate-500" colSpan={6}>
                  ไม่มีข้อมูล
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
