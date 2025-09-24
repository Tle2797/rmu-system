"use client";

import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import Swal from "sweetalert2";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Shield,
  Building2,
  Eye,
  EyeOff,
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
function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border bg-white shadow-sm ${className}`}>
      {children}
    </div>
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
        <div className="w-full max-w-xl rounded-2xl bg-white shadow-xl border ring-1 ring-black/5">
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

function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      <td className="p-3">
        <div className="h-4 w-8 bg-slate-200 rounded" />
      </td>
      <td className="p-3">
        <div className="h-4 w-32 bg-slate-200 rounded" />
      </td>
      <td className="p-3">
        <div className="h-5 w-24 bg-slate-200 rounded-full" />
      </td>
      <td className="p-3">
        <div className="h-4 w-44 bg-slate-200 rounded" />
      </td>
      <td className="p-3">
        <div className="flex justify-end gap-2">
          <div className="h-8 w-20 bg-slate-200 rounded-lg" />
          <div className="h-8 w-24 bg-slate-200 rounded-lg" />
        </div>
      </td>
    </tr>
  );
}

/** ---------- SweetAlert2 helpers ---------- */
const Toast = Swal.mixin({
  toast: true,
  position: "bottom-end",
  showConfirmButton: false,
  timer: 2500,
  timerProgressBar: true,
});

/** ---------- Page ---------- */
export default function AdminUsersPage() {
  const [rows, setRows] = useState<UserRow[]>([]);
  const [deps, setDeps] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTitle, setModalTitle] = useState("");
  const [editingRow, setEditingRow] = useState<UserRow | null>(null);

  const [formUsername, setFormUsername] = useState("");
  const [formRole, setFormRole] = useState<RoleCode>("staff");
  const [formDeptId, setFormDeptId] = useState<number | null>(null);

  // ส่วนรหัสผ่าน
  const [passMode, setPassMode] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);

  const isCreate = !editingRow;

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
        Toast.fire({
          icon: "error",
          title: e?.response?.data?.error || "โหลดข้อมูลไม่สำเร็จ",
        });
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  // กรองข้อมูล
  const filtered = useMemo(() => {
    if (!query.trim()) return rows;
    const q = query.toLowerCase();
    return rows.filter(
      (r) =>
        r.username.toLowerCase().includes(q) ||
        r.department_name?.toLowerCase().includes(q) ||
        roleLabelTH[r.role_code].toLowerCase().includes(q)
    );
  }, [rows, query]);

  // ปิด modal
  const closeModal = async () => {
    if (
      formUsername ||
      passMode ||
      formDeptId ||
      newPassword ||
      confirmPassword
    ) {
      const res = await Swal.fire({
        title: "ปิดหน้าต่าง?",
        text: "ข้อมูลที่ยังไม่บันทึกจะหายไป",
        icon: "warning",
        showCancelButton: true,
        confirmButtonText: "ปิด",
        cancelButtonText: "ยกเลิก",
        confirmButtonColor: "#ef4444",
      });
      if (!res.isConfirmed) return;
    }
    setModalOpen(false);
    setEditingRow(null);
    setFormUsername("");
    setFormRole("staff");
    setFormDeptId(null);
    setPassMode(false);
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
  };

  // เปิด modal เพิ่ม
  const openAddModal = () => {
    setModalTitle("เพิ่มผู้ใช้ใหม่");
    setEditingRow(null);
    setFormUsername("");
    setFormRole("staff");
    setFormDeptId(null);
    // โชว์ช่องรหัสผ่านทันทีเมื่อเป็นการเพิ่ม
    setPassMode(true);
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    setModalOpen(true);
  };

  // เปิด modal แก้ไข
  const openEditModal = (row: UserRow) => {
    setModalTitle("แก้ไขผู้ใช้");
    setEditingRow(row);
    setFormUsername(row.username);
    setFormRole(row.role_code);
    setFormDeptId(row.department_id);
    // สำหรับแก้ไข เริ่มต้นไม่เปลี่ยนรหัสผ่าน
    setPassMode(false);
    setNewPassword("");
    setConfirmPassword("");
    setShowNew(false);
    setShowConfirm(false);
    setModalOpen(true);
  };

  // เรียกใหม่หลังแก้ไข
  const reloadUsers = async () => {
    const res = await axios.get<UserRow[]>("/api/admin/users");
    setRows(Array.isArray(res.data) ? res.data : []);
  };

  // Validate รหัสผ่าน (ขั้นต่ำ 8 ตัวอักษร)
  const validatePassword = () => {
    if (!passMode) return true;
    if (newPassword.length < 8) {
      Toast.fire({
        icon: "error",
        title: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
      });
      return false;
    }
    if (newPassword !== confirmPassword) {
      Toast.fire({ icon: "error", title: "รหัสผ่านใหม่และยืนยันไม่ตรงกัน" });
      return false;
    }
    return true;
  };

  // บันทึกข้อมูล
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formUsername.trim()) return;
    if (!validatePassword()) return;

    try {
      setSubmitting(true);
      if (editingRow) {
        // 1) แก้ไขข้อมูลผู้ใช้
        await axios.put(`/api/admin/users/${editingRow.id}`, {
          username: formUsername.trim(),
          role_code: formRole,
          department_id: formDeptId,
        });

        // 2) ถ้ามีการเปลี่ยนรหัสผ่าน → เรียก API แยก
        if (passMode && newPassword) {
          await axios.post(
            `/api/admin/users/${editingRow.id}/change-password`,
            {
              new_password: newPassword,
            }
          );
        }

        await Swal.fire({
          icon: "success",
          title: "บันทึกข้อมูลผู้ใช้สำเร็จ",
          confirmButtonText: "ตกลง",
        });
      } else {
        // เพิ่มใหม่
        const createRes = await axios.post<{ id: number }>("/api/admin/users", {
          username: formUsername.trim(),
          role_code: formRole,
          department_id: formDeptId,
        });

        // ตั้งรหัสผ่านทันที (เพราะ passMode ถูกเปิดเสมอในกรณีเพิ่ม)
        if (passMode && newPassword) {
          const newId = (createRes.data as any)?.id;
          if (newId) {
            await axios.post(`/api/admin/users/${newId}/change-password`, {
              new_password: newPassword,
            });
          }
        }

        await Swal.fire({
          icon: "success",
          title: "เพิ่มผู้ใช้สำเร็จ",
          confirmButtonText: "ตกลง",
        });
      }

      await reloadUsers();
      setModalOpen(false);
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

  // ลบผู้ใช้ (ใช้ confirm แบบสวย)
  const handleDelete = async (row: UserRow) => {
    const res = await Swal.fire({
      title: `ลบผู้ใช้ "${row.username}" ?`,
      text: "การลบนี้ไม่สามารถย้อนกลับได้",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ลบ",
      cancelButtonText: "ยกเลิก",
      confirmButtonColor: "#ef4444",
    });
    if (!res.isConfirmed) return;

    try {
      await axios.delete(`/api/admin/users/${row.id}`);
      Toast.fire({ icon: "success", title: "ลบผู้ใช้สำเร็จ" });
      await reloadUsers();
    } catch (e: any) {
      Swal.fire({
        icon: "error",
        title: "ลบข้อมูลไม่สำเร็จ",
        text: e?.response?.data?.error || "กรุณาลองอีกครั้ง",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-sky-50 via-slate-50 to-sky-50">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900">จัดการผู้ใช้</h1>
          <p className="text-slate-600 mt-1">
            เพิ่ม แก้ไข ลบ และเปลี่ยนรหัสผ่านผู้ใช้
          </p>
        </div>

        <Card className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-5">
            <div className="w-full sm:max-w-sm">
              <label className="sr-only">ค้นหา</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
                <input
                  type="text"
                  placeholder="ค้นหาผู้ใช้ ชื่อหน่วยงาน หรือบทบาท..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent bg-white"
                />
              </div>
            </div>

            <button
              onClick={openAddModal}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white shadow-sm hover:bg-sky-700 transition"
            >
              <Plus className="h-4 w-4" />
              เพิ่มผู้ใช้
            </button>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-sky-100 shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-gradient-to-r from-sky-50 to-sky-100 border-b border-sky-200 sticky top-0 z-10">
                <tr>
                  <th className="text-left p-3 font-semibold text-slate-800 w-12">
                    ลำดับ
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-800">
                    ชื่อผู้ใช้
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-800">
                    บทบาท
                  </th>
                  <th className="text-left p-3 font-semibold text-slate-800">
                    หน่วยงาน
                  </th>
                  <th className="text-right p-3 font-semibold text-slate-800 w-36">
                    
                  </th>
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
                  filtered.map((r, idx) => (
                    <tr
                      key={r.id}
                      className="border-b border-slate-100 hover:bg-sky-50 transition-colors"
                    >
                      <td className="p-3 text-slate-500">{idx + 1}</td>
                      <td className="p-3 font-medium text-slate-900">
                        {r.username}
                      </td>
                      <td className="p-3">
                        <RoleBadge role={r.role_code} />
                      </td>
                      <td className="p-3 text-slate-700">
                        {r.department_name ? (
                          <div className="flex items-center gap-1">
                            <Building2 className="h-3 w-3 text-slate-400" />
                            <span>{r.department_name}</span>
                            <span className="text-slate-400">
                              ({r.department_code})
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400">ไม่ระบุ</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-1.5">
                          {/* แก้ไข – เหลือง */}
                          <button
                            onClick={() => openEditModal(r)}
                            className="px-3 py-2 rounded-lg text-amber-600 bg-amber-50 hover:bg-amber-100 transition-colors"
                            title="แก้ไข"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {/* ลบ – แดง */}
                          <button
                            onClick={() => handleDelete(r)}
                            className="px-3 py-2 rounded-lg text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
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
                    <td colSpan={5} className="p-10">
                      <div className="text-center">
                        <div className="mx-auto mb-3 h-10 w-10 rounded-full bg-sky-50 grid place-items-center ring-1 ring-sky-100">
                          <Search className="h-5 w-5 text-sky-600" />
                        </div>
                        <div className="font-medium text-slate-700">
                          ไม่พบข้อมูล
                        </div>
                        <div className="text-slate-500 text-sm mt-1">
                          {query
                            ? "ไม่มีผู้ใช้ที่ตรงกับคำค้นหา"
                            : "ยังไม่มีข้อมูลผู้ใช้"}
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

      {/* Modal เพิ่ม/แก้ไข */}
      <Modal open={modalOpen} title={modalTitle} onClose={closeModal}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ข้อมูลทั่วไป */}
          <div className="grid grid-cols-1 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                ชื่อผู้ใช้
              </label>
              <input
                type="text"
                value={formUsername}
                onChange={(e) => setFormUsername(e.target.value)}
                className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  บทบาท
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value as RoleCode)}
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
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
                  onChange={(e) =>
                    setFormDeptId(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent"
                >
                  <option value="">ไม่ระบุหน่วยงาน</option>
                  {deps.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* ====== ส่วนรหัสผ่าน ======
              เพิ่มใหม่: โชว์เสมอ (passMode=true)
              แก้ไข: มีเช็กบ็อกซ์ให้เลือกก่อน (passMode=false เริ่มต้น)
          */}
          {!isCreate && (
            <div className="pt-1">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={passMode}
                  onChange={(e) => setPassMode(e.target.checked)}
                />
                เปลี่ยนรหัสผ่าน
              </label>
            </div>
          )}

          {(isCreate || passMode) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร){isCreate ? " *" : ""}
                </label>
                <div className="relative">
                  <input
                    type={showNew ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-10"
                    placeholder="••••••••"
                    required={isCreate}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                    aria-label={showNew ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  ยืนยันรหัสผ่าน{isCreate ? " *" : ""}
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-sky-200 rounded-lg focus:ring-2 focus:ring-sky-500 focus:border-transparent pr-10"
                    placeholder="••••••••"
                    required={isCreate}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                    aria-label={showConfirm ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {submitting
                ? "กำลังบันทึก..."
                : editingRow
                ? "บันทึกการแก้ไข"
                : "เพิ่มผู้ใช้"}
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
    </div>
  );
}
