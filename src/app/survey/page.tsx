"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

/** โครงรายการหน่วยงาน */
type DepartmentRow = {
  id: number;
  code: string;
  name: string;
  qr_code?: string | null;
};

export default function SurveyIndexPage() {
  // ---------- lock body scroll ----------
  useEffect(() => {
    const prev = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => { document.body.style.overflowY = prev; };
  }, []);

  // ---------- state ----------
  const [departments, setDepartments] = useState<DepartmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");
  const [q, setQ] = useState("");
  const [centralLink, setCentralLink] = useState<string>("/survey");
  const [centralQR, setCentralQR] = useState<string>("/api/qrcode/central.png");

  // ---------- load data ----------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
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

    // หลัง mount ค่อยอัปเดตลิงก์ absolute
    try {
      const abs = `${window.location.origin}/survey`;
      setCentralLink(abs);
    } catch {}

    return () => { active = false; };
  }, []);

  // ---------- filtered ----------
  const filtered = useMemo(() => {
    if (!q.trim()) return departments;
    const s = q.toLowerCase();
    return departments.filter(
      (d) => d.code.toLowerCase().includes(s) || d.name.toLowerCase().includes(s)
    );
  }, [departments, q]);

  // ---------- helpers ----------
  const download = (url: string, filename = "central-qr") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  };

  return (
    // ✅ ใช้คอนเทนเนอร์หลักตัวเดียวเป็น scroll container
    <div className="h-dvh overflow-y-auto overflow-x-hidden overscroll-contain bg-gradient-to-b from-sky-50 via-white to-slate-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b">
        <div className="mx-auto max-w-5xl px-4 py-4 flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800">
            แบบประเมินความพึงพอใจ (หน้าเลือกหน่วยงาน)
          </h1>
          <span className="text-xs text-slate-500">/survey</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6 space-y-8">
        {/* คิวอาร์ส่วนกลาง */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-sky-50 to-white">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">คิวอาร์โค้ดส่วนกลาง</div>
                <p className="text-[13px] text-slate-600 mt-1">
                  ใช้คิวอาร์นี้สำหรับงานกิจกรรม/ป้ายประชาสัมพันธ์ เมื่อแสกนจะมาที่หน้านี้เพื่อค้นหาและเลือกหน่วยงานก่อนทำแบบประเมิน
                </p>
              </div>
              <div className="hidden sm:block text-[12px] text-slate-500">
                แคชภาพ 1 ชั่วโมง • เส้นทาง: <code>/api/qrcode/central.png</code>
              </div>
            </div>
          </div>

          <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
            <div className="flex items-center justify-center">
              <img
                src={centralQR}
                alt="QR Code /survey"
                className="w-[220px] h-[220px] bg-white border rounded-xl p-3 shadow-sm object-contain"
              />
            </div>

            <div className="space-y-4">
              <div>
                <div className="text-slate-700 text-sm">ลิงก์ส่วนกลาง</div>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <a href={centralLink} target="_blank" className="text-blue-600 hover:underline break-all">
                    {centralLink}
                  </a>
                  <button
                    onClick={() => navigator.clipboard?.writeText(centralLink)}
                    className="rounded border px-2 py-1 text-xs hover:bg-white"
                  >
                    คัดลอก
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => download(centralQR, "survey-central")}
                  className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2"
                >
                  ดาวน์โหลดคิวอาร์ (PNG)
                </button>
                <a href={centralQR} target="_blank" className="rounded-lg border px-4 py-2 hover:bg-white">
                  เปิดรูปเต็ม
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* ค้นหาและเลือกหน่วยงาน */}
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-6 border-b bg-gradient-to-r from-slate-50 to-white">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="text-lg font-semibold text-slate-900">ค้นหาและเลือกหน่วยงาน</div>
                <p className="text-[13px] text-slate-600 mt-1">
                  พิมพ์ชื่อหรือรหัสหน่วยงาน แล้วคลิกเพื่อไปทำแบบประเมินของหน่วยงานนั้น
                </p>
              </div>
              <form onSubmit={(e) => e.preventDefault()} className="flex gap-2">
                <input
                  className="w-[240px] rounded-lg border focus:border-blue-500 focus:ring-blue-500 p-2"
                  placeholder="ค้นหา (รหัส/ชื่อ)"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm shadow-sm transition-colors"
                >
                  ค้นหา
                </button>
              </form>
            </div>
          </div>

          <div className="divide-y">
            {loading && <div className="p-6 text-slate-500">กำลังโหลดข้อมูล…</div>}
            {!loading && err && <div className="p-6 text-rose-700 bg-rose-50">❌ {err}</div>}
            {!loading && !err && filtered.length === 0 && (
              <div className="p-6 text-slate-500">ไม่พบหน่วยงาน</div>
            )}

            {!loading && !err && filtered.map((d) => (
              <div key={d.id} className="p-4 sm:p-5 hover:bg-slate-50/50 transition-colors">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-semibold text-slate-900 truncate">{d.name}</div>
                    <div className="text-sm text-slate-500">รหัส: {d.code}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={`/survey/${encodeURIComponent(d.code)}`}
                      className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 text-sm"
                      target="_blank"
                    >
                      เริ่มทำแบบประเมิน
                    </a>
                    <a
                      href={`/survey/${encodeURIComponent(d.code)}`}
                      className="rounded-lg border px-3 py-2 text-sm hover:bg-white"
                    >
                      เปิดลิงก์
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
