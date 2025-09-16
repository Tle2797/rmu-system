export type Role = "admin" | "exec" | "dept_head" | "staff";
export type MenuItemData = { label: string; href: string; iconKey: string; badge?: number };

export function buildMenuData(role?: Role, departmentCode?: string): MenuItemData[] {
  const dept = departmentCode ?? "";
  switch (role) {
    case "admin":
      return [
        // { label: "ภาพรวมมหาวิทยาลัย", href: "/exec", iconKey: "layout" },
        // { label: "จัดอันดับ / Heatmap", href: "/exec/rank", iconKey: "grid" },
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
        { label: "แดชบอร์ดหน่วยงาน", href: `/dashboard/${dept}`, iconKey: "bar" },
        { label: "คอมเมนต์ / ภารกิจ", href: `/dashboard/${dept}/comments`, iconKey: "clipboard" },
      ];
    case "staff":
    default:
      return [
        { label: "งานวันนี้", href: `/dashboard/${dept}/today`, iconKey: "layout" },
        { label: "แดชบอร์ดหน่วยงาน", href: `/dashboard/${dept}`, iconKey: "bar" },
      ];
  }
}
