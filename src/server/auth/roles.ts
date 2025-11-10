// src/server/auth/roles.ts
import type { JwtPayload } from "./session";

export const allowRoles = (...roles: JwtPayload["role"][]) =>
  (user?: JwtPayload | null) => !!user && roles.includes(user.role);

export const menuForRole = (user?: JwtPayload | null) => {
  const dept = user?.departmentCode ?? "";
  const map = {
    admin: [
      { label: "ภาพรวมมหาวิทยาลัย", href: "/exec" },
      { label: "จัดอันดับ/Heatmap", href: "/exec/rank" },
      { label: "จัดการหน่วยงาน", href: "/admin/departments" },
      { label: "จัดการผู้ใช้", href: "/admin/users" },
      { label: "จัดการแบบสอบถาม", href: "/admin/questions" },
    ],
    exec: [
      { label: "ภาพรวมมหาวิทยาลัย", href: "/exec" },
      { label: "จัดอันดับ/Heatmap", href: "/exec/rank" },
    ],
    dept_head: [
      { label: "แดชบอร์ดหน่วยงาน", href: `/dashboard/${dept}` },
      { label: "คอมเมนต์/ภารกิจ", href: `/dashboard/${dept}/comments` },
      { label: "สรุปข้อมูลรายปี", href: `/dashboard/${dept}/yearly` }, // 👈 เพิ่ม
    ],
    staff: [
      { label: "งานวันนี้", href: `/dashboard/${dept}/today` },
      { label: "แดชบอร์ดหน่วยงาน", href: `/dashboard/${dept}` },
      { label: "สรุปข้อมูลรายปี", href: `/dashboard/${dept}/yearly` }, // 👈 เพิ่ม
    ],
  } as const;
  return map[user?.role || "staff"];
};
