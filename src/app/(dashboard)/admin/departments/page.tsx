"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  Plus, Search, Pencil, Download, Trash2,
  QrCode, ExternalLink, Copy
} from "lucide-react";

type Row = { id: number; code: string; name: string; qr_code: string };

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>
      {children}
    </div>
  );
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
            <h3 className="font-semibold text-slate-900">{title}</h3>
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

// -------- SweetAlert2 Toast helper --------
const Toast = Swal.mixin({
  toast: true,
  position: "bottom-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

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
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRow, setEditingRow] = useState<Row | null>(null);
  const [formCode, setFormCode] = useState("");
  const [formName, setFormName] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // โหลดข้อมูล
  const fetchRows = async () => {
    const res = await axios.get<Row[]>("/api/admin/departments");
    setRows(Array.isArray(res.data) ? res.data : []);
  };

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        await fetchRows();
      } catch (e: any) {
        if (!active) return;
        Toast.fire({ icon: "error", title: e?.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ" });
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
        await axios.put(`/api/admin/departments/${editingRow.id}`, {
          code: formCode.trim(),
          name: formName.trim(),
        });
        await Swal.fire({ icon: "success", title: "แก้ไขหน่วยงานสำเร็จ", confirmButtonText: "ตกลง" });
      } else {
        await axios.post("/api/admin/departments", {
          code: formCode.trim(),
          name: formName.trim(),
        });
        await Swal.fire({ icon: "success", title: "เพิ่มหน่วยงานสำเร็จ", confirmButtonText: "ตกลง" });
      }
      await fetchRows();
      closeModal();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: "บันทึกข้อมูลไม่สำเร็จ",
        text: e?.response?.data?.error || "กรุณาลองอีกครั้ง",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // ลบข้อมูล (ยืนยันด้วย SweetAlert2)
  const handleDelete = async (row: Row) => {
    const res = await Swal.fire({
      title: `ลบหน่วยงาน "${row.name}" ?`,
      text: "คุณต้องการลบหน่วยงานนี้จริงหรือไม่",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
    });
    if (!res.isConfirmed) return;

    try {
      await axios.delete(`/api/admin/departments/${row.id}`);
      Toast.fire({ icon: "success", title: "ลบหน่วยงานสำเร็จ" });
      await fetchRows();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: "ลบข้อมูลไม่สำเร็จ",
        text: e?.response?.data?.error || "กรุณาลองอีกครั้ง",
      });
    }
  };

  // คัดลอกลิงก์ (แจ้งด้วย Toast)
  const copyLink = async (code: string) => {
    const link = `${window.location.origin}/survey/${encodeURIComponent(code)}`;
    try {
      await navigator.clipboard.writeText(link);
      Toast.fire({ icon: "success", title: "คัดลอกลิงก์สำเร็จ" });
    } catch {
      Toast.fire({ icon: "error", title: "คัดลอกลิงก์ไม่สำเร็จ" });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">จัดการหน่วยงาน</h1>
          <p className="text-slate-600 mt-1">เพิ่ม แก้ไข และลบข้อมูลหน่วยงาน</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6 sm:items-center sm:justify-between">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="ค้นหาหน่วยงาน..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-10 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 shadow-sm"
            >
              <Plus className="h-4 w-4" />
              เพิ่มหน่วยงาน
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-sky-100 shadow-sm">
            <table className="w-full text-sm">
              {/* หัวตารางธีมฟ้า + เส้นขอบเนียน */}
              <thead className="bg-gradient-to-r from-sky-50 to-sky-100 border-b border-sky-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-800">รหัส</th>
                  <th className="text-left p-3 font-semibold text-slate-800">ชื่อหน่วยงาน</th>
                  <th className="text-left p-3 font-semibold text-slate-800">ลิงก์แบบประเมิน</th>
                  <th className="text-right p-3 font-semibold text-slate-800"></th>
                </tr>
              </thead>

              {/* เน้นอ่านง่าย: zebra stripes + hover ฟ้าอ่อน */}
              <tbody className="[&>tr:nth-child(even)]:bg-sky-50/30">
                {loading && (
                  <>
                    <SkeletonRow />
                    <SkeletonRow />
                    <SkeletonRow />
                  </>
                )}

                {!loading && filtered.map((r) => (
                  <tr key={r.id} className="border-b border-slate-100 hover:bg-sky-50 transition-colors">
                    <td className="p-3 font-medium text-slate-900">{r.code}</td>
                    <td className="p-3 text-slate-700">{r.name}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <a
                          href={`/survey/${encodeURIComponent(r.code)}`}
                          target="_blank"
                          className="text-sky-700 hover:text-sky-800 hover:underline text-sm"
                        >
                          /survey/{r.code}
                        </a>
                        <button
                          onClick={() => copyLink(r.code)}
                          className="p-1 rounded-md text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                          title="คัดลอกลิงก์"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1.5">
                        {/* เปิดแบบประเมิน – ฟ้า */}
                        <button
                          onClick={() => window.open(`/survey/${encodeURIComponent(r.code)}`, '_blank')}
                          className="p-2 rounded-lg text-sky-700 bg-sky-50 hover:bg-sky-100 transition-colors"
                          title="เปิดแบบประเมิน"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </button>
                        {/* ดู QR – เขียว */}
                        <button
                          onClick={() => window.open(`/api/qrcode/${r.code}.png`, '_blank')}
                          className="p-2 rounded-lg text-green-600 bg-green-50 hover:bg-green-100 transition-colors"
                          title="ดู QR Code"
                        >
                          <QrCode className="h-4 w-4" />
                        </button>
                        {/* ดาวน์โหลด QR – ม่วง */}
                        <button
                          onClick={() => window.open(`/api/qrcode/${r.code}.png`, '_blank')}
                          className="p-2 rounded-lg text-purple-600 bg-purple-50 hover:bg-purple-100 transition-colors"
                          title="ดาวน์โหลด QR Code"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        {/* แก้ไข – เหลือง */}
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                          title="แก้ไข"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        {/* ลบ – แดง */}
                        <button
                          onClick={() => handleDelete(r)}
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
                        <div className="font-medium text-slate-700">ไม่พบข้อมูล</div>
                        <div className="text-slate-500 text-sm mt-1">
                          {query ? "ไม่พบหน่วยงานที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลหน่วยงาน"}
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

      {/* Modal */}
      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">รหัสหน่วยงาน</label>
            <input
              type="text"
              value={formCode}
              onChange={(e) => setFormCode(e.target.value)}
              className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อหน่วยงาน</label>
            <input
              type="text"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
              required
            />
          </div>

          {/* ปุ่มด้านล่าง: ยกเลิก (แดง) อยู่ขวาสุด */}
          <div className="flex justify-end gap-3 pt-4">
            {/* บันทึก (โทนฟ้า) */}
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50 transition-colors"
            >
              {submitting ? "กำลังบันทึก..." : editingRow ? "แก้ไข" : "เพิ่ม"}
            </button>

            {/* ยกเลิก (พื้นแดง) */}
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
    </div>
  );
}
