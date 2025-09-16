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
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${styles}`}>
      {t === "rating" ? <Star className="h-3 w-3" /> : <TypeIcon className="h-3 w-3" />}
      {label}
    </span>
  );
};

/* ---------- Page ---------- */
export default function AdminQuestionsPage() {
  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRow, setEditingRow] = useState<Q | null>(null);
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState<"rating" | "text">("rating");
  const [submitting, setSubmitting] = useState(false);

  // โหลดข้อมูล
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get<Q[]>("/api/admin/questions");
        if (!active) return;
        setRows(Array.isArray(res.data) ? res.data : []);
      } catch (e: any) {
        if (!active) return;
        setToast({ msg: e?.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ", type: "err" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // กรองข้อมูล
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(r => r.text.toLowerCase().includes(q));
  }, [rows, query]);

  // ปิด modal
  const closeModal = () => {
    setModalOpen(false);
    setEditingRow(null);
    setFormText("");
    setFormType("rating");
  };

  // เปิด modal เพิ่ม
  const openAddModal = () => {
    setModalTitle("เพิ่มคำถามใหม่");
    setEditingRow(null);
    setFormText("");
    setFormType("rating");
    setModalOpen(true);
  };

  // เปิด modal แก้ไข
  const openEditModal = (row: Q) => {
    setModalTitle("แก้ไขคำถาม");
    setEditingRow(row);
    setFormText(row.text);
    setFormType(row.type);
    setModalOpen(true);
  };

  // บันทึกข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    try {
      setSubmitting(true);
      if (editingRow) {
        // แก้ไข
        await axios.put(`/api/admin/questions/${editingRow.id}`, {
          text: formText.trim(),
          type: formType,
        });
        setToast({ msg: "แก้ไขคำถามสำเร็จ", type: "ok" });
      } else {
        // เพิ่มใหม่
        await axios.post("/api/admin/questions", {
          text: formText.trim(),
          type: formType,
        });
        setToast({ msg: "เพิ่มคำถามสำเร็จ", type: "ok" });
      }
      
      // รีเฟรชข้อมูล
      const res = await axios.get<Q[]>("/api/admin/questions");
      setRows(Array.isArray(res.data) ? res.data : []);
      closeModal();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "บันทึกข้อมูลไม่สำเร็จ", type: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  // ลบข้อมูล
  const handleDelete = async (row: Q) => {
    const result = await Swal.fire({
      title: "ยืนยันการลบ",
      text: `ต้องการลบคำถาม "${row.text}" หรือไม่?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#ef4444",
      cancelButtonColor: "#6b7280",
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
    });

    if (!result.isConfirmed) return;

    try {
      await axios.delete(`/api/admin/questions/${row.id}`);
      setToast({ msg: "ลบคำถามสำเร็จ", type: "ok" });
      
      // รีเฟรชข้อมูล
      const res = await axios.get<Q[]>("/api/admin/questions");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "ลบข้อมูลไม่สำเร็จ", type: "err" });
    }
  };

  // ส่งออกข้อมูล
  const exportData = () => {
    const csvContent = [
      ["ลำดับ", "คำถาม", "ประเภท"],
      ...filtered.map((q, idx) => [
        idx + 1,
        q.text,
        q.type === "rating" ? "คะแนน (1–5 ดาว)" : "คำตอบแบบเขียน"
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `questions_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setToast({ msg: "ส่งออกข้อมูลสำเร็จ", type: "ok" });
  };

  // ปิด toast
  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">จัดการคำถาม</h1>
          <p className="text-slate-600 mt-1">เพิ่ม แก้ไข และลบคำถามในแบบประเมิน</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="ค้นหาคำถาม..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={exportData}
                className="flex items-center gap-2 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                <Download className="h-4 w-4" />
                ส่งออก
              </button>
              <button
                onClick={openAddModal}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                เพิ่มคำถาม
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-700">ลำดับ</th>
                  <th className="text-left p-3 font-medium text-slate-700">คำถาม</th>
                  <th className="text-left p-3 font-medium text-slate-700">ประเภท</th>
                  <th className="text-right p-3 font-medium text-slate-700">จัดการ</th>
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
                    <td className="p-3 text-slate-500">{idx+1}</td>
                    <td className="p-3 text-slate-900">{q.text}</td>
                    <td className="p-3">
                      <TypeBadge t={q.type} />
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(q)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(q)}
                          className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="ลบ"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}

                {!loading && filtered.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      {query ? "ไม่พบคำถามที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลคำถาม"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal */}
      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              คำถาม
            </label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="กรอกคำถาม..."
              rows={3}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ประเภทคำถาม
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="rating"
                  checked={formType === "rating"}
                  onChange={(e) => setFormType(e.target.value as "rating" | "text")}
                  className="text-blue-600"
                />
                <Star className="h-4 w-4 text-indigo-600" />
                <span className="text-sm">คะแนน (1–5 ดาว)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="text"
                  checked={formType === "text"}
                  onChange={(e) => setFormType(e.target.value as "rating" | "text")}
                  className="text-blue-600"
                />
                <TypeIcon className="h-4 w-4 text-amber-600" />
                <span className="text-sm">คำตอบแบบเขียน</span>
              </label>
            </div>
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 text-slate-600 hover:text-slate-800 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "กำลังบันทึก..." : editingRow ? "แก้ไข" : "เพิ่ม"}
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}