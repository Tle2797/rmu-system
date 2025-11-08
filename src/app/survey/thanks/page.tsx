/* src/app/survey/thanks/page.tsx */
"use client";

import { useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";

export default function SurveyThanksPage() {
  const sp = useSearchParams();
  const dept = sp.get("dept") || "";
  const surveyId = sp.get("survey") || "";

  // กันผู้ใช้ back แล้วกดส่งซ้ำ (เลือกใช้ได้)
  useEffect(() => {
    if (window.history?.replaceState) {
      window.history.replaceState(null, "", window.location.href);
    }
  }, []);

  const deptLabel = useMemo(() => (dept ? String(dept) : "หน่วยงานของคุณ"), [dept]);

  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-sky-50 via-white to-slate-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-sky-100 bg-white shadow-sm ring-1 ring-white/50 overflow-hidden">
          {/* Header */}
          <div className="p-6 sm:p-8 text-center">
            <div
              className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-700"
              aria-hidden
            >
              {/* Check icon */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            {/* หัวเรื่อง: ส่งเรียบร้อย */}
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 leading-snug">
              ส่งแบบประเมินเรียบร้อยแล้ว
            </h1>

            {/* หมายเหตุสั้น ๆ รองรับหน้าจอโทรศัพท์ */}
            <p className="mt-4 text-[12px] sm:text-[13px] text-slate-500 leading-relaxed break-words">
              หากต้องการแก้ไขคำตอบ โปรดติดต่อผู้ดูแลแบบประเมินของหน่วยงาน
            </p>
          </div>

          {/* เส้นคั่นล่างอ่อน ๆ */}
          <div className="h-px w-full bg-gradient-to-r from-sky-100 via-transparent to-sky-100" />

          {/* แถบด้านล่าง (ไม่มีปุ่ม) */}
          <div className="px-6 py-3 text-center text-[11px] sm:text-[12px] text-slate-500 bg-sky-50/60">
            ปิดหน้านี้ได้ทันที — ระบบบันทึกข้อมูลเรียบร้อยแล้ว
          </div>
        </div>
      </div>
    </div>
  );
}
