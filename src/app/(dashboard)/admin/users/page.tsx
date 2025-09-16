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
function SectionTitle({ title, desc }: { title: string; desc?: string }) {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {desc && <p className="text-slate-600 text-sm mt-0.5">{desc}</p>}
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

  // search
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.username.toLowerCase().includes(q) ||
        r.role_code.toLowerCase().includes(q) ||
        (r.department_code || "").toLowerCase().includes(q) ||
        (r.department_name || "").toLowerCase().includes(q)
    );
  }, [rows, search]);

  // toast
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);
  const showOk = (m: string) => {
    setToast({ msg: m, type: "ok" });
    setTimeout(() => setToast(null), 1500);
  };
  const showErr = (m: string) => {
    setToast({ msg: m, type: "err" });
    setTimeout(() => setToast(null), 2000);
  };

  // modals state
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState<null | UserRow>(null);
  const [resetOpen, setResetOpen] = useState<null | UserRow>(null);

  // create form
  const [cUsername, setCUser] = useState("");
  const [cPassword, setCPw] = useState("");
  const [cRole, setCRole] = useState<RoleCode>("staff");
  const [cDepId, setCDep] = useState<number | "">("");

  // edit form
  const [eRole, setERole] = useState<RoleCode>("staff");
  const [eDepId, setEDep] = useState<number | "">("");

  // reset form
  const [newPw, setNewPw] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [u, d] = await Promise.all([
        axios.get<UserRow[]>("/api/admin/users"),
        axios.get<Department[]>("/api/admin/departments"),
      ]);
      setRows(u.data || []);
      setDeps(d.data || []);
    } catch {
      showErr("ไม่สามารถดึงข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, []);

  const onCreate = async () => {
    if (!cUsername || !cPassword) return showErr("กรุณากรอกชื่อผู้ใช้และรหัสผ่าน");
    try {
      await axios.post("/api/admin/users", {
        username: cUsername,
        password: cPassword,
        role_code: cRole,
        department_id: cDepId === "" ? null : cDepId,
      });
      setCreateOpen(false);
      setCUser(""); setCPw(""); setCRole("staff"); setCDep("");
      showOk("เพิ่มผู้ใช้สำเร็จ");
      load();
    } catch (e: any) {
      showErr(e?.response?.data?.error || "เพิ่มผู้ใช้ไม่สำเร็จ");
    }
  };

  const onOpenEdit = (u: UserRow) => {
    setERole(u.role_code);
    setEDep(u.department_id ?? "");
    setEditOpen(u);
  };
  const onEdit = async () => {
    if (!editOpen) return;
    try {
      await axios.put(`/api/admin/users/${editOpen.id}`, {
        role_code: eRole,
        department_id: eDepId === "" ? null : eDepId,
      });
      setEditOpen(null);
      showOk("บันทึกการแก้ไขเรียบร้อย");
      load();
    } catch (e: any) {
      showErr(e?.response?.data?.error || "บันทึกการแก้ไขไม่สำเร็จ");
    }
  };

  const onResetPw = async () => {
    if (!resetOpen || !newPw) return showErr("กรุณากำหนดรหัสผ่านใหม่");
    try {
      await axios.post(`/api/admin/users/${resetOpen.id}/reset-password`, { password: newPw });
      setResetOpen(null);
      setNewPw("");
      showOk("รีเซ็ตรหัสผ่านสำเร็จ");
    } catch (e: any) {
      showErr(e?.response?.data?.error || "รีเซ็ตรหัสผ่านไม่สำเร็จ");
    }
  };

  const onDelete = async (id: number) => {
    if (!confirm("ยืนยันการลบผู้ใช้นี้หรือไม่?")) return;
    try {
      await axios.delete(`/api/admin/users/${id}`);
      showOk("ลบผู้ใช้สำเร็จ");
      load();
    } catch (e: any) {
      showErr(e?.response?.data?.error || "ลบผู้ใช้ไม่สำเร็จ");
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SectionTitle
          title="จัดการผู้ใช้"
          desc="เพิ่ม แก้ไข ลบ และรีเซ็ตรหัสผ่านผู้ใช้งานระบบ"
        />
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              className="w-full rounded-xl border pl-9 pr-3 py-2 text-sm ring-2 ring-transparent focus:outline-none focus:ring-sky-200"
              placeholder="ค้นหา: ชื่อผู้ใช้ / บทบาท / หน่วยงาน"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="ค้นหาผู้ใช้"
            />
          </div>
          <button
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 text-sm shadow-sm"
          >
            <Plus className="h-4 w-4" />
            เพิ่มผู้ใช้
          </button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 text-sky-700 p-2 ring-1 ring-sky-200">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">จำนวนผู้ใช้ทั้งหมด</div>
              <div className="text-lg font-semibold">{rows.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-amber-50 text-amber-700 p-2 ring-1 ring-amber-200">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">บทบาทที่ใช้งาน</div>
              <div className="text-lg font-semibold">
                {Array.from(new Set(rows.map(r => r.role_code))).length} บทบาท
              </div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-emerald-50 text-emerald-700 p-2 ring-1 ring-emerald-200">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-xs text-slate-500">หน่วยงานที่ผูกผู้ใช้</div>
              <div className="text-lg font-semibold">
                {Array.from(new Set(rows.filter(r=>r.department_code).map(r=>r.department_code))).length} หน่วยงาน
              </div>
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
                <th className="p-3 text-left">ชื่อผู้ใช้</th>
                <th className="p-3 text-left">บทบาท</th>
                <th className="p-3 text-left">หน่วยงาน</th>
                <th className="p-3 text-right w-[280px]"></th>
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
                  <td className="p-3 text-slate-600">{idx + 1}</td>
                  <td className="p-3">
                    <div className="font-medium">{r.username}</div>
                    <div className="text-xs text-slate-500">
                      สร้างเมื่อ {new Date(r.created_at).toLocaleDateString("th-TH")}
                    </div>
                  </td>
                  <td className="p-3"><RoleBadge role={r.role_code} /></td>
                  <td className="p-3">
                    {r.department_code ? (
                      <span className="text-slate-800">
                        <b className="font-semibold">{r.department_code}</b>{" "}
                        <span className="text-slate-500">•</span>{" "}
                        <span className="text-slate-700">{r.department_name}</span>
                      </span>
                    ) : (
                      <span className="text-slate-400 italic">ไม่ผูกกับหน่วยงาน</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={() => onOpenEdit(r)}
                        aria-label={`แก้ไขผู้ใช้ ${r.username}`}
                        title="แก้ไข"
                      >
                        <Pencil className="h-4 w-4" />
                        แก้ไข
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border hover:bg-slate-50"
                        onClick={() => setResetOpen(r)}
                        aria-label={`รีเซ็ตรหัสผ่านผู้ใช้ ${r.username}`}
                        title="รีเซ็ตรหัสผ่าน"
                      >
                        <KeyRound className="h-4 w-4" />
                        รีเซ็ตรหัสผ่าน
                      </button>
                      <button
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700"
                        onClick={() => onDelete(r.id)}
                        aria-label={`ลบผู้ใช้ ${r.username}`}
                        title="ลบ"
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
                  <td className="p-8" colSpan={5}>
                    <div className="flex flex-col items-center justify-center text-center gap-2 text-slate-600">
                      <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                        <Users className="h-6 w-6 text-slate-400" />
                      </div>
                      <div className="font-medium">ไม่พบรายการผู้ใช้</div>
                      <p className="text-sm text-slate-500">
                        ลองปรับคำค้นหา หรือเพิ่มผู้ใช้ใหม่ด้วยปุ่ม “เพิ่มผู้ใช้”
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Create Modal */}
      <Modal open={createOpen} title="เพิ่มผู้ใช้ใหม่" onClose={() => setCreateOpen(false)}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <label className="text-sm">
              <span className="block mb-1 text-slate-700">ชื่อผู้ใช้ (Username)</span>
              <input
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="เช่น supaporn.p"
                value={cUsername}
                onChange={(e)=>setCUser(e.target.value)}
              />
            </label>
            <label className="text-sm">
              <span className="block mb-1 text-slate-700">รหัสผ่านเริ่มต้น</span>
              <input
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="กำหนดรหัสผ่าน"
                type="password"
                value={cPassword}
                onChange={(e)=>setCPw(e.target.value)}
              />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 text-slate-700">บทบาท</span>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={cRole}
                onChange={(e)=>setCRole(e.target.value as RoleCode)}
              >
                <option value="admin">{roleLabelTH.admin}</option>
                <option value="exec">{roleLabelTH.exec}</option>
                <option value="dept_head">{roleLabelTH.dept_head}</option>
                <option value="staff">{roleLabelTH.staff}</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="block mb-1 text-slate-700">ผูกกับหน่วยงาน (ถ้ามี)</span>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={String(cDepId)}
                onChange={(e)=>setCDep(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">(ไม่ผูกกับหน่วยงาน)</option>
                {deps.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={()=>setCreateOpen(false)}>ยกเลิก</button>
            <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={onCreate}>
              <UserPlus className="h-4 w-4" />
              บันทึกผู้ใช้
            </button>
          </div>
        </div>
      </Modal>

      {/* Edit Modal */}
      <Modal open={!!editOpen} title={`แก้ไขผู้ใช้: ${editOpen?.username || ""}`} onClose={()=>setEditOpen(null)}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-sm">
              <span className="block mb-1 text-slate-700">บทบาท</span>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={eRole}
                onChange={(e)=>setERole(e.target.value as RoleCode)}
              >
                <option value="admin">{roleLabelTH.admin}</option>
                <option value="exec">{roleLabelTH.exec}</option>
                <option value="dept_head">{roleLabelTH.dept_head}</option>
                <option value="staff">{roleLabelTH.staff}</option>
              </select>
            </label>

            <label className="text-sm">
              <span className="block mb-1 text-slate-700">หน่วยงานที่ผูก</span>
              <select
                className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-sky-200"
                value={String(eDepId)}
                onChange={(e)=>setEDep(e.target.value ? Number(e.target.value) : "")}
              >
                <option value="">(ไม่ผูกกับหน่วยงาน)</option>
                {deps.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.code} — {d.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={()=>setEditOpen(null)}>ยกเลิก</button>
            <button className="px-4 py-2 rounded-lg bg-sky-600 text-white hover:bg-sky-700" onClick={onEdit}>บันทึกการแก้ไข</button>
          </div>
        </div>
      </Modal>

      {/* Reset Password Modal */}
      <Modal open={!!resetOpen} title={`รีเซ็ตรหัสผ่าน: ${resetOpen?.username || ""}`} onClose={()=>setResetOpen(null)}>
        <div className="space-y-4">
          <label className="text-sm">
            <span className="block mb-1 text-slate-700">รหัสผ่านใหม่</span>
            <input
              className="w-full border rounded-lg p-2 focus:outline-none focus:ring-2 focus:ring-amber-200"
              placeholder="กำหนดรหัสผ่านใหม่"
              type="password"
              value={newPw}
              onChange={(e)=>setNewPw(e.target.value)}
            />
          </label>
          <p className="text-xs text-slate-500">
            คำแนะนำ: ใช้ตัวอักษรผสมตัวเลขอย่างน้อย 8 ตัวอักษรขึ้นไป
          </p>
          <div className="flex justify-end gap-2 pt-2">
            <button className="px-4 py-2 rounded-lg border" onClick={()=>setResetOpen(null)}>ยกเลิก</button>
            <button className="px-4 py-2 rounded-lg bg-amber-600 text-white hover:bg-amber-700" onClick={onResetPw}>ยืนยันการรีเซ็ต</button>
          </div>
        </div>
      </Modal>

      {toast && <Toast {...toast} />}
    </div>
  );
}
