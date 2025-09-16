"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  Plus, Search, Pencil, Trash2, Star, Type as TypeIcon, ListChecks, Download
} from "lucide-react";

type Q = { id: number; survey_id: number; text: string; type: "rating" | "text" };

/* ---------- UI helpers ---------- */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-white shadow-sm ${className}`}><>{children}</></div>;
}

function Modal({ open, title, onClose, children }:{
  open:boolean; title:string; onClose:()=>void; children:React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose}/>
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
    <div className={`fixed bottom-4 right-4 z-50 rounded-xl px-4 py-2.5 text-sm shadow-lg ring-1 ${
      type==="ok" ? "bg-emerald-600 text-white ring-emerald-500/40" : "bg-rose-600 text-white ring-rose-500/40"
    }`} role="status">
      {msg}
    </div>
  );
}

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-3"><div className="h-4 w-6 bg-slate-200 rounded" /></td>
      <td className="p-3"><div className="h-4 w-64 bg-slate-200 rounded" /></td>
      <td className="p-3"><div className="h-5 w-20 bg-slate-200 rounded-full" /></td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-16 bg-slate-200 rounded-lg" />
          <div className="h-8 w-12 bg-slate-200 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

const TypeBadge = ({ t }: { t: Q["type"] }) => {
  const styles = t === "rating"
    ? "bg-indigo-50 text-indigo-700 ring-indigo-200"
    : "bg-amber-50 text-amber-700 ring-amber-200";
  const label = t === "rating" ? "คะแนน (1–5 ดาว)" : "คำตอบแบบเขียน";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles}`} title={label}>
      {t === "rating" ? <Star className="h-3.5 w-3.5" /> : <TypeIcon className="h-3.5 w-3.5" />}
      {label}
    </span>
  );
};

/* ---------- Page ---------- */
export default function AdminQuestionsPage() {
  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [surveyId] = useState(1); // ✅ ฟอร์มกลาง

  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return rows;
    return rows.filter(r => r.text.toLowerCase().includes(q) || r.type.includes(q as Q["type"]));
  }, [rows, search]);

  // toast & modals
  const [toast, setToast] = useState<{msg:string; type:"ok"|"err"}|null>(null);
  const ok = (m:string)=>{ setToast({msg:m, type:"ok"}); setTimeout(()=>setToast(null),1400); };
  const err = (m:string)=>{ setToast({msg:m, type:"err"}); setTimeout(()=>setToast(null),2200); };

  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<null|Q>(null);

  // forms
  const [cText, setCText] = useState("");
  const [cType, setCType] = useState<Q["type"]>("rating");
  const [eText, setEText] = useState("");
  const [eType, setEType] = useState<Q["type"]>("rating");

  const load = async () => {
    setLoading(true);
    try {
      const res = await axios.get<Q[]>("/api/admin/questions", { params: { survey_id: surveyId } });
      setRows(res.data || []);
    } catch {
      err("ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };
  useEffect(()=>{ load(); /* eslint-disable-next-line */ },[]);

  const onCreate = async () => {
    if(!cText.trim()) return err("กรุณากรอกข้อความคำถาม");
    try {
      await axios.post("/api/admin/questions", { survey_id: surveyId, text: cText.trim(), type: cType });
      setCreateOpen(false);
      setCText(""); setCType("rating");
      ok("เพิ่มคำถามสำเร็จ");
      load();
    } catch (e:any) {
      err(e?.response?.data?.error || "เพิ่มคำถามไม่สำเร็จ");
    }
  };

  const onOpenEdit = (q: Q) => {
    setEText(q.text); setEType(q.type); setEditOpen(q);
  };
  const onEdit = async () => {
    if(!editOpen) return;
    if(!eText.trim()) return err("กรุณากรอกข้อความคำถาม");
    try {
      await axios.put(`/api/admin/questions/${editOpen.id}`, { text: eText.trim(), type: eType });
      setEditOpen(null);
      ok("บันทึกการแก้ไขเรียบร้อย");
      load();
    } catch (e:any) {
      err(e?.response?.data?.error || "บันทึกการแก้ไขไม่สำเร็จ");
    }
  };

  const onDelete = async (q: Q) => {
    // ✅ กล่องยืนยันแบบพิมพ์ DELETE
    const confirm = await Swal.fire({
      title: "ยืนยันการลบคำถาม",
      html: `
        <div style="text-align:left">
          <div><b>คำถาม:</b> ${q.text}</div>
          <div class="mt-2">การลบนี้จะลบ <b>คำตอบทั้งหมดของคำถามนี้</b> ไปด้วย</div>
          <div class="mt-2">พิมพ์ <code>DELETE</code> เพื่อยืนยัน</div>
        </div>
      `,
      input: "text",
      inputPlaceholder: "พิมพ์ DELETE",
      inputValidator: (val) => (val === "DELETE" ? undefined : "ต้องพิมพ์ DELETE ให้ตรงตามตัวพิมพ์"),
      icon: "warning",
      showCancelButton: true,
      cancelButtonText: "ยกเลิก",
      confirmButtonText: "ลบคำถาม",
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
      focusCancel: true,
    });
    if (!confirm.isConfirmed) return;

    // optimistic update
    const prev = rows;
    setRows((r) => r.filter((x) => x.id !== q.id));

    try {
      await axios.delete(`/api/admin/questions/${q.id}`);
      ok("ลบคำถามสำเร็จ");
    } catch (e:any) {
      setRows(prev);
      err(e?.response?.data?.error || "ไม่สามารถลบคำถามได้");
    }
  };

  // quick stats
  const total = rows.length;
  const totalRating = rows.filter(r => r.type === "rating").length;
  const totalText = rows.filter(r => r.type === "text").length;

  /* ---------- Export helpers ---------- */
  const fileDate = new Date().toISOString().slice(0,10); // YYYY-MM-DD

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const csvEscape = (v: unknown) => {
    const s = String(v ?? "");
    const needsQuote = /[",\r\n]/.test(s);
    const escaped = s.replace(/"/g, '""');
    return needsQuote ? `"${escaped}"` : escaped;
  };

  const exportCSV = () => {
    const headers = ["ลำดับ", "ID", "Survey ID", "ข้อความคำถาม", "ชนิดคำถาม"];
    const lines = [headers.join(",")];
    rows.forEach((r, i) => {
      lines.push([
        csvEscape(i+1),
        csvEscape(r.id),
        csvEscape(r.survey_id),
        csvEscape(r.text),
        csvEscape(r.type === "rating" ? "คะแนน (1–5 ดาว)" : "คำตอบแบบเขียน"),
      ].join(","));
    });
    const csvContent = "\uFEFF" + lines.join("\r\n");
    downloadBlob(new Blob([csvContent], { type: "text/csv;charset=utf-8;" }), `questions_${fileDate}.csv`);
  };

  const exportXLSX = async () => {
    try {
      const XLSX = await import("xlsx");
      const data = rows.map((r, i) => ({
        ลำดับ: i + 1,
        ID: r.id,
        "Survey ID": r.survey_id,
        "ข้อความคำถาม": r.text,
        "ชนิดคำถาม": r.type === "rating" ? "คะแนน (1–5 ดาว)" : "คำตอบแบบเขียน",
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Questions");
      XLSX.writeFile(wb, `questions_${fileDate}.xlsx`);
      ok("ส่งออกไฟล์ .xlsx สำเร็จ");
    } catch (e) {
      exportCSV();
      ok("ส่งออกเป็น .csv แทน (เปิดใน Excel ได้)");
    }
  };

  const onExportAll = () => {
    exportXLSX();
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">จัดการคำถาม (ฟอร์มกลาง)</h1>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-80">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm ring-2 ring-transparent focus:outline-none focus:ring-sky-200"
              placeholder="ค้นหา: ข้อความคำถาม / ชนิด (rating, text)"
              value={search}
              onChange={(e)=>setSearch(e.target.value)}
              aria-label="ค้นหาคำถาม"
            />
          </div>
          <button
            onClick={onExportAll}
            className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-sm hover:bg-slate-50"
            title="ส่งออกข้อมูลทั้งหมดเป็น Excel"
          >
            <Download className="h-4 w-4" />
            ส่งออก Excel
          </button>
          <button
            onClick={()=>setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm shadow-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่มคำถาม
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 text-sky-700 p-2 ring-1 ring-sky-200">
              <ListChecks className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">จำนวนคำถามทั้งหมด</div>
              <div className="text-lg font-semibold">{rows.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-indigo-50 text-indigo-700 p-2 ring-1 ring-indigo-200">
              <Star className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">คำถามชนิดคะแนน (rating)</div>
              <div className="text-lg font-semibold">{rows.filter(r=>r.type==="rating").length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 text-amber-700 p-2 ring-1 ring-amber-200">
              <TypeIcon className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">คำถามชนิดเขียนตอบ (text)</div>
              <div className="text-lg font-semibold">{rows.filter(r=>r.type==="text").length}</div>
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
                <th className="p-3 text-left w-[60px]">ลำดับ</th>
                <th className="p-3 text-left">ข้อความคำถาม</th>
                <th className="p-3 text-left w-[220px]">ชนิดคำถาม</th>
                <th className="p-3 text-right w-[220px]"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (<>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </>)}

              {!loading && filtered.map((q, idx)=>(
                <tr key={q.id} className="border-b last:border-0 hover:bg-slate-50/50">
                  <td className="p-3">{idx+1}</td>
                  <td className="p-3">{q.text}</td>
                  <td className="p-3"><TypeBadge t={q.type} /></td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={()=>onOpenEdit(q)}
                        title="แก้ไขคำถาม"
                        aria-label={`แก้ไขคำถาม #${q.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                        แก้ไข
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                        onClick={()=>onDelete(q)}
                        title="ลบคำถาม"
                        aria-label={`ลบคำถาม #${q.id}`}
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
                        <ListChecks className="h-6 w-6 text-slate-400" />
                      </div>
                      <div className="font-medium">ไม่พบรายการคำถาม</div>
                      <p className="text-sm text-slate-500">ลองปรับคำค้นหา หรือเพิ่มคำถามใหม่ด้วยปุ่ม “เพิ่มคำถาม”</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} title="เพิ่มคำถาม" onClose={()=>setCreateOpen(false)}>
        <div className="space-y-4">
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">ข้อความคำถาม</span>
            <input
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              placeholder="พิมพ์ข้อความคำถาม"
              value={cText}
              onChange={(e)=>setCText(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">ชนิดคำถาม</span>
            <select
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={cType}
              onChange={(e)=>setCType(e.target.value as Q["type"])}
            >
              <option value="rating">คะแนน (1–5 ดาว)</option>
              <option value="text">คำตอบแบบเขียน</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={()=>setCreateOpen(false)}>ยกเลิก</button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={onCreate}>
              <Plus className="h-4 w-4" />
              บันทึกคำถาม
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editOpen} title={`แก้ไขคำถาม #${editOpen?.id || ""}`} onClose={()=>setEditOpen(null)}>
        <div className="space-y-4">
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">ข้อความคำถาม</span>
            <input
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={eText}
              onChange={(e)=>setEText(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">ชนิดคำถาม</span>
            <select
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={eType}
              onChange={(e)=>setEType(e.target.value as Q["type"])}
            >
              <option value="rating">คะแนน (1–5 ดาว)</option>
              <option value="text">คำตอบแบบเขียน</option>
            </select>
          </label>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={()=>setEditOpen(null)}>ยกเลิก</button>
            <button className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={onEdit}>บันทึกการแก้ไข</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast {...toast} />}
    </div>
  );
}
