"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Plus, Search, Pencil, Download, RefreshCcw, Trash2,
  QrCode, ExternalLink, Copy, Building2, Image as ImageIcon, Link as LinkIcon
} from "lucide-react";

type Row = { id: number; code: string; name: string; qr_code: string };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>;
}

function Modal({
  open, title, onClose, children,
}: { open: boolean; title: string; onClose: () => void; children: React.ReactNode; }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border ring-1 ring-black/5">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <button onClick={onClose} className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 text-slate-600" aria-label="ปิดหน้าต่าง">✕</button>
          </div>
          <div className="p-5">{children}</div>
        </div>
      </div>
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: "ok" | "err" }) {
  return (
    <div
      className={`fixed bottom-4 right-4 z-50 rounded-xl px-4 py-2.5 text-sm shadow-lg ring-1 ${
        type === "ok" ? "bg-emerald-600 text-white ring-emerald-500/40" : "bg-rose-600 text-white ring-rose-500/40"
      }`}
      role="status"
    >
      {msg}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-3"><div className="h-4 w-24 bg-slate-200 rounded" /></td>
      <td className="p-3"><div className="h-4 w-48 bg-slate-200 rounded" /></td>
      <td className="p-3"><div className="h-4 w-52 bg-slate-200 rounded" /></td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-20 bg-slate-200 rounded-lg" />
          <div className="h-8 w-28 bg-slate-200 rounded-lg" />
          <div className="h-8 w-20 bg-slate-200 rounded-lg" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          <div className="h-8 w-16 bg-slate-200 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

export default function AdminDepartmentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.code.toLowerCase().includes(q) || r.name.toLowerCase().includes(q));
  }, [rows, query]);

  // toast & modals
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const ok = (m: string) => { setToast({ msg: m, type: "ok" }); setTimeout(() => setToast(null), 1500); };
  const err = (m: string) => { setToast({ msg: m, type: "err" }); setTimeout(() => setToast(null), 2000); };

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<null | Row>(null);
  const [previewQR, setPreviewQR] = useState<null | Row>(null);

  // form
  const [cCode, setCCode] = useState("");
  const [cName, setCName] = useState("");
  const [eName, setEName] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Row[]>("/api/admin/departments");
      setRows(res.data || []);
    } catch {
      err("ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const normalizeCode = (s: string) => s.toUpperCase().replace(/\s+/g, "").replace(/[^A-Z0-9\-_]/g, "");

  const onCreate = async () => {
    const code = normalizeCode(cCode);
    if (!code || !cName.trim()) return err("กรุณากรอกรหัสและชื่อหน่วยงานให้ครบ");
    try {
      await axios.post("/api/admin/departments", { code, name: cName.trim() });
      setCreateOpen(false);
      setCCode(""); setCName("");
      ok("เพิ่มหน่วยงานสำเร็จ");
      load();
    } catch (e: any) {
      err(e?.response?.data?.error || "เพิ่มหน่วยงานไม่สำเร็จ");
    }
  };

  const onOpenEdit = (r: Row) => { setEName(r.name); setEditOpen(r); };
  const onEdit = async () => {
    if (!editOpen) return;
    try {
      await axios.put(`/api/admin/departments/${editOpen.code}`, { name: eName.trim() });
      setEditOpen(null);
      ok("บันทึกการแก้ไขเรียบร้อย");
      load();
    } catch (e: any) {
      err(e?.response?.data?.error || "บันทึกการแก้ไขไม่สำเร็จ");
    }
  };

  const onDelete = async (r: Row) => {
    if (!confirm(`ยืนยันการลบหน่วยงาน ${r.code} หรือไม่?`)) return;
    try {
      await axios.delete(`/api/admin/departments/${r.code}`);
      ok("ลบหน่วยงานสำเร็จ");
      load();
    } catch (e: any) {
      err(e?.response?.data?.error || "ลบหน่วยงานไม่สำเร็จ");
    }
  };

  const onRegen = async (r: Row) => {
    try {
      await axios.post(`/api/admin/departments/${r.code}/regen-qr`);
      ok("สร้าง QR ใหม่สำเร็จ");
      load();
    } catch (e: any) {
      err(e?.response?.data?.error || "สร้าง QR ใหม่ไม่สำเร็จ");
    }
  };

  const onDownload = (r: Row) => {
    const a = document.createElement("a");
    a.href = r.qr_code;
    a.download = `${r.code}.png`;
    a.click();
  };

  const copySurveyUrl = async (r: Row) => {
    try {
      const url = `${window.location.origin}/survey/${r.code}`;
      await navigator.clipboard.writeText(url);
      ok("คัดลอกลิงก์แบบสอบถามแล้ว");
    } catch {
      err("คัดลอกลิงก์ไม่สำเร็จ");
    }
  };

  const hasQR = (r: Row) => !!r.qr_code && r.qr_code.trim().length > 0;

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">จัดการหน่วยงาน</h1>
          <p className="text-slate-600 text-sm mt-0.5">เพิ่ม แก้ไข ลบ สร้าง QR ใหม่ และจัดการลิงก์แบบสอบถาม</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm ring-2 ring-transparent focus:outline-none focus:ring-sky-200"
              placeholder="ค้นหา: รหัส / ชื่อหน่วยงาน"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="ค้นหาหน่วยงาน"
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm shadow-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่มหน่วยงาน
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 text-sky-700 p-2 ring-1 ring-sky-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">จำนวนหน่วยงานทั้งหมด</div>
              <div className="text-lg font-semibold">{rows.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 text-emerald-700 p-2 ring-1 ring-emerald-200">
              <QrCode className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">หน่วยงานที่มี QR พร้อมใช้งาน</div>
              <div className="text-lg font-semibold">{rows.filter(hasQR).length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 text-amber-700 p-2 ring-1 ring-amber-200">
              <LinkIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">ลิงก์แบบสอบถาม (/survey/&lt;code&gt;)</div>
              <div className="text-lg font-semibold">พร้อมใช้งาน</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="p-3 text-left w-[140px]">รหัส</th>
                <th className="p-3 text-left">ชื่อหน่วยงาน</th>
                <th className="p-3 text-left">แบบสอบถาม</th>
                <th className="p-3 text-right w-[480px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <>
                  <SkeletonRow />
                  <SkeletonRow />
                  <SkeletonRow />
                </>
              )}

              {!loading && filtered.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="p-3 font-medium">{r.code}</td>
                  <td className="p-3">{r.name}</td>
                  <td className="p-3">
                    <a className="inline-flex items-center gap-1 text-sky-700 hover:underline" href={`/survey/${r.code}`} target="_blank" rel="noreferrer">
                      /survey/{r.code}
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </td>
                  <td className="p-3">
                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={() => onOpenEdit(r)}
                        title="แก้ไขชื่อหน่วยงาน"
                        aria-label={`แก้ไข ${r.code}`}
                      >
                        <Pencil className="h-4 w-4" />
                        แก้ไข
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={() => setPreviewQR(r)}
                        title="แสดงตัวอย่าง QR"
                        aria-label={`แสดง QR ${r.code}`}
                      >
                        <ImageIcon className="h-4 w-4" />
                        ดูรูป
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={() => onDownload(r)}
                        title="ดาวน์โหลดไฟล์ QR"
                        aria-label={`ดาวน์โหลด QR ${r.code}`}
                      >
                        <Download className="h-4 w-4" />
                        ดาวน์โหลด QR
                      </button>

                      <a
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        href={r.qr_code}
                        target="_blank"
                        rel="noreferrer"
                        title="เปิดรูป QR ในแท็บใหม่"
                        aria-label={`เปิดรูป QR ${r.code}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                        เปิดรูป
                      </a>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={() => copySurveyUrl(r)}
                        title="คัดลอกลิงก์แบบสอบถาม"
                        aria-label={`คัดลอกลิงก์ /survey/${r.code}`}
                      >
                        <Copy className="h-4 w-4" />
                        คัดลอกลิงก์
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                        onClick={() => onRegen(r)}
                        title="สร้าง QR ใหม่"
                        aria-label={`Regenerate QR ${r.code}`}
                      >
                        <RefreshCcw className="h-4 w-4" />
                        Regenerate
                      </button>

                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => onDelete(r)}
                        title="ลบหน่วยงาน"
                        aria-label={`ลบ ${r.code}`}
                      >
                        <Trash2 className="h-4 w-4" />
                        ลบ
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {!loading && !filtered.length && (
                <tr>
                  <td className="p-8" colSpan={4}>
                    <div className="flex flex-col items-center justify-center text-center gap-2 text-slate-600">
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <Building2 className="h-6 w-6 text-slate-400" />
                      </div>
                      <div className="font-medium">ไม่พบรายการหน่วยงาน</div>
                      <p className="text-sm text-slate-500">ลองปรับคำค้นหา หรือเพิ่มหน่วยงานใหม่ด้วยปุ่ม “เพิ่มหน่วยงาน”</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} title="เพิ่มหน่วยงาน" onClose={() => setCreateOpen(false)}>
        <div className="space-y-4">
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">รหัสหน่วยงาน (A–Z, 0–9, -/_)</span>
            <input
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="เช่น IT001"
              value={cCode}
              onChange={(e) => setCCode(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 mt-2 text-slate-700">ชื่อหน่วยงาน</span>
            <input
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="เช่น สำนักวิทยบริการและเทคโนโลยีสารสนเทศ"
              value={cName}
              onChange={(e) => setCName(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={() => setCreateOpen(false)}>ยกเลิก</button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              บันทึกหน่วยงาน
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editOpen} title={`แก้ไขหน่วยงาน: ${editOpen?.code || ""}`} onClose={() => setEditOpen(null)}>
        <div className="space-y-4">
          <div className="text-sm text-slate-500">รหัส: <b>{editOpen?.code}</b></div>
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">ชื่อหน่วยงาน</span>
            <input
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="ระบุชื่อหน่วยงาน"
              value={eName}
              onChange={(e) => setEName(e.target.value)}
            />
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={() => setEditOpen(null)}>ยกเลิก</button>
            <button className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={onEdit}>บันทึกการแก้ไข</button>
          </div>
        </div>
      </Modal>

      {/* QR Preview Modal */}
      <Modal open={!!previewQR} title={`QR Code: ${previewQR?.code || ""}`} onClose={() => setPreviewQR(null)}>
        {previewQR && (
          <div className="space-y-4">
            <div className="flex items-center justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewQR.qr_code} alt={`QR ${previewQR.code}`} className="max-h-64 rounded-xl ring-1 ring-slate-200" />
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50" onClick={() => onDownload(previewQR)}>
                <Download className="h-4 w-4" />
                ดาวน์โหลด
              </button>
              <a className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50" href={previewQR.qr_code} target="_blank" rel="noreferrer">
                <ExternalLink className="h-4 w-4" />
                เปิดรูป
              </a>
              <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600" onClick={() => onRegen(previewQR)}>
                <RefreshCcw className="h-4 w-4" />
                Regenerate
              </button>
            </div>
          </div>
        )}
      </Modal>

      {toast && <Toast {...toast} />}
    </div>
  );
}
