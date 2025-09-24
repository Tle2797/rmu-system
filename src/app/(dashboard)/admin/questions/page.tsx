"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import { Plus, Search, Pencil, Trash2, Star, Type as TypeIcon } from "lucide-react";

/* =================== Config =================== */
const SURVEY_ID = 1;

/* =================== Types ==================== */
type Q = { id: number; survey_id: number; text: string; type: "rating" | "text" };
type SurveyMeta = { id: number; title: string };

/* =============== Small UI helpers ============= */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>;
}

function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px]" onClick={onClose} />
      <div className="absolute inset-0 grid place-items-center p-4">
        <div className="w-full max-w-lg rounded-2xl bg-white shadow-xl border ring-1 ring-black/5">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h3 className="font-semibold">{title}</h3>
            <button
              onClick={onClose}
              className="rounded-lg px-2.5 py-1.5 hover:bg-slate-100 text-slate-600"
              aria-label="ปิดหน้าต่าง"
            >
              ✕
            </button>
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
        type === "ok"
          ? "bg-emerald-600 text-white ring-emerald-500/40"
          : "bg-rose-600 text-white ring-rose-500/40"
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
  const styles =
    t === "rating"
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

/* ================== Page (Questions) ================== */
export default function AdminQuestionsPage() {
  const [rows, setRows] = useState<Q[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // Survey title (หัวข้อแบบประเมิน) — ไม่มี description/is_active
  const [surveyTitle, setSurveyTitle] = useState("");
  const [savingTitle, setSavingTitle] = useState(false);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRow, setEditingRow] = useState<Q | null>(null);
  const [formText, setFormText] = useState("");
  const [formType, setFormType] = useState<"rating" | "text">("rating");
  const [submitting, setSubmitting] = useState(false);

  // โหลด Survey title + คำถาม
  const reloadQuestions = async () => {
    const res = await axios.get<Q[]>("/api/admin/questions");
    setRows(Array.isArray(res.data) ? res.data : []);
  };

  const fetchSurveyTitle = async () => {
    const r = await axios.get<SurveyMeta>(`/api/surveys/${SURVEY_ID}`);
    setSurveyTitle(r.data?.title || "");
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        await Promise.all([fetchSurveyTitle(), reloadQuestions()]);
      } catch (e: any) {
        if (!active) return;
        setToast({ msg: e?.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ", type: "err" });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, []);

  // บันทึกหัวข้อแบบประเมิน
  const saveSurveyTitle = async () => {
    if (!surveyTitle.trim()) {
      setToast({ msg: "กรุณากรอกหัวข้อแบบประเมิน", type: "err" });
      return;
    }
    try {
      setSavingTitle(true);
      await axios.put(`/api/surveys/${SURVEY_ID}`, { title: surveyTitle.trim() });
      setToast({ msg: "บันทึกหัวข้อแบบประเมินแล้ว", type: "ok" });
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "บันทึกหัวข้อไม่สำเร็จ", type: "err" });
    } finally {
      setSavingTitle(false);
    }
  };

  // กรองข้อมูล
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter((r) => r.text.toLowerCase().includes(q));
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

  // บันทึกคำถาม
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formText.trim()) return;

    try {
      setSubmitting(true);
      if (editingRow) {
        await axios.put(`/api/admin/questions/${editingRow.id}`, {
          text: formText.trim(),
          type: formType,
        });
        setToast({ msg: "แก้ไขคำถามสำเร็จ", type: "ok" });
      } else {
        await axios.post("/api/admin/questions", {
          text: formText.trim(),
          type: formType,
        });
        setToast({ msg: "เพิ่มคำถามสำเร็จ", type: "ok" });
      }
      await reloadQuestions();
      closeModal();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "บันทึกข้อมูลไม่สำเร็จ", type: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  // ลบคำถาม
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
      await reloadQuestions();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "ลบข้อมูลไม่สำเร็จ", type: "err" });
    }
  };

  // ปิด toast อัตโนมัติ
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-50">
      <div className="mx-auto max-w-7xl px-4 py-8 space-y-8">
        {/* หัวเรื่องหลัก */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">จัดการแบบสอบถาม</h1>
          <p className="text-slate-600 mt-1">แก้ไขหัวข้อแบบประเมิน และเพิ่ม/แก้ไข/ลบคำถาม</p>
        </div>

        {/* ===== หัวข้อแบบประเมิน (Title only) ===== */}
        <Card className="p-6">
          <div className="mb-4">
            <div className="font-semibold text-slate-900">หัวข้อแบบประเมิน</div>
            <p className="text-xs text-slate-500 mt-1">
              หัวข้อนี้จะแสดงในหน้าแบบประเมินของผู้ใช้งาน
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <input
              value={surveyTitle}
              onChange={(e) => setSurveyTitle(e.target.value)}
              placeholder="เช่น แบบประเมินความพึงพอใจการให้บริการ"
              className="w-full rounded-xl border border-sky-200 p-2.5 focus:outline-none focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
            />
            <button
              onClick={saveSurveyTitle}
              disabled={savingTitle}
              className="rounded-xl px-4 py-2.5 bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {savingTitle ? "กำลังบันทึก…" : "บันทึกหัวข้อ"}
            </button>
          </div>
        </Card>

        {/* ===== ตารางคำถาม ===== */}
        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="ค้นหาคำถาม..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
                />
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              เพิ่มคำถาม
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-sky-100 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-sky-50 to-sky-100 border-b border-sky-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-800">ลำดับ</th>
                  <th className="text-left p-3 font-semibold text-slate-800">คำถาม</th>
                  <th className="text-left p-3 font-semibold text-slate-800">ประเภท</th>
                  <th className="text-right p-3 font-semibold text-slate-800">จัดการ</th>
                </tr>
              </thead>
              <tbody className="[&>tr:nth-child(even)]:bg-sky-50/30">
                {loading && (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                )}

                {!loading &&
                  filtered.map((q, idx) => (
                    <tr key={q.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                      <td className="p-3 text-slate-500">{idx + 1}</td>
                      <td className="p-3 text-slate-900">{q.text}</td>
                      <td className="p-3"><TypeBadge t={q.type} /></td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1.5">
                          {/* แก้ไข – เหลือง */}
                          <button
                            onClick={() => openEditModal(q)}
                            className="p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                            title="แก้ไข"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {/* ลบ – แดง */}
                          <button
                            onClick={() => handleDelete(q)}
                            className="p-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
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
                    <td colSpan={4} className="p-10">
                      <div className="text-center">
                        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-sky-50 grid place-items-center ring-1 ring-sky-100">
                          <Search className="h-5 w-5 text-sky-600" />
                        </div>
                        <div className="font-medium text-slate-700">ไม่พบคำถาม</div>
                        <div className="text-slate-500 text-sm mt-1">
                          {query ? "ไม่พบคำถามที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลคำถาม"}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Modal เพิ่ม/แก้ไขคำถาม */}
      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">คำถาม</label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              placeholder="กรอกคำถาม..."
              rows={3}
              className="w-full px-3 py-2 border border-sky-500 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent resize-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ประเภทคำถาม</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  value="rating"
                  checked={formType === "rating"}
                  onChange={(e) => setFormType(e.target.value as "rating" | "text")}
                  className="text-sky-600"
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
                  className="text-sky-600"
                />
                <TypeIcon className="h-4 w-4 text-amber-600" />
                <span className="text-sm">คำตอบแบบเขียน</span>
              </label>
            </div>
          </div>

          {/* ปุ่ม: บันทึก (ฟ้า) + ยกเลิก (แดง ขวาสุด) */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "กำลังบันทึก..." : editingRow ? "แก้ไข" : "เพิ่ม"}
            </button>
            <button
              type="button"
              onClick={closeModal}
              className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors"
            >
              ยกเลิก
            </button>
          </div>
        </form>
      </Modal>

      {/* Toast */}
      {toast && <Toast msg={toast.msg} type={toast.type} />}
    </div>
  );
}
