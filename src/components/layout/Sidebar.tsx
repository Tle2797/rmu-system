"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import Swal from "sweetalert2";
import {
  LayoutDashboard,
  BarChart3,
  Grid,
  Users2,
  Building2,
  ClipboardList,
  LogOut,
  FileText,
  Settings,
  Menu,
  QrCode,
} from "lucide-react";
import type { MenuItemData, Role } from "@/server/auth/menu";

type Props = {
  username?: string;
  role?: Role;
  departmentCode?: string;
  items?: MenuItemData[];
};

type LocalItem = MenuItemData & { match?: "exact" | "prefix" };

const Icon = ({ k, className }: { k: string; className?: string }) => {
  switch (k) {
    case "layout": return <LayoutDashboard className={className} />;
    case "bar": return <BarChart3 className={className} />;
    case "grid": return <Grid className={className} />;
    case "users": return <Users2 className={className} />;
    case "building": return <Building2 className={className} />;
    case "clipboard": return <ClipboardList className={className} />;
    case "qr": return <QrCode className={className} />;
    default: return <LayoutDashboard className={className} />;
  }
};

const useIsActive = (pathname: string) => {
  return (href: string, match: "exact" | "prefix" = "exact") =>
    match === "prefix" ? pathname === href || pathname.startsWith(href + "/") : pathname === href;
};

export default function Sidebar({ username, role, departmentCode, items }: Props) {
  const pathname = usePathname();
  const isActive = useIsActive(pathname);
  const [open, setOpen] = useState(false);
  const router = useRouter();

  // ✅ ปิดสกอร์บาร์ด้านใน “เฉพาะหน้า /survey”
  const isQRPage = pathname === "/survey" || pathname.startsWith("/survey/");

  useEffect(() => {
    if (open) document.body.classList.add("overflow-hidden");
    else document.body.classList.remove("overflow-hidden");
    return () => document.body.classList.remove("overflow-hidden");
  }, [open]);

  const roleTH = useMemo(() => {
    switch (role) {
      case "admin": return "ผู้ดูแลระบบ";
      case "exec": return "ผู้บริหารมหาวิทยาลัย";
      case "dept_head": return "ผู้บริหารหน่วยงาน";
      case "staff": return "เจ้าหน้าที่";
      default: return "-";
    }
  }, [role]);

  const computedItems: LocalItem[] = useMemo(() => {
    if (items && items.length) return items as LocalItem[];
    const deptRoot = `/dashboard/${departmentCode ?? ""}`;
    switch (role) {
      case "exec":
        return [
          { label: "ภาพรวมมหาวิทยาลัย", href: "/exec", iconKey: "layout", match: "exact" },
          { label: "จัดอันดับ/Heatmap", href: "/exec/rank", iconKey: "bar", match: "exact" },
          { label: "QR Code", href: "/exec/qr-exec", iconKey: "qr", match: "exact" },
        ];
      case "dept_head":
        return [
          { label: "แดชบอร์ดหน่วยงาน", href: deptRoot, iconKey: "layout", match: "exact" },
          { label: "ความคิดเห็น", href: `${deptRoot}/comments`, iconKey: "clipboard", match: "prefix" },
          { label: "คิวอาโค้ด", href: `${deptRoot}/qr-depart`, iconKey: "qr", match: "prefix" },
        ];
      case "admin":
        return [
          { label: "จัดการผู้ใช้", href: "/admin/users", iconKey: "users", match: "exact" },
          { label: "จัดการหน่วยงาน", href: "/admin/departments", iconKey: "building", match: "exact" },
          { label: "จัดการแบบสอบถาม", href: "/admin/questions", iconKey: "grid", match: "exact" },
          { label: "คิวอาโค้ด", href: "/admin/qr-admin", iconKey: "qr", match: "exact" },
        ];
      default:
        return [
          { label: "แดชบอร์ดหน่วยงาน", href: deptRoot, iconKey: "layout", match: "exact" },
          { label: "ความคิดเห็น", href: `${deptRoot}/comments`, iconKey: "clipboard", match: "prefix" },
          { label: "คิวอาโค้ด", href: `${deptRoot}/qr-depart`, iconKey: "qr", match: "prefix" },
        ];
    }
  }, [items, role, departmentCode]);

  const onLogout = async () => {
    const res = await Swal.fire({
      title: "ออกจากระบบ",
      text: "คุณต้องการออกจากระบบหรือไม่?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "ออกจากระบบ",
      cancelButtonText: "ยกเลิก",
      reverseButtons: true,
      confirmButtonColor: "#dc2626",
      cancelButtonColor: "#6b7280",
    });
    if (!res.isConfirmed) return;
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.replace("/login"); }
  };

  return (
    <>
      {/* Topbar (mobile) */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between bg-white/95 backdrop-blur px-4 py-3 border-b">
        <div className="font-semibold">RMU Satisfaction</div>
        <button onClick={() => setOpen(!open)} className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 hover:bg-slate-50">
          <Menu className="h-5 w-5" /> เมนู
        </button>
      </div>

      {open && <div className="fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}

      {/* Sidebar */}
      <aside
        className={[
          "fixed inset-y-0 left-0 z-50 w-[280px]",
          "lg:sticky lg:top-0 lg:inset-auto lg:z-auto",
          "h-screen shrink-0",
          "bg-gradient-to-b from-sky-600 via-sky-700 to-blue-800",
          "overflow-hidden", // ไม่ให้ aside เลื่อนเอง
          "relative border-r border-white/10",
          "transition-transform duration-200",
          open ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        ].join(" ")}
      >
        <div className="h-full flex flex-col">
          {/* Branding */}
          <div className="relative px-5 pt-5 pb-4 border-b border-white/15 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl grid place-items-center">
                <Image src="/logos/rmu.png" alt="มหาวิทยาลัย" width={28} height={28} className="object-contain" />
              </div>
              <div>
                <div className="font-semibold text-white">RMU Satisfaction</div>
                <div className="text-[11px] text-sky-100/90">ระบบประเมินความพึงพอใจ</div>
              </div>
            </div>
          </div>

          {/* Profile */}
          <div className="relative px-5 py-4 border-b border-white/15 shrink-0">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur-md ring-1 ring-white/10 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-white/20 flex items-center justify-center">
                  <span className="text-white font-semibold">{username ? username[0].toUpperCase() : "?"}</span>
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{username || "Guest"}</div>
                  <div className="text-[12px] text-sky-100/80">{roleTH}</div>
                </div>
              </div>
              {departmentCode && (
                <div className="mt-3 text-[12px] px-3 py-1.5 rounded-lg bg-white/10 text-sky-50/90">
                  หน่วยงาน: <span className="font-medium text-white">{departmentCode}</span>
                </div>
              )}
            </div>
          </div>

          {/* Navigation */}
          <nav
            className={[
              "relative p-2 space-y-1 flex-1",
              // ✅ ถ้าเป็นหน้า /survey ปิดการเลื่อนใน nav ไปเลย -> ไม่มีสกอร์บาร์ด้านใน
              isQRPage
                ? "overflow-hidden"
                : "overflow-y-auto overscroll-contain pr-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-28",
            ].join(" ")}
          >
            {computedItems.map((m) => {
              const active = isActive(m.href, m.match ?? "exact");
              return (
                <Link
                  key={m.href}
                  href={m.href}
                  onClick={() => setOpen(false)}
                  className={[
                    "group flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px]",
                    active ? "bg-white text-sky-900 shadow-sm" : "text-sky-50/95 hover:bg-white/10 hover:text-white",
                  ].join(" ")}
                >
                  <Icon k={m.iconKey} className={active ? "text-sky-700 h-5 w-5" : "text-sky-100/80 h-5 w-5"} />
                  <span className="truncate">{m.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Bottom Utilities (ตรึงก้น) */}
          <div className="absolute bottom-0 left-0 right-0 px-2 py-3 space-y-1 border-t border-white/15 bg-gradient-to-t from-blue-900/70 via-blue-900/40 to-transparent backdrop-blur">
            <Link href="/docs" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-sky-50/95 hover:bg-white/10 hover:text-white">
              <FileText className="h-4 w-4" /> เอกสาร/วิธีใช้งาน
            </Link>
            <Link href="/settings" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-sky-50/95 hover:bg-white/10 hover:text-white">
              <Settings className="h-4 w-4" /> ตั้งค่า
            </Link>
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm bg-rose-500 text-white hover:bg-rose-600">
              <LogOut className="h-4 w-4" /> ออกจากระบบ
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
