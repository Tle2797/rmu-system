"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

type DeptRow = { id: number; code: string; name: string; qr_code?: string | null };

export default function QrHubPage() {
  // ===== central (ส่วนกลาง) =====
  const [mounted, setMounted] = useState(false);
  const [centralImg, setCentralImg] = useState<string>("");   // src ของรูป QR ส่วนกลาง
  const [centralLink, setCentralLink] = useState<string>(""); // ลิงก์ /survey แบบ absolute สำหรับคัดลอก

  // ===== departments =====
  const [rows, setRows] = useState<DeptRow[]>([]);
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r) => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [rows, search]);

  useEffect(() => {
    setMounted(true);
    // อาศัย window เฉพาะฝั่ง client
    const origin = window.location.origin;
    setCentralLink(`${origin}/survey`);
    // เติม query กัน cache เฉพาะ client
    setCentralImg(`/api/qrcode/central.png?t=${Date.now()}`);

    (async () => {
      try {
        const r = await axios.get<DeptRow[]>("/api/departments");
        setRows(Array.isArray(r.data) ? r.data : []);
      } catch {
        setRows([]);
      }
    })();
  }, []);

  // บันทึกภาพ (PNG) สำหรับรูปใดๆ
  const onSaveImage = (url: string, filename = "qr") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-50">
      <div className="mx-auto max-w-6xl px-4 py-8 space-y-8">
        {/* Header */}
        <header className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">ศูนย์รวม QR Code</h1>
            <p className="text-sm text-slate-600">
              จัดการและบันทึกภาพ QR ส่วนกลาง / รายหน่วยงาน เพื่อใช้งานหน้างาน
            </p>
          </div>
          <div className="hidden sm:block">
            {/* กัน layout shift; ไม่โชว์ central link จนกว่าจะ mount */}
            {mounted && (
              <a
                href={centralLink}
                target="_blank"
                className="text-sky-700 hover:text-sky-800 hover:underline text-sm break-all"
              >
                {centralLink}
              </a>
            )}
          </div>
        </header>

        {/* Central QR */}
        <section className="rounded-2xl border border-sky-100 bg-white shadow-sm p-5">
          <div className="mb-3">
            <div className="font-semibold text-slate-900">QR ส่วนกลาง</div>
            <p className="text-xs text-slate-500 mt-1">
              ผู้ใช้สแกนเพื่อเลือกหน่วยงาน จากนั้นเข้าสู่แบบประเมินของหน่วยงานนั้น
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
            <div className="flex items-center justify-center">
              <div className="w-[220px] h-[220px] rounded-xl border border-sky-100 bg-white p-3 grid place-items-center shadow-sm">
                {/* ปลอดภัย: render รูปหลัง mount เท่านั้น */}
                {mounted ? (
                  <img
                    src={centralImg}
                    alt="Central QR /survey"
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full bg-slate-100 animate-pulse rounded" />
                )}
              </div>
            </div>
            <div className="space-y-4">
              <div className="text-sm text-slate-700">
                <div className="font-medium">ลิงก์ส่วนกลาง</div>
                <div className="mt-1">
                  {mounted ? (
                    <a
                      href={centralLink}
                      target="_blank"
                      className="text-sky-700 hover:text-sky-800 hover:underline break-all"
                    >
                      {centralLink}
                    </a>
                  ) : (
                    <span className="inline-block h-4 w-40 bg-slate-200 rounded animate-pulse" />
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {mounted && (
                  <>
                    <button
                      onClick={() => onSaveImage(centralImg, "QR_CENTRAL")}
                      className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm transition"
                    >
                      บันทึก PNG
                    </button>
                    <button
                      onClick={async () => {
                        await navigator.clipboard.writeText(centralLink);
                      }}
                      className="rounded-lg border border-sky-200 text-slate-700 hover:bg-sky-50 px-4 py-2 text-sm transition"
                    >
                      คัดลอกลิงก์ /survey
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Department list */}
        <section className="rounded-2xl border border-sky-100 bg-white shadow-sm overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-sky-200 bg-gradient-to-r from-sky-50 to-sky-100 rounded-t-2xl flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
            <div className="font-semibold text-slate-900">QR รายหน่วยงาน</div>
            <form
              onSubmit={(e) => e.preventDefault()}
              className="flex gap-2"
            >
              <input
                className="w-[240px] rounded-lg border border-sky-200 p-2 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
                placeholder="ค้นหา (รหัส/ชื่อ)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-lg bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm transition"
              >
                ค้นหา
              </button>
            </form>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-sky-50 to-sky-100 border-b border-sky-200">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-800 w-[120px]">รหัส</th>
                  <th className="text-left p-3 font-semibold text-slate-800">ชื่อ</th>
                  <th className="text-left p-3 font-semibold text-slate-800">ลิงก์แบบประเมิน</th>
                  <th className="text-right p-3 font-semibold text-slate-800 w-[280px]"></th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-sky-50/30">
                {filtered.map((r) => {
                  const link = `/survey/${encodeURIComponent(r.code)}`;
                  return (
                    <tr key={r.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                      <td className="p-3 font-medium text-slate-900">{r.code}</td>
                      <td className="p-3 text-slate-700">{r.name}</td>
                      <td className="p-3">
                        <a href={link} target="_blank" className="text-sky-700 hover:text-sky-800 hover:underline">
                          {link}
                        </a>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-2">
                          {/* ถ้ามี path รูป QR ใน DB ก็โชว์ได้เลย */}
                          {r.qr_code ? (
                            <>
                              <img
                                src={r.qr_code}
                                alt={`QR ${r.code}`}
                                className="w-12 h-12 object-contain border border-sky-100 rounded"
                              />
                              <button
                                onClick={() => onSaveImage(r.qr_code!, `QR_${r.code}`)}
                                className="rounded-lg border border-sky-200 text-slate-700 hover:bg-sky-50 px-3 py-1.5 transition"
                              >
                                บันทึก PNG
                              </button>
                              <a
                                href={r.qr_code}
                                target="_blank"
                                className="rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-sky-50 px-3 py-1.5 transition"
                                rel="noreferrer"
                              >
                                เปิดภาพ
                              </a>
                            </>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {!filtered.length && (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      ไม่พบข้อมูล
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}
