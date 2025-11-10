"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import axios from "axios";
import { Filters } from "@/components/filters/GlobalFilters";

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
  pct_low: number; // 0..1
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

  // ✔ อ้างอิงตัวเลื่อนแนวนอน (ใช้กับ Heatmap)
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
    const departments = searchParams.get("departments")
      ?.split(",")
      .filter(Boolean);
    const rating_min = searchParams.get("rating_min")
      ? Number(searchParams.get("rating_min"))
      : undefined;
    const rating_max = searchParams.get("rating_max")
      ? Number(searchParams.get("rating_max"))
      : undefined;
    const survey_id = searchParams.get("survey_id")
      ? Number(searchParams.get("survey_id"))
      : 1;

    setFilters({
      survey_id,
      from,
      to,
      groups,
      departments,
      rating_min,
      rating_max,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // ทำครั้งเดียว

  // (2) เมื่อ filters เปลี่ยน: อัปเดต query string (แชร์ลิงก์ได้)
  useEffect(() => {
    const sp = new URLSearchParams();
    if (filters.from) sp.set("from", filters.from);
    if (filters.to) sp.set("to", filters.to);
    if (filters.groups?.length) sp.set("groups", filters.groups.join(","));
    if (filters.departments?.length)
      sp.set("departments", filters.departments.join(","));
    if (filters.rating_min != null)
      sp.set("rating_min", String(filters.rating_min));
    if (filters.rating_max != null)
      sp.set("rating_max", String(filters.rating_max));
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
        requestAnimationFrame(() =>
          scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" })
        );
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
        const rk = await axios.get<RankRow[]>("/api/exec/rank", {
          params: { ...filters },
        });
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
      let sum = 0,
        cnt = 0;
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
    return `หน่วยงาน ${dCount.toLocaleString()} หน่วยงาน · คำถาม ${qCount.toLocaleString()} ข้อ`;
  }, [matrix.questions.length, matrix.depts.length]);

  // -------- ฟังก์ชันเลื่อนตาราง (ใช้กับคีย์บอร์ด เผื่อกรณีจอเล็กมาก) --------
  const scrollByCols = (dir: "left" | "right") => {
    const el = scrollerRef.current;
    if (!el) return;
    const step = 6 * 64;
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
  const top5 = useMemo(
    () => rank.filter((r) => r.score != null).slice(0, 5),
    [rank]
  );
  const bottom5 = useMemo(() => {
    const arr = rank.filter((r) => r.score != null);
    return arr.slice(-5).reverse();
  }, [rank]);

  // -------- เปลี่ยนหน้า --------
  const goPage = (p: number) => {
    const next = Math.min(Math.max(1, p), totalPages);
    setPage(next);
    requestAnimationFrame(() =>
      scrollerRef.current?.scrollTo({ left: 0, behavior: "auto" })
    );
  };

  const surveyIdLabel = filters.survey_id ?? 1;

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      {/* ---------- Header ---------- */}
      <header className="rounded-2xl border border-slate-200 bg-gradient-to-r from-white via-sky-50 to-blue-100 p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              ภาพรวมการจัดอันดับหน่วยงาน
            </h1>
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 font-medium shadow-sm">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              {matrix.depts.length.toLocaleString()} หน่วยงาน
            </span>
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-100 text-amber-800 px-3 py-1 font-medium shadow-sm">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {matrix.questions.length.toLocaleString()} คำถาม
            </span>
          </div>
        </div>
      </header>

      {/* ---------- HEATMAP ---------- */}
      <section className="relative rounded-2xl border border-slate-200 bg-slate-50/60 shadow-sm">
        {/* Header ของการ์ด Heatmap */}
        <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b bg-white/80 px-4 py-3 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-sky-100 text-sky-700 text-xs">
                ☷
              </span>
              <h2 className="text-sm font-semibold text-slate-800">
                Heatmap คะแนนเฉลี่ย (หน่วยงาน × คำถาม)
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-500">{headerHint}</p>
          </div>
        </div>

        <div className="relative">
          <div
            ref={scrollerRef}
            className="overflow-x-auto lg:overflow-x-visible"
          >
            {loading ? (
              <HeatmapSkeleton />
            ) : (
              <table className="w-full text-[11px] lg:text-xs table-fixed">
                <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur shadow-[0_1px_0_rgba(15,23,42,0.08)]">
                  <tr className="border-b border-slate-200">
                    <th className="sticky left-0 z-20 bg-slate-50/95 p-2 pl-3 text-left w-[210px] text-[11px] font-semibold text-slate-700 align-bottom">
                      หน่วยงาน \ คำถาม
                    </th>
                    {matrix.questions.map((q) => (
                      <th
                        key={q.id}
                        className="p-1 text-center w-[80px] min-w-[70px] max-w-[90px] align-bottom"
                      >
                        <div
                          className="text-[10px] leading-tight text-slate-700 line-clamp-3"
                          title={q.text}
                        >
                          {q.text}
                        </div>
                      </th>
                    ))}
                    <th className="p-1 text-center w-[70px] min-w-[70px] max-w-[72px] bg-slate-100 text-[11px] font-semibold text-slate-700 align-bottom">
                      เฉลี่ย
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {pagedDepts.map((d, rowIndex) => {
                    const avg = avgMap.get(d.code) ?? null;
                    const rowBg =
                      rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/80";
                    return (
                      <tr
                        key={d.code}
                        className={`border-b border-slate-100 last:border-0 ${rowBg}`}
                      >
                        <td className="sticky left-0 z-10 bg-inherit px-3 py-2">
                          <a
                            href={`/dashboard/${d.code}`}
                            className="font-medium text-[11px] lg:text-xs text-slate-800 hover:text-sky-700 hover:underline"
                            title={`เปิดแดชบอร์ดของ ${d.name}`}
                          >
                            {d.name}
                          </a>
                        </td>

                        {matrix.questions.map((q) => {
                          const val = matrix.map.get(`${d.code}-${q.id}`);
                          const displayVal =
                            typeof val === "number" ? val.toFixed(2) : "-";
                          return (
                            <td key={q.id} className="p-1 text-center">
                              <button
                                title={`${d.name} • ${q.text} = ${displayVal}`}
                                onClick={() => onCellClick(d.code, q.id)}
                                className={`w-full min-w-[60px] h-[34px] rounded-md ${cellBg(
                                  val ?? null
                                )} border border-black/5 shadow-sm 
                                  hover:scale-[1.02] hover:border-slate-400/60 transition-transform`}
                              >
                                <span className="font-semibold text-[11px]">
                                  {displayVal}
                                </span>
                              </button>
                            </td>
                          );
                        })}

                        <td className="p-1 text-center bg-slate-100">
                          <a
                            href={`/dashboard/${d.code}`}
                            className="inline-flex items-center justify-center w-full min-w-[64px] h-[34px] rounded-md bg-sky-50 text-sky-800 text-[11px] font-semibold border border-sky-100 hover:bg-sky-100"
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
                        className="p-4 text-sm text-slate-500 text-center"
                        colSpan={1 + matrix.questions.length + 1}
                      >
                        ไม่มีข้อมูลตามเงื่อนไขที่เลือก
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Footer: Pagination */}
        <div className="flex flex-col items-center justify-between gap-2 border-t bg-white/90 px-4 py-3 rounded-b-2xl sm:flex-row">
          <p className="text-xs text-slate-500">
            ทั้งหมด{" "}
            <span className="font-semibold text-slate-700">
              {sortedDepts.length.toLocaleString()}
            </span>{" "}
            หน่วยงาน · หน้าที่{" "}
            <span className="font-semibold text-slate-700">{page}</span> /{" "}
            {totalPages}
          </p>
          <div className="flex items-center gap-2 text-sm">
            <button
              onClick={() => goPage(page - 1)}
              disabled={page <= 1}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              ‹ ก่อนหน้า
            </button>
            <span className="text-xs text-slate-600">
              หน้า <span className="font-semibold">{page}</span> จาก{" "}
              {totalPages}
            </span>
            <button
              onClick={() => goPage(page + 1)}
              disabled={page >= totalPages}
              className="inline-flex items-center gap-1 rounded-full border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"
            >
              ถัดไป ›
            </button>
          </div>
        </div>
      </section>

      {/* ---------- TOP / BOTTOM Ranking ---------- */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <RankTable
          title="TOP 5 หน่วยงาน"
          subtitle="หน่วยงานที่มีคะแนนเฉลี่ยสูงสุด"
          rows={top5}
          highlight="top"
          loading={loadingRank}
        />
        <RankTable
          title="BOTTOM 5 หน่วยงาน"
          subtitle="หน่วยงานที่ควรติดตามและเร่งปรับปรุง"
          rows={bottom5}
          highlight="bottom"
          loading={loadingRank}
        />
      </section>

      {err && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
          {err}
        </p>
      )}
    </div>
  );
}

/** ---------- Loading Skeleton ---------- */
function HeatmapSkeleton() {
  return (
    <div className="p-4">
      <div className="space-y-2">
        {[...Array(7)].map((_, r) => (
          <div key={r} className="flex gap-2">
            <div className="h-9 w-52 bg-slate-100 animate-pulse rounded-md" />
            {[...Array(8)].map((__, c) => (
              <div
                key={c}
                className="h-9 w-14 bg-slate-100 animate-pulse rounded-md"
              />
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
  subtitle,
  rows,
  highlight,
  loading,
}: {
  title: string;
  subtitle?: string;
  rows: RankRow[];
  highlight: "top" | "bottom";
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b bg-slate-50/80 px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
            {subtitle && (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            )}
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {rows.length} หน่วยงาน
          </span>
        </div>
      </div>

      {/* ✅ ตารางจัดพอดีกล่อง ไม่ต้องเลื่อนแนวนอน */}
      <table className="w-full table-fixed text-[11px] sm:text-xs">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50/80">
            <th className="w-[10%] p-2 text-left text-[11px] font-semibold text-slate-600">
              #
            </th>
            <th className="w-[50%] p-2 text-left text-[11px] font-semibold text-slate-600">
              หน่วยงาน
            </th>
            <th className="w-[20%] p-2 text-right text-[11px] font-semibold text-slate-600">
              คะแนนเฉลี่ย
            </th>
            <th className="w-[20%] p-2 text-right text-[11px] font-semibold text-slate-600">
              จำนวนคำตอบ
            </th>
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr>
              <td className="p-3 text-slate-500 text-center" colSpan={4}>
                กำลังโหลด…
              </td>
            </tr>
          )}
          {!loading &&
            rows.map((r, i) => {
              const badge =
                highlight === "top" && i < 3
                  ? ["🥇", "🥈", "🥉"][i]
                  : highlight === "bottom" && i < 3
                  ? "⚠️"
                  : null;

              const scoreColor =
                (r.score ?? 0) >= 4.0
                  ? "text-emerald-600"
                  : (r.score ?? 0) >= 3.0
                  ? "text-amber-600"
                  : "text-red-600";

              return (
                <tr
                  key={r.department_code}
                  className="border-b last:border-0 border-slate-100 hover:bg-slate-50/70 transition-colors"
                >
                  <td className="p-2 text-[11px] text-slate-600">{i + 1}</td>
                  <td className="p-2">
                    <a
                      href={`/dashboard/${r.department_code}`}
                      className="text-[11px] sm:text-sm text-slate-800 hover:text-sky-700 hover:underline"
                    >
                      {r.department_name}
                    </a>
                    {badge && <span className="ml-1">{badge}</span>}
                  </td>
                  <td className="p-2 text-right">
                    <span className={`text-[11px] sm:text-sm font-semibold ${scoreColor}`}>
                      {(r.score ?? 0).toFixed(2)}
                    </span>
                  </td>
                  <td className="p-2 text-right text-[11px] text-slate-700">
                    {r.answers.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          {!loading && !rows.length && (
            <tr>
              <td className="p-3 text-slate-500 text-center" colSpan={4}>
                ไม่มีข้อมูล
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
