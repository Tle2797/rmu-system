"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";

type Role = "admin" | "exec" | "dept_head" | "staff";

// ✅ Helper แปลง string → Role
function asRole(v: string | undefined): Role | undefined {
  if (v === "admin" || v === "exec" || v === "dept_head" || v === "staff") return v;
  return undefined;
}

// ✅ ฟังก์ชันเลือกหน้า default ตาม role
function resolveHome(
  profile:
    | { role?: Role; departmentCode?: string | null }
    | undefined
    | null,
  nextFromQuery?: string | null
) {
  if (nextFromQuery) return nextFromQuery || "";
  const role = profile?.role;
  const dept = profile?.departmentCode || "";

  if (role === "admin") return "/admin/users";
  if (role === "exec") return "/exec";
  if (role === "dept_head" || role === "staff") {
    return dept ? `/dashboard/${dept}` : "/dashboard";
  }
  return ""; // ❌ อย่า fallback ไป /exec
}

export default function LoginPage() {
  const [username, setU] = useState("");
  const [password, setP] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");

  // ----------------- เช็คว่าล็อกอินอยู่แล้วหรือไม่ -----------------
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await axios.get("/api/auth/me", { withCredentials: true });
        if (!active) return;

        const raw = res.data ?? null;
        const tmp = raw?.profile ?? raw;

        const profile = {
          role: asRole(tmp?.role),
          departmentCode: tmp?.departmentCode ?? null,
        };

        if (!profile.role) return; // ยังไม่ล็อกอิน → อยู่หน้าเดิม
        const dest = resolveHome(profile, next);
        if (dest) router.replace(dest);
      } catch {
        // 401 → ไม่ล็อกอิน
      }
    })();
    return () => {
      active = false;
    };
  }, [next, router]);

  // ----------------- ส่งฟอร์ม -----------------
  const onSubmit = async () => {
    if (!username || !password) {
      setErr("กรุณากรอกชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน");
      return;
    }
    setErr("");
    setLoading(true);
    try {
      await axios.post("/api/auth/login", { username, password }, { withCredentials: true });

      const meRes = await axios.get("/api/auth/me", { withCredentials: true });
      const tmp = meRes.data?.profile ?? meRes.data ?? {};

      const profile = {
        role: asRole(tmp?.role),
        departmentCode: tmp?.departmentCode ?? null,
      };

      const dest = resolveHome(profile, next);
      router.replace(dest || "/exec");
    } catch (e: any) {
      setErr(e?.response?.data?.error || "เข้าสู่ระบบไม่สำเร็จ");
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown: React.KeyboardEventHandler<HTMLInputElement> = (e) => {
    if (e.key === "Enter") onSubmit();
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-blue-200 via-blue-100 to-blue-50">
      <div className="relative grid min-h-screen place-items-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl rounded-2xl border border-blue-200 bg-white shadow-lg sm:shadow-xl backdrop-blur-md">
          {/* Header */}
          <div className="flex flex-col items-center gap-5 border-b border-blue-100 px-8 py-8 text-center bg-gradient-to-r from-blue-50 to-white rounded-t-2xl">
            <div className="relative h-24 w-24 overflow-hidden">
              <Image src="/logos/rmu.png" alt="University Logo" fill className="object-contain" priority />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-blue-800">
                ระบบประเมินความพึงพอใจ
              </h1>
              <p className="mt-2 text-xs sm:text-sm text-slate-600">
                กรุณาลงชื่อเข้าใช้งานเพื่อจัดการแดชบอร์ดและรายงาน
              </p>
            </div>
          </div>

          {/* Form */}
          <div className="px-6 py-8 sm:px-8 sm:py-10 space-y-6">
            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">ชื่อผู้ใช้</label>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm sm:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  placeholder="username"
                  value={username}
                  onChange={(e) => setU(e.target.value)}
                  onKeyDown={onKeyDown}
                  autoComplete="username"
                  aria-label="ชื่อผู้ใช้"
                />
              </div>
            </div>

            <div>
              <label className="mb-2 block text-sm font-semibold text-slate-700">รหัสผ่าน</label>
              <div className="relative">
                <input
                  className="w-full rounded-xl border border-slate-300 bg-slate-50 px-4 py-3 pr-12 text-sm sm:text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setP(e.target.value)}
                  onKeyDown={onKeyDown}
                  autoComplete="current-password"
                  aria-label="รหัสผ่าน"
                />
              </div>
            </div>

            {err && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm sm:text-base text-red-700 shadow-sm">
                {err}
              </div>
            )}

            <button
              onClick={onSubmit}
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-blue-600 to-blue-800 px-5 py-3 text-sm sm:text-base font-semibold text-white shadow-md focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading ? "กำลังเข้าสู่ระบบ…" : "เข้าสู่ระบบ"}
            </button>

            <p className="text-center text-xs sm:text-sm text-slate-500">
              หากมีปัญหาในการเข้าสู่ระบบ กรุณาติดต่อผู้ดูแลระบบ
            </p>
          </div>
        </div>

        <p className="mt-8 text-center text-[11px] sm:text-xs md:text-sm text-gray-600">
          © {new Date().getFullYear()} RMU Satisfaction System
        </p>
      </div>
    </div>
  );
}
