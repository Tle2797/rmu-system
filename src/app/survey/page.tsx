"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type DepartmentRow = {
  id: number;
  code: string;
  name: string;
  qr_code?: string | null;
};

export default function SurveyIndexPage() {
  useEffect(() => {
    document.body.style.overflowY = "auto";
    return () => { document.body.style.overflowY = "auto"; };
  }, []);

  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState("");
  const [centralLink, setCentralLink] = useState<string>("/survey");
  const [centralQR, setCentralQR] = useState<string>("/api/qrcode/central.png");
  const [visibleCount, setVisibleCount] = useState(9); // แสดง 9 หน่วยงานเริ่มต้น

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get<DepartmentRow[]>("/api/departments");
        if (!active) return;
        setDepartments(Array.isArray(res.data) ? res.data : []);
        setErr("");
      } catch (e: any) {
        if (!active) return;
        setErr(e?.response?.data?.error || "โหลดรายชื่อหน่วยงานไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    })();

    try {
      const abs = `${window.location.origin}/survey`;
      setCentralLink(abs);
    } catch {}

    return () => { active = false; };
  }, []);

  const filtered = useMemo(() => {
    if (!q.trim()) return departments;
    const s = q.toLowerCase();
    return departments.filter(
      (d) =>
        d.code.toLowerCase().includes(s) || d.name.toLowerCase().includes(s)
    );
  }, [departments, q]);

  const visibleDepartments = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const download = (url: string, filename = "central-qr") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  };

  const SkeletonCard = () => (
    <div className="rounded-xl border bg-white shadow-sm p-6 flex flex-col items-center justify-center text-center animate-pulse">
      <div className="h-4 w-3/4 rounded bg-slate-200 mb-3" />
      <div className="h-8 w-28 rounded bg-slate-200" />
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-hidden bg-gradient-to-b from-sky-50 via-white to-slate-50">
      <header className="sticky top-0 z-20 border-b bg-white/90 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-center sm:justify-start gap-3">
          <img src="/logos/rmu.png" alt="RMU Logo" className="w-10 h-10 sm:w-12 sm:h-12 object-contain" />
          <h1 className="text-lg sm:text-2xl font-extrabold text-slate-800 text-center sm:text-left">
            แบบประเมินความพึงพอใจหน่วยงาน
          </h1>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:py-10 space-y-8">
        {/* รายชื่อหน่วยงาน */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-slate-50 to-white">
            <h2 className="text-base sm:text-lg font-semibold text-slate-900">
              ค้นหาและเลือกหน่วยงาน
            </h2>
            <p className="text-[13px] text-slate-600 mt-1">
              พิมพ์ชื่อหน่วยงาน แล้วคลิกเพื่อไปทำแบบประเมิน
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="mt-3 flex flex-col sm:flex-row gap-2">
              <input
                className="w-full sm:w-[320px] rounded-lg border p-2 focus:border-blue-500 focus:ring-blue-500 text-sm"
                placeholder="ค้นหาชื่อหน่วยงาน"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button type="submit" className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm shadow-sm w-full sm:w-auto">
                ค้นหา
              </button>
            </form>
          </div>

          {/* loading */}
          {loading && (
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
            </div>
          )}
          {!loading && err && <div className="p-6 text-rose-700 bg-rose-50 text-center">❌ {err}</div>}
          {!loading && !err && filtered.length === 0 && (
            <div className="p-6 text-slate-500 text-center">ไม่พบหน่วยงาน</div>
          )}

          {/* แสดงหน่วยงาน */}
          {!loading && !err && filtered.length > 0 && (
            <>
              <div className="p-4 sm:p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
                {visibleDepartments.map((d) => (
                  <div
                    key={d.id}
                    className="group rounded-xl border bg-white shadow-sm p-5 flex flex-col items-center justify-center text-center hover:shadow-md transition-all"
                  >
                    <div className="font-semibold text-slate-900 text-sm sm:text-base mb-4">
                      {d.name}
                    </div>
                    <a
                      href={`/survey/${encodeURIComponent(d.code)}`}
                      target="_blank"
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-sm shadow-sm transition w-full sm:w-auto"
                    >
                      เริ่มทำแบบประเมิน
                    </a>
                  </div>
                ))}
              </div>

              {hasMore && (
                <div className="p-4 flex justify-center">
                  <button
                    onClick={() => setVisibleCount((v) => v + 9)}
                    className="rounded-lg bg-slate-100 hover:bg-slate-200 px-6 py-2 text-sm font-medium text-slate-700 shadow-sm"
                  >
                    ดูเพิ่มเติม
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      </main>
    </div>
  );
}
