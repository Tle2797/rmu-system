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
    // ค่าพึ่ง window ให้ทำบน client เท่านั้น → ปลอดภัยต่อ hydration
    const origin = window.location.origin;
    setCentralLink(`${origin}/survey`);
    // เติม query กัน cache เฉพาะ client; SSR จะยังไม่ render src นี้
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

  // ดาวน์โหลดรูปใด ๆ (รวม central)
  const onDownload = (url: string, filename = "qr") => {
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.png`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 space-y-8">
      {/* Header */}
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">QR Code</h1>
          <p className="text-sm text-slate-600">
            ดาวน์โหลด QR ส่วนกลาง และ QR รายหน่วยงานเพื่อใช้งานหน้างาน
          </p>
        </div>
        <div className="hidden sm:block">
          {/* กัน layout shift; ไม่โชว์ central link จนกว่าจะ mount */}
          {mounted && (
            <a
              href={centralLink}
              target="_blank"
              className="text-blue-600 hover:underline text-sm"
            >
              {centralLink}
            </a>
          )}
        </div>
      </header>

      {/* Central QR */}
      <section className="rounded-2xl border bg-white shadow-sm p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6">
          <div className="flex items-center justify-center">
            <div className="w-[220px] h-[220px] rounded-xl border bg-white p-3 grid place-items-center">
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
          <div className="space-y-3">
            <div className="text-sm text-slate-700">
              <div className="font-medium">ลิงก์ส่วนกลาง</div>
              <div className="mt-1">
                {mounted ? (
                  <a
                    href={centralLink}
                    target="_blank"
                    className="text-blue-600 hover:underline break-all"
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
                    onClick={() => onDownload(centralImg, "QR_CENTRAL")}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
                  >
                    ดาวน์โหลด (PNG)
                  </button>
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(centralLink);
                    }}
                    className="rounded-lg border px-4 py-2 text-sm hover:bg-slate-50"
                  >
                    คัดลอกลิงก์ /survey
                  </button>
                </>
              )}
            </div>

            <p className="text-xs text-slate-500">
              สแกนแล้วผู้ใช้จะเข้าหน้าเลือกหน่วยงานก่อน แล้วจึงไปยังแบบประเมินของแต่ละหน่วยงาน
            </p>
          </div>
        </div>
      </section>

      {/* Department list */}
      <section className="rounded-2xl border bg-white shadow-sm">
        <div className="p-4 sm:p-5 border-b bg-slate-50 rounded-t-2xl flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <div className="font-semibold">QR รายหน่วยงาน</div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
            }}
            className="flex gap-2"
          >
            <input
              className="w-[240px] rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="ค้นหา (รหัส/ชื่อ)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
            >
              ค้นหา
            </button>
          </form>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="text-left p-3 w-[120px]">รหัส</th>
                <th className="text-left p-3">ชื่อ</th>
                <th className="text-left p-3">ลิงก์แบบประเมิน</th>
                <th className="text-right p-3 w-[240px]">QR</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const link = `/survey/${encodeURIComponent(r.code)}`;
                return (
                  <tr key={r.id} className="border-b last:border-0 align-middle">
                    <td className="p-3 font-medium">{r.code}</td>
                    <td className="p-3">{r.name}</td>
                    <td className="p-3">
                      <a href={link} target="_blank" className="text-blue-600 hover:underline">
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
                              className="w-12 h-12 object-contain border rounded"
                            />
                            <button
                              onClick={() => onDownload(r.qr_code!, `QR_${r.code}`)}
                              className="rounded-lg border px-3 py-1.5 hover:bg-slate-50"
                            >
                              ดาวน์โหลด
                            </button>
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
                  <td colSpan={4} className="p-4 text-slate-500">
                    ไม่พบข้อมูล
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
