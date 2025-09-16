"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Plus, Search, Pencil, KeyRound, Trash2, Users, Building2, Shield, UserPlus
} from "lucide-react";


/** ---------- Types ---------- */
type RoleCode = "admin" | "exec" | "dept_head" | "staff";
type UserRow = {
  id: number;
  username: string;
  role_code: RoleCode;
  department_id: number | null;
  department_code?: string | null;
  department_name?: string | null;
  created_at: string;
};
type Department = { id: number; code: string; name: string };

/** ---------- Labels & helpers ---------- */
const roleLabelTH: Record<RoleCode, string> = {
  admin: "ผู้ดูแลระบบ",
  exec: "ผู้บริหาร",
  dept_head: "หัวหน้าหน่วยงาน",
  staff: "เจ้าหน้าที่",
};
const roleBadgeClass: Record<RoleCode, string> = {
  admin: "bg-purple-50 text-purple-700 ring-purple-200",
  exec: "bg-sky-50 text-sky-700 ring-sky-200",
  dept_head: "bg-amber-50 text-amber-700 ring-amber-200",
  staff: "bg-slate-50 text-slate-700 ring-slate-200",
};
const RoleBadge = ({ role }: { role: RoleCode }) => (
  <span
    className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${roleBadgeClass[role]}`}
    title={roleLabelTH[role]}
  >
    <Shield className="h-3.5 w-3.5" aria-hidden />
    {roleLabelTH[role]}
  </span>
);

/** ---------- Reusable UI ---------- */
function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>{children}</div>
  );
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
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
        onClick={onClose}
      />
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
      <td className="p-3"><div className="h-4 w-8 bg-slate-200 rounded" /></td>
      <td className="p-3"><div className="h-4 w-32 bg-slate-200 rounded" /></td>
      <td className="p-3"><div className="h-5 w-24 bg-slate-200 rounded-full" /></td>
      <td className="p-3"><div className="h-4 w-44 bg-slate-200 rounded" /></td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-20 bg-slate-200 rounded-lg" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
          <div className="h-8 w-16 bg-slate-200 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

/** ---------- Page ---------- */
export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [deps, setDeps] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRow, setEditingRow] = useState<UserRow | null>(null);
  const [formUsername, setFormUsername] = useState("");
  const [formRole, setFormRole] = useState<RoleCode>("staff");
  const [formDeptId, setFormDeptId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // โหลดข้อมูล
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setLoading(true);
        const [usersRes, depsRes] = await Promise.all([
          axios.get<UserRow[]>("/api/admin/users"),
          axios.get<Department[]>("/api/departments"),
        ]);
        if (!active) return;
        setRows(Array.isArray(usersRes.data) ? usersRes.data : []);
        setDeps(Array.isArray(depsRes.data) ? depsRes.data : []);
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
      r.username.toLowerCase().includes(q) || 
      r.department_name?.toLowerCase().includes(q) ||
      roleLabelTH[r.role_code].toLowerCase().includes(q)
    );
  }, [rows, query]);

  // ปิด modal
  const closeModal = () => {
    setModalOpen(false);
    setEditingRow(null);
    setFormUsername("");
    setFormRole("staff");
    setFormDeptId(null);
  };

  // เปิด modal เพิ่ม
  const openAddModal = () => {
    setModalTitle("เพิ่มผู้ใช้ใหม่");
    setEditingRow(null);
    setFormUsername("");
    setFormRole("staff");
    setFormDeptId(null);
    setModalOpen(true);
  };

  // เปิด modal แก้ไข
  const openEditModal = (row: UserRow) => {
    setModalTitle("แก้ไขผู้ใช้");
    setEditingRow(row);
    setFormUsername(row.username);
    setFormRole(row.role_code);
    setFormDeptId(row.department_id);
    setModalOpen(true);
  };

  // บันทึกข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) return;

    try {
      setSubmitting(true);
      if (editingRow) {
        // แก้ไข
        await axios.put(`/api/admin/users/${editingRow.id}`, {
          username: formUsername.trim(),
          role_code: formRole,
          department_id: formDeptId,
        });
        setToast({ msg: "แก้ไขผู้ใช้สำเร็จ", type: "ok" });
      } else {
        // เพิ่มใหม่
        await axios.post("/api/admin/users", {
          username: formUsername.trim(),
          role_code: formRole,
          department_id: formDeptId,
        });
        setToast({ msg: "เพิ่มผู้ใช้สำเร็จ", type: "ok" });
      }
      
      // รีเฟรชข้อมูล
      const res = await axios.get<UserRow[]>("/api/admin/users");
      setRows(Array.isArray(res.data) ? res.data : []);
      closeModal();
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "บันทึกข้อมูลไม่สำเร็จ", type: "err" });
    } finally {
      setSubmitting(false);
    }
  };

  // ลบข้อมูล
  const handleDelete = async (row: UserRow) => {
    if (!confirm(`ต้องการลบผู้ใช้ "${row.username}" หรือไม่?`)) return;

    try {
      await axios.delete(`/api/admin/users/${row.id}`);
      setToast({ msg: "ลบผู้ใช้สำเร็จ", type: "ok" });
      
      // รีเฟรชข้อมูล
      const res = await axios.get<UserRow[]>("/api/admin/users");
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "ลบข้อมูลไม่สำเร็จ", type: "err" });
    }
  };

  // รีเซ็ตรหัสผ่าน
  const resetPassword = async (row: UserRow) => {
    if (!confirm(`ต้องการรีเซ็ตรหัสผ่านสำหรับ "${row.username}" หรือไม่?`)) return;

    try {
      await axios.post(`/api/admin/users/${row.id}/reset-password`);
      setToast({ msg: "รีเซ็ตรหัสผ่านสำเร็จ", type: "ok" });
    } catch (e: any) {
      setToast({ msg: e?.response?.data?.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ", type: "err" });
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
          <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้</h1>
          <p className="text-slate-600 mt-1">เพิ่ม แก้ไข และลบข้อมูลผู้ใช้</p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้ใช้..."
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
              <UserPlus className="h-4 w-4" />
              เพิ่มผู้ใช้
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="text-left p-3 font-medium text-slate-700">#</th>
                  <th className="text-left p-3 font-medium text-slate-700">ชื่อผู้ใช้</th>
                  <th className="text-left p-3 font-medium text-slate-700">บทบาท</th>
                  <th className="text-left p-3 font-medium text-slate-700">หน่วยงาน</th>
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

                {!loading && filtered.map((r, idx) => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-slate-50/50">
                    <td className="p-3 text-slate-500">{idx + 1}</td>
                    <td className="p-3 font-medium text-slate-900">{r.username}</td>
                    <td className="p-3">
                      <RoleBadge role={r.role_code} />
                    </td>
                    <td className="p-3 text-slate-700">
                      {r.department_name ? (
                        <div className="flex items-center gap-1">
                          <Building2 className="h-3 w-3 text-slate-400" />
                          <span>{r.department_name}</span>
                          <span className="text-slate-400">({r.department_code})</span>
                        </div>
                      ) : (
                        <span className="text-slate-400">ไม่ระบุ</span>
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => resetPassword(r)}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                          title="รีเซ็ตรหัสผ่าน"
                        >
                          <KeyRound className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEditModal(r)}
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
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
                    <td colSpan={5} className="p-8 text-center text-slate-500">
                      {query ? "ไม่พบผู้ใช้ที่ตรงกับคำค้นหา" : "ยังไม่มีข้อมูลผู้ใช้"}
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
              ชื่อผู้ใช้
            </label>
            <input
              type="text"
              value={formUsername}
              onChange={(e) => setFormUsername(e.target.value)}
              placeholder="เช่น john.doe"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              บทบาท
            </label>
            <select
              value={formRole}
              onChange={(e) => setFormRole(e.target.value as RoleCode)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="staff">เจ้าหน้าที่</option>
              <option value="dept_head">หัวหน้าหน่วยงาน</option>
              <option value="exec">ผู้บริหาร</option>
              <option value="admin">ผู้ดูแลระบบ</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              หน่วยงาน
            </label>
            <select
              value={formDeptId || ""}
              onChange={(e) => setFormDeptId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">ไม่ระบุหน่วยงาน</option>
              {deps.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.code})
                </option>
              ))}
            </select>
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