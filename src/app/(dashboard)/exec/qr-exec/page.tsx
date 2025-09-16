"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

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

  // ---------- คิวอาร์ "ส่วนกลาง" ----------
  const CENTRAL_RELATIVE = "/survey";
  const [centralAbs, setCentralAbs] = useState<string | null>(null);
  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (origin) setCentralAbs(origin.replace(/\/$/, "") + CENTRAL_RELATIVE);
  }, []);

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
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(s) || r.name.toLowerCase().includes(s)
    );
  }, [rows, q]);

  return (
    <div className="min-h-[100svh] overflow-x-hidden relative">
      {/* พื้นหลังเบา ๆ */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-sky-50 via-white to-slate-50" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-sky-200/30 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-indigo-200/30 blur-3xl" />
      </div>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-6">
        {/* บัตรคิวอาร์ "ส่วนกลาง" */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-blue-50 to-white">
            <div className="font-semibold">คิวอาร์ส่วนกลาง</div>
            <p className="text-xs text-slate-600 mt-1">
              ใช้สำหรับติดหน้าบอร์ดรวม — ผู้ใช้สแกนแล้วจะเห็นรายชื่อหน่วยงานให้เลือกก่อน
            </p>
          </div>

          <div className="p-4 sm:p-5 grid gap-5 sm:grid-cols-[220px_1fr] items-start">
            <img
              src="/api/qrcode/central.png"
              alt="QR Central"
              className="w-[220px] h-[220px] bg-white border rounded-xl p-3 shadow-sm object-contain"
            />

            <div className="space-y-3">
              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-slate-700 text-sm">ลิงก์ส่วนกลาง</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <a
                    href={CENTRAL_RELATIVE}
                    target="_blank"
                    className="text-blue-600 hover:underline break-all"
                  >
                    {CENTRAL_RELATIVE}
                  </a>

                  {centralAbs && (
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(centralAbs);
                        } catch {}
                      }}
                      className="rounded border px-2 py-1 text-xs hover:bg-white"
                    >
                      คัดลอกลิงก์เต็ม
                    </button>
                  )}
                </div>

                {centralAbs && (
                  <div className="mt-1 text-[12px] text-slate-500 break-all">
                    ลิงก์เต็ม: <span>{centralAbs}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                <a
                  href="/api/qrcode/central.png"
                  download="central-qr.png"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
                >
                  ดาวน์โหลด QR (PNG)
                </a>
                <a
                  href={CENTRAL_RELATIVE}
                  target="_blank"
                  className="rounded-lg border px-4 py-2 hover:bg-white"
                >
                  เปิดหน้าเลือกหน่วยงาน
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ค้นหา/เลือกหน่วยงาน */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-slate-50 to-white">
            <div className="font-semibold">ค้นหาและเลือกหน่วยงาน</div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                }}
              >
                <input
                  className="w-[260px] rounded-lg border p-2 focus:border-blue-500 focus:ring-blue-500"
                  placeholder="ค้นหา (รหัส/ชื่อหน่วยงาน)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm shadow-sm transition"
                >
                  ค้นหา
                </button>
              </form>
            </div>

            {loading && (
              <div className="text-slate-500 text-sm">กำลังโหลดรายชื่อหน่วยงาน…</div>
            )}
            {!loading && error && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-3 text-sm">
                {error}
              </div>
            )}

            {!loading && !error && (
              <div className="overflow-x-auto max-w-full">
                <table className="w-full text-sm table-fixed">
                  <thead className="bg-slate-50 border-b">
                    <tr>
                      <th className="text-left p-3 w-[120px]">รหัส</th>
                      <th className="text-left p-3">ชื่อหน่วยงาน</th>
                      <th className="text-left p-3 w-[240px]">ลิงก์แบบประเมิน</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => (
                      <tr key={r.code} className="border-b last:border-0">
                        <td className="p-3 font-medium">{r.code}</td>
                        <td className="p-3">{r.name}</td>
                        <td className="p-3">
                          <a
                            className="text-blue-600 hover:underline break-all"
                            href={`/survey/${encodeURIComponent(r.code)}`}
                            target="_blank"
                          >
                            /survey/{r.code}
                          </a>
                        </td>
                      </tr>
                    ))}

                    {!filtered.length && (
                      <tr>
                        <td colSpan={3} className="p-4 text-slate-500">
                          ไม่พบหน่วยงานที่ตรงกับคำค้นหา
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}