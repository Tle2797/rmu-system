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
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // โหลดข้อมูล
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const res = await axios.get<Row[]>("/api/admin/departments");
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
    return rows.filter(r => 
      r.code.toLowerCase().includes(q) || 
      r.name.toLowerCase().includes(q)
    );
  }, [rows, query]);

  // ปิด modal
  const closeModal = () => {
    setModalOpen(false);
    setEditingRow(null);
    setFormCode("");
    setFormName("");
  };

  // เปิด modal เพิ่ม
  const openAddModal = () => {
    setModalTitle("เพิ่มหน่วยงานใหม่");
    setEditingRow(null);
    setFormCode("");
    setFormName("");
    setModalOpen(true);
  };

  // เปิด modal แก้ไข
  const openEditModal = (row: Row) => {
    setModalTitle("แก้ไขหน่วยงาน");
    setEditingRow(row);
    setFormCode(row.code);
    setFormName(row.name);
    setModalOpen(true);
  };

  // บันทึกข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formCode.trim() || !formName.trim()) return;

    try {
      setSubmitting(true);
      if (editingRow) {
        // แก้ไข
        await axios.put(`/api/admin/departments/${editingRow.id}`, {
          code: formCode.trim(),
          name: formName.trim(),
        });
        setToast({ msg: "แก้ไขหน่วยงานสำเร็จ", type: "ok" });
      } else {
        // เพิ่มใหม่
        await axios.post("/api/admin/departments", {
          code: formCode.trim(),
          name: formName.trim(),
        });
        setToast({ msg: "เพิ่มหน่วยงานสำเร็จ", type: "ok" });
      }
      
      // รีเฟรชข้อมูล
      const res = await axios.get<Row[]>("/api/admin/departments");
      setRows(Array.isArray(res.data) ? res.data : []);
      closeModal();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "บันทึกข้อมูลไม่สำเร็จ", type: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  // ลบข้อมูล
  const handleDelete = async (row: Row) => {
    if (!confirm(`ต้องการลบหน่วยงาน "${row.name}" หรือไม่?`)) return;

    try {
      await axios.delete(`/api/admin/departments/${row.id}`);
      setToast({ msg: "ลบหน่วยงานสำเร็จ", type: "ok" });
      
      // รีเฟรชข้อมูล
      const res = await axios.get<Row[]>("/api/admin/departments");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "ลบข้อมูลไม่สำเร็จ", type: "err" });
    }
  };

  // คัดลอกลิงก์
  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/survey/${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      setToast({ msg: "คัดลอกลิงก์สำเร็จ", type: "ok" });
    } catch {
      setToast({ msg: "คัดลอกลิงก์ไม่สำเร็จ", type: "err" });
    }
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
          <h1 className="text-2xl font-bold text-slate-900">จัดการหน่วยงาน</h1>
          <p className="text-slate-600 mt-1">เพิ่ม แก้ไข และลบข้อมูลหน่วยงาน</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="ค้นหาหน่วยงาน..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <button
              onClick={openAddModal}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4" />
              เพิ่มหน่วยงาน
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-700">รหัส</th>
                  <th className="text-left p-3 font-medium text-slate-700">ชื่อหน่วยงาน</th>
                  <th className="text-left p-3 font-medium text-slate-700">ลิงก์แบบประเมิน</th>
                  <th className="text-right p-3 font-medium text-slate-700">จัดการ</th>
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
                    <td className="p-3 font-medium text-slate-900">{r.code}</td>
                    <td className="p-3 text-slate-700">{r.name}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/survey/${encodeURIComponent(r.code)}`}
                          target="_blank"
                          className="text-blue-600 hover:underline text-sm"
                        >
                          /survey/{r.code}
                        </a>
                        <button
                          onClick={() => copyLink(r.code)}
                          className="p-1 text-slate-400 hover:text-slate-600"
                          title="คัดลอกลิงก์"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => window.open(`/survey/${encodeURIComponent(r.code)}`, '_blank')}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="เปิดแบบประเมิน"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/api/qrcode/${r.code}.png`, '_blank')}
                          className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="ดู QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => window.open(`/api/qrcode/${r.code}.png`, '_blank')}
                          className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                          title="ดาวน์โหลด QR Code"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(r)}
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
                      {query ? "ไม่พบหน่วยงานที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลหน่วยงาน"}
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
              รหัสหน่วยงาน
            </label>
            <input
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              placeholder="เช่น IT001"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              ชื่อหน่วยงาน
            </label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              placeholder="เช่น ภาควิชาเทคโนโลยีสารสนเทศ"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
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