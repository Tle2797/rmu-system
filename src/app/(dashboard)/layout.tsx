import { cookies } from "next/headers";
import { verifyToken } from "@/server/auth/session";
import Sidebar from "@/components/layout/Sidebar";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // อ่าน token จาก cookie ฝั่ง server
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value || "";
  const user = verifyToken(token);

  // ถ้าเป็น staff/dept_head ต้องมี departmentCode
  const role = user?.role;
  const needDept = role === "staff" || role === "dept_head";
  const missingDept = needDept && !user?.departmentCode;

  return (
    <div className="h-[100svh] overflow-hidden lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar
        username={user?.username}
        role={user?.role}
        departmentCode={user?.departmentCode}
      />

      {/* ให้ฝั่งขวาเป็น "ตัวเลื่อนเดียว" ของหน้าหลังล็อกอิน */}
      <main className="bg-slate-50 h-[100svh] overflow-y-auto overflow-x-hidden">
        {missingDept ? (
          <div className="max-w-3xl mx-auto p-6">
            <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-4">
              บัญชีของคุณยังไม่ถูกผูกกับหน่วยงาน โปรดติดต่อผู้ดูแลระบบ
            </div>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
