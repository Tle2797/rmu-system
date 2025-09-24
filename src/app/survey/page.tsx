// app/survey/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Search, Building2, ExternalLink } from "lucide-react";

/** ประเภทข้อมูลหน่วยงาน */
type DepartmentRow = {
  code: string;
  name: string;
  qr_code?: string | null;
};

export default function SurveyIndexPage() {
  // ---------- สถานะหลัก ----------
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [q, setQ] = useState("");

  // ---------- โหลดรายชื่อหน่วยงาน ----------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get<DepartmentRow[]>("/api/departments");
        if (!active) return;
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        if (!active) return;
        setError(e?.response?.data?.error || "โหลดรายชื่อหน่วยงานไม่สำเร็จ");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // ---------- ค้นหา/กรอง ----------
  const filtered = useMemo(() => {
    const keyword = q.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter(
      (r) => r.code.toLowerCase().includes(keyword) || r.name.toLowerCase().includes(keyword)
    );
  }, [rows, q]);

  return (
    <div className="min-h-screen relative overflow-x-hidden">
      {/* พื้นหลังฟ้าอ่อน */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-slate-50" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      {/* คอนเทนต์ปรับให้พอดีกับหน้าจอ */}
      <main className="mx-auto w-full max-w-3xl px-3 sm:px-4 lg:px-6 py-6 sm:py-8 space-y-5 sm:space-y-6">
        {/* Header */}
        <header className="space-y-1 px-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            เลือกหน่วยงานที่ต้องการประเมิน
          </h1>
          <p className="text-slate-600 text-sm sm:text-base">
            ค้นหาด้วยรหัสหรือชื่อหน่วยงาน แล้วคลิกเพื่อไปยังแบบประเมินของหน่วยงานนั้น ๆ
          </p>
        </header>

        {/* กล่องค้นหา */}
        <section className="rounded-2xl border border-sky-100 bg-white/80 backdrop-blur-sm shadow-sm">
          <div className="p-4 border-b bg-sky-100/50 rounded-t-2xl">
            <div className="font-semibold">ค้นหาและเลือกหน่วยงาน</div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              {/* ช่องค้นหาเด่นชัด */}
              <div className="w-full">
                <label className="sr-only">ค้นหา</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    className="w-full rounded-xl border border-slate-300 bg-white pl-10 pr-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="ค้นหาด้วยรหัสหรือชื่อหน่วยงาน"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                <p className="mt-1 text-[11px] text-slate-500">
                  ทั้งหมด{" "}
                  <span className="font-semibold text-slate-700">{filtered.length.toLocaleString()}</span>{" "}
                  หน่วยงาน
                </p>
              </div>
            </div>

            {/* สถานะโหลด/ผิดพลาด */}
            {loading && (
              <div className="text-slate-500 text-sm">กำลังโหลดรายชื่อหน่วยงาน…</div>
            )}
            {!loading && error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">
                {error}
              </div>
            )}

            {/* รายชื่อหน่วยงาน: การ์ด (มือถือ) + ตาราง (เดสก์ท็อป) */}
            {!loading && !error && (
              <>
                {/* Mobile: Cards */}
                <div className="grid gap-3 sm:hidden">
                  {filtered.map((r) => (
                    <a
                      key={r.code}
                      href={`/survey/${encodeURIComponent(r.code)}`}
                      className="group rounded-xl border bg-white p-4 shadow-sm hover:shadow-md transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="grid place-items-center h-10 w-10 rounded-lg bg-sky-100 text-sky-700 border border-sky-200">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-slate-900 truncate">
                            {r.name}
                          </div>
                          <div className="text-xs text-slate-500">{r.code}</div>
                        </div>
                        <ExternalLink className="h-4 w-4 text-slate-400 group-hover:text-blue-600" />
                      </div>
                    </a>
                  ))}
                  {!filtered.length && (
                    <div className="rounded-xl border bg-white p-4 text-slate-500 text-sm">
                      ไม่พบหน่วยงานที่ตรงกับคำค้นหา
                    </div>
                  )}
                </div>

                {/* Desktop: Table — ยังคุมความกว้างด้วย max-w-3xl ด้านนอกแล้ว */}
                <div className="hidden sm:block overflow-x-auto rounded-xl border">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b">
                      <tr>
                        <th className="text-left p-3 w-[120px]">รหัส</th>
                        <th className="text-left p-3">ชื่อหน่วยงาน</th>
                        <th className="text-right p-3 w-[140px]">ไปแบบประเมิน</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((r) => (
                        <tr key={r.code} className="border-b last:border-0 hover:bg-slate-50/50">
                          <td className="p-3 font-medium text-slate-800">{r.code}</td>
                          <td className="p-3 text-slate-800">{r.name}</td>
                          <td className="p-3">
                            <div className="flex justify-end">
                              <a
                                className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                                href={`/survey/${encodeURIComponent(r.code)}`}
                                title="เปิดแบบประเมินหน่วยงานนี้"
                              >
                                เปิด <ExternalLink className="h-4 w-4" />
                              </a>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {!filtered.length && (
                        <tr>
                          <td colSpan={3} className="p-5 text-center text-slate-500">
                            ไม่พบหน่วยงานที่ตรงกับคำค้นหา
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
