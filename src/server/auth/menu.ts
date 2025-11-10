// src/server/auth/menu.ts
export type Role = "admin" | "exec" | "dept_head" | "staff";
export type MenuItemData = { label: string; href: string; iconKey: string; badge?: number };

export function buildMenuData(role?: Role, departmentCode?: string): MenuItemData[] {
  const dept = departmentCode ?? "";
  switch (role) {
    case "admin":
      return [
        { label: "จัดการหน่วยงาน", href: "/admin/departments", iconKey: "building" },
        { label: "จัดการผู้ใช้", href: "/admin/users", iconKey: "users" },
        { label: "จัดการแบบสอบถาม", href: "/admin/questions", iconKey: "clipboard" },
      ];
    case "exec":
      return [
        { label: "ภาพรวมมหาวิทยาลัย", href: "/exec", iconKey: "layout" },
        { label: "จัดอันดับ / Heatmap", href: "/exec/rank", iconKey: "grid" },
      ];
    case "dept_head":
      return [
        { label: "แดชบอร์ดหน่วยงาน", href: `/dashboard/${dept}`, iconKey: "layout" },
        { label: "คอมเมนต์ / ภารกิจ", href: `/dashboard/${dept}/comments`, iconKey: "clipboard" },
        { label: "สรุปข้อมูลรายปี", href: `/dashboard/${dept}/yearly`, iconKey: "bar" }, // 👈 เพิ่ม
      ];
    case "staff":
    default:
      return [
        { label: "งานวันนี้", href: `/dashboard/${dept}/today`, iconKey: "layout" },
        { label: "แดชบอร์ดหน่วยงาน", href: `/dashboard/${dept}`, iconKey: "bar" },
        { label: "สรุปข้อมูลรายปี", href: `/dashboard/${dept}/yearly`, iconKey: "bar" }, // 👈 เพิ่ม
      ];
  }
}
