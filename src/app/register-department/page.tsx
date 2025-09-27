"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";

/** ตัวช่วยแบบง่าย: ตัดช่องว่างและบังคับ upper-case เฉพาะ A-Z0-9-_/ */
const normalizeCode = (s: string) =>
  s
    .toUpperCase()
    .replace(/\s+/g, "")
    .replace(/[^A-Z0-9\-_]/g, "");

/** โครงรายการหน่วยงาน */
type DepartmentRow = {
  id: number;
  code: string;
  name: string;
  qr_code: string; // public path เช่น /qrcode/IT001.png
};

type CreatedResult = {
  message: string;
  department: DepartmentRow;
  survey_url: string;
  qr_url: string;
};

export default function RegisterDepartmentPage() {
  // ---- ฟอร์ม ----
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  // ---- สถานะ ----
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [result, setResult] = useState<CreatedResult | null>(null);

  // กล่องสรุปหลังสร้าง (แทนของเดิม)
  const [showResultBox, setShowResultBox] = useState(false);

  // ---- รายการหน่วยงาน (ล่าสุด) ----
  const [rows, setRows] = useState<DepartmentRow[]>([]);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // ✅ Pagination: ปรับเป็นหน้า ละ 3 หน่วยงาน
  const PAGE_SIZE = 5;
  const [page, setPage] = useState(1);

  // ✅ Modal Preview สำหรับดูรูป (QR) แบบใหญ่
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string>("");
  const [previewAlt, setPreviewAlt] = useState<string>("");
  const [previewFileName, setPreviewFileName] = useState<string>("qr");

  const openPreview = (src: string, alt: string, fileName?: string) => {
    setPreviewSrc(src);
    setPreviewAlt(alt);
    setPreviewFileName(fileName || "qr");
    setPreviewOpen(true);
  };
  const closePreview = () => setPreviewOpen(false);

  // Lock scroll เมื่อเปิด modal + ปิดด้วย ESC
  useEffect(() => {
    if (previewOpen) {
      const original = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") closePreview();
      };
      window.addEventListener("keydown", onKey);
      return () => {
        document.body.style.overflow = original;
        window.removeEventListener("keydown", onKey);
      };
    }
  }, [previewOpen]);

  // ค่าที่ normalize/trim เพื่อใช้ตรวจซ้ำแบบ real-time
  const codeNormalized = useMemo(() => normalizeCode(code), [code]);
  const nameTrimmed = useMemo(() => name.trim(), [name]);

  // ✅ เช็คซ้ำแบบ real-time (ชื่อ/รหัส)
  const codeDup = useMemo(
    () =>
      !!codeNormalized &&
      rows.some((r) => r.code.toUpperCase() === codeNormalized),
    [rows, codeNormalized]
  );

  const nameDup = useMemo(
    () =>
      !!nameTrimmed &&
      rows.some(
        (r) => r.name.trim().toLowerCase() === nameTrimmed.toLowerCase()
      ),
    [rows, nameTrimmed]
  );

  const filtered = useMemo(() => {
    if (!search) return rows;
    const q = search.toLowerCase();
    return rows.filter(
      (r) =>
        r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
    );
  }, [rows, search]);

  // slice ตามหน้า
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageSafe = Math.min(page, totalPages);
  const start = (pageSafe - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const pageRows = filtered.slice(start, end);

  // โหลด list หน่วยงาน (ล่าสุดก่อน)
  const loadRows = async () => {
    try {
      setRefreshing(true);
      const res = await axios.get<DepartmentRow[]>("/api/admin/departments");
      setRows(res.data || []);
      // รีเซ็ตหน้าเมื่อโหลดใหม่
      setPage(1);
    } catch {
      // เงียบไว้ก็ได้
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadRows();
  }, []);

  // สร้างหน่วยงาน + QR
  const onSubmit = async () => {
    setErr("");
    setOkMsg("");
    setResult(null);
    setShowResultBox(false);

    const codeOK = normalizeCode(code);
    const nameOK = name.trim();

    // ✅ Validation ฝั่ง client
    if (!codeOK || codeOK.length < 3) {
      setErr("กรุณากรอกรหัสหน่วยงานอย่างน้อย 3 ตัวอักษร (A-Z/0-9/-/_)");
      return;
    }
    if (!nameOK || nameOK.length < 4) {
      setErr("กรุณากรอกชื่อหน่วยงานอย่างน้อย 4 ตัวอักษร");
      return;
    }
    // ✅ ห้ามซ้ำ (ชื่อ/รหัส)
    if (
      rows.some((r) => r.name.trim().toLowerCase() === nameOK.toLowerCase())
    ) {
      setErr("ชื่อหน่วยงานนี้ถูกใช้แล้ว กรุณาเลือกชื่ออื่น");
      return;
    }
    if (rows.some((r) => r.code.toUpperCase() === codeOK)) {
      setErr("รหัสหน่วยงานนี้ถูกใช้แล้ว กรุณาเลือกรหัสอื่น");
      return;
    }

    setLoading(true);
    try {
      const res = await axios.post<CreatedResult>("/api/admin/departments", {
        code: codeOK,
        name: nameOK,
      });
      setResult(res.data);
      setOkMsg("สร้างหน่วยงาน และ QR สำเร็จ");
      setCode("");
      setName("");
      await loadRows();
      // ✅ โชว์ “กล่องข้อมูลสรุป” แทนของเดิม
      setShowResultBox(true);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "สมัครหน่วยงานไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  // ดาวน์โหลดไฟล์ QR
  const onDownload = (qrUrl?: string, fileName?: string) => {
    if (!qrUrl) return;
    const a = document.createElement("a");
    a.href = qrUrl;
    a.download = `${fileName || "qr"}.png`;
    a.click();
  };

  // คัดลอกข้อความ
  const copy = async (txt: string, label = "คัดลอกแล้ว") => {
    try {
      await navigator.clipboard.writeText(txt);
      setOkMsg(label);
      setTimeout(() => setOkMsg(""), 1400);
    } catch {}
  };

  // Regenerate QR
  const regen = async (depCode: string) => {
    try {
      setRefreshing(true);
      await axios.post(`/api/admin/departments/${depCode}/regen-qr`);
      await loadRows();
      setOkMsg(`อัปเดต QR ของ ${depCode} แล้ว`);
      setTimeout(() => setOkMsg(""), 1200);
    } catch (e: any) {
      setErr(e?.response?.data?.error || "อัปเดต QR ไม่สำเร็จ");
    } finally {
      setRefreshing(false);
    }
  };

  const disableSubmit =
    loading ||
    !codeNormalized ||
    !nameTrimmed ||
    codeNormalized.length < 3 ||
    nameTrimmed.length < 4 ||
    codeDup ||
    nameDup;

  return (
    <div className="mx-auto max-w-7xl p-4 sm:p-6 space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-extrabold tracking-tight">
          ลงทะเบียนหน่วยงาน & สร้าง QR
        </h1>
      </div>

      {/* ✅ กล่องข้อมูลสรุปหลังสร้าง */}
      {showResultBox && result && (
        <div className="rounded-2xl border bg-white shadow-lg ring-1 ring-emerald-100">
          <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-emerald-50 to-white rounded-t-2xl flex items-start justify-between">
            <div>
              <div className="font-semibold text-emerald-800">
                สร้างหน่วยงานสำเร็จ • {result.department.code}
              </div>
              <p className="text-xs text-slate-600 mt-1">
                ดาวน์โหลด QR หรือคัดลอกลิงก์เพื่อใช้งานได้ทันที
              </p>
            </div>
            <button
              onClick={() => setShowResultBox(false)}
              className="rounded-lg border px-3 py-1.5 text-sm hover:bg-white"
              title="ปิด"
            >
              ปิด
            </button>
          </div>

          <div className="p-5">
            <div className="grid grid-cols-1 md:grid-cols-[220px_1fr] gap-6 items-start">
              {/* ✅ คลิกภาพเพื่อเปิด modal */}
              <img
                src={result.qr_url}
                alt="QR"
                onClick={() =>
                  openPreview(
                    result.qr_url,
                    `QR ของ ${result.department.code}`,
                    result.department.code
                  )
                }
                className="w-[220px] h-[220px] bg-white border rounded-xl p-3 shadow-sm object-contain cursor-zoom-in"
              />
              <div className="space-y-3">
                <div className="text-sm">
                  <div>
                    รหัส:{" "}
                    <b className="font-semibold">{result.department.code}</b>
                  </div>
                  <div>ชื่อ: {result.department.name}</div>
                </div>

                <div className="rounded-xl border bg-slate-50 p-3 text-sm">
                  <div className="text-slate-700">ลิงก์แบบประเมิน</div>
                  <div className="mt-1 flex items-center gap-2">
                    <a
                      className="text-blue-600 hover:underline break-all"
                      href={result.survey_url}
                      target="_blank"
                    >
                      {result.survey_url}
                    </a>
                    <button
                      onClick={() => copy(result.survey_url)}
                      className="rounded border px-2 py-1 text-xs hover:bg-white"
                    >
                      คัดลอก
                    </button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() =>
                      onDownload(result.qr_url, result.department.code)
                    }
                    className="rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2"
                  >
                    ดาวน์โหลด QR (PNG)
                  </button>
                  <button
                    onClick={() =>
                      openPreview(
                        result.qr_url,
                        `QR ของ ${result.department.code}`,
                        result.department.code
                      )
                    }
                    className="rounded-lg border px-4 py-2 hover:bg-white"
                  >
                    ดูรูปแบบใหญ่
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 2 คอลัมน์: ฟอร์ม / ผลลัพธ์ล่าสุด */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ฟอร์ม (ซ้าย) */}
        <section className="xl:col-span-1">
          <div className="rounded-2xl border bg-white shadow-sm">
            {/* หัวการ์ด */}
            <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
              <div className="font-semibold">ฟอร์มลงทะเบียนหน่วยงาน</div>
              <p className="text-xs text-slate-500 mt-1">
                ระบุรหัสและชื่อหน่วยงาน ระบบจะสร้าง QR พร้อมลิงก์ให้อัตโนมัติ
              </p>
            </div>

            {/* เนื้อหา */}
            <div className="p-4 sm:p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รหัสหน่วยงาน (เช่น <code>IT001</code>)
                </label>
                <input
                  className={`w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 ${
                    codeDup
                      ? "border-red-300 ring-red-200"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  }`}
                  value={code}
                  onChange={(e) => setCode(normalizeCode(e.target.value))}
                />
                <div className="mt-1 flex items-center justify-between">
                  <p className="text-[12px] text-slate-500">
                    อนุญาตเฉพาะ A–Z, 0–9, <code>-</code>, <code>_</code>{" "}
                    ระบบจะทำเป็นตัวพิมพ์ใหญ่อัตโนมัติ
                  </p>
                  {codeDup && (
                    <p className="text-[12px] text-red-600 font-medium">
                      รหัสนี้ถูกใช้แล้ว
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ชื่อหน่วยงาน
                </label>
                <input
                  className={`w-full rounded-xl border p-2.5 focus:outline-none focus:ring-2 ${
                    nameDup
                      ? "border-red-300 ring-red-200"
                      : "border-slate-300 focus:border-blue-500 focus:ring-blue-500"
                  }`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
                {nameDup && (
                  <p className="mt-1 text-[12px] text-red-600 font-medium">
                    ชื่อหน่วยงานนี้ถูกใช้แล้ว
                  </p>
                )}
              </div>

              {err && (
                <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">
                  {err}
                </div>
              )}
              {okMsg && !err && (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-700 p-3 text-sm">
                  {okMsg}
                </div>
              )}

              <button
                onClick={onSubmit}
                disabled={disableSubmit}
                className={`w-full inline-flex items-center justify-center rounded-xl px-4 py-2.5 text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                  disableSubmit
                    ? "bg-slate-400 cursor-not-allowed"
                    : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500"
                }`}
              >
                {loading ? "กำลังสร้าง…" : "สร้างหน่วยงาน + QR"}
              </button>
            </div>
          </div>
        </section>

        {/* รายการหน่วยงาน (ขวา: 2 คอลัมน์รวม) */}
        <section className="xl:col-span-2">
          <div className="rounded-2xl border bg-white shadow-sm">
            <div className="p-4 sm:p-5 border-b bg-gradient-to-r from-slate-50 to-white flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between rounded-t-2xl">
              <div>
                <div className="font-semibold">หน่วยงานล่าสุด</div>
              </div>

              <div className="flex gap-2">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    setPage(1); // กดค้นหาจะ reset ไปหน้าแรก
                  }}
                  className="flex gap-2"
                >
                  <input
                    className="w-[220px] rounded-lg border focus:border-blue-500 focus:ring-blue-500 p-2"
                    placeholder="ค้นหา (รหัส/ชื่อ)"
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                  />
                  <button
                    type="submit"
                    disabled={!search.trim()}
                    className="rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm shadow-sm transition disabled:opacity-50"
                  >
                    ค้นหา
                  </button>
                </form>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b">
                  <tr>
                    <th className="text-left p-3 w-[120px]">รหัส</th>
                    <th className="text-left p-3">ชื่อหน่วยงาน</th>
                    <th className="text-left p-3 w-[220px]">ลิงก์แบบประเมิน</th>
                    <th className="text-right p-3 w-[320px]"></th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 align-middle"
                    >
                      <td className="p-3 font-medium">{r.code}</td>
                      <td className="p-3">{r.name}</td>
                      <td className="p-3">
                        <a
                          className="text-blue-600 hover:underline"
                          href={`/survey/${encodeURIComponent(r.code)}`}
                          target="_blank"
                        >
                          /survey/{r.code}
                        </a>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => onDownload(r.qr_code, r.code)}
                            className="rounded-lg border px-3 py-1.5 hover:bg-white"
                          >
                            ดาวน์โหลด QR
                          </button>
                          {/* ✅ แทนที่ "เปิดรูป" ด้วยปุ่มเปิด modal */}
                          <button
                            onClick={() =>
                              openPreview(r.qr_code, `QR ของ ${r.code}`, r.code)
                            }
                            className="rounded-lg border px-3 py-1.5 hover:bg-white"
                          >
                            ดูรูป
                          </button>
                          <button
                            onClick={() => regen(r.code)}
                            disabled={refreshing}
                            className="rounded-lg bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 disabled:opacity-60"
                            title="Regenerate QR (กรณีเปลี่ยนโดเมน APP_BASE_URL)"
                          >
                            {refreshing ? "..." : "Regenerate QR"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!pageRows.length && (
                    <tr>
                      <td className="p-4 text-slate-500" colSpan={4}>
                        ไม่พบข้อมูล
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* ✅ Pagination controls */}
            <div className="p-4 border-t flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
              <div className="text-[12px] text-slate-600">
                ทั้งหมด {filtered.length} รายการ • หน้า {pageSafe}/{totalPages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={pageSafe <= 1}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    pageSafe <= 1
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-slate-50"
                  }`}
                >
                  ก่อนหน้า
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={pageSafe >= totalPages}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    pageSafe >= totalPages
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-slate-50"
                  }`}
                >
                  ถัดไป
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* ✅ Modal Preview (ภาพ QR) */}
      {previewOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-[2px]"
            onClick={closePreview}
          />
          {/* modal */}
          <div className="relative z-[101]  max-w-3xl rounded-2xl border bg-white shadow-2xl ring-1 ring-black/10 overflow-hidden">
            <div className="p-4 sm:p-6 grid place-items-center bg-white">
              <img
                src={previewSrc}
                alt={previewAlt || "QR Code"}
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
