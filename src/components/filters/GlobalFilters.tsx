"use client";

import { useEffect, useMemo, useState } from "react";
import {
  firstDayOfMonthISO,
  firstDayOfQuarterISO,
  todayISO,
  toThaiDisplay,
  daysAgoISO,
} from "@/server/utils/date";

export type Filters = {
  survey_id: number;
  from?: string; // "YYYY-MM-DD"
  to?: string;   // "YYYY-MM-DD"
  groups?: string[];        // ["นักศึกษา","บุคลากร","บุคคลทั่วไป"]
  departments?: string[];   // ["IT001","LIB001"]
  rating_min?: number;
  rating_max?: number;
};

type Props = {
  value: Filters;
  onChange: (f: Filters) => void;
};

const GROUPS = ["นักศึกษา", "บุคลากร", "บุคคลทั่วไป"] as const;

export default function GlobalFilters({ value, onChange }: Props) {
  // ฟอร์มชั่วคราว (Apply ครั้งเดียว) — groups เป็น read-only ใช้แสดงผล
  const [from, setFrom] = useState<string>(value.from || firstDayOfMonthISO());
  const [to, setTo] = useState<string>(value.to || todayISO());
  const [groups, setGroups] = useState<string[]>(value.groups ?? []);
  const [ratingMin, setRatingMin] = useState<number>(value.rating_min ?? 1);
  const [ratingMax, setRatingMax] = useState<number>(value.rating_max ?? 5);

  useEffect(() => {
    setFrom(value.from || firstDayOfMonthISO());
    setTo(value.to || todayISO());
    setGroups(value.groups ?? []);
    setRatingMin(value.rating_min ?? 1);
    setRatingMax(value.rating_max ?? 5);
  }, [value.from, value.to, value.groups, value.rating_min, value.rating_max]);

  // ปุ่มลัดช่วงเวลา
  const quickSet = (type: "7d" | "30d" | "90d" | "month" | "quarter" | "all") => {
    if (type === "7d")      { setFrom(daysAgoISO(7));  setTo(todayISO()); return; }
    if (type === "30d")     { setFrom(daysAgoISO(30)); setTo(todayISO()); return; }
    if (type === "90d")     { setFrom(daysAgoISO(90)); setTo(todayISO()); return; }
    if (type === "month")   { setFrom(firstDayOfMonthISO()); setTo(todayISO()); return; }
    if (type === "quarter") { setFrom(firstDayOfQuarterISO()); setTo(todayISO()); return; }
    if (type === "all")     { setFrom(""); setTo(""); return; }
  };

  // Apply/Reset (ไม่แตะต้อง groups)
  const apply = () => {
    onChange({
      ...value,
      from: from || undefined,
      to: to || undefined,
      rating_min: ratingMin,
      rating_max: ratingMax,
    });
  };
  const reset = () => {
    const _from = firstDayOfMonthISO();
    const _to = todayISO();
    setFrom(_from);
    setTo(_to);
    setRatingMin(1);
    setRatingMax(5);
    onChange({
      ...value,
      from: _from,
      to: _to,
      rating_min: 1,
      rating_max: 5,
    });
  };

  // แปลงวันที่โชว์
  const dateHint = useMemo(() => {
    const f = from ? toThaiDisplay(from) : "ทั้งหมด";
    const t = to ? toThaiDisplay(to) : "ทั้งหมด";
    return `${f} → ${t}`;
  }, [from, to]);

  // กลุ่มผู้ใช้ (read-only)
  const ALL_COUNT = GROUPS.length;
  const validSelected = useMemo(
    () => (groups?.length ? groups.filter((g) => (GROUPS as readonly string[]).includes(g)) : []),
    [groups]
  );
  const isAll = validSelected.length === 0; // ว่าง = ทั้งหมด
  const countText = isAll ? `ทั้งหมด • ${ALL_COUNT} กลุ่ม` : `${validSelected.length} กลุ่มที่เลือก`;
  const listText  = isAll ? GROUPS.join(", ") : validSelected.join(", ");
  const chips     = isAll ? GROUPS : (validSelected.length ? validSelected : GROUPS);

  return (
    <section className="rounded-2xl border border-sky-100 bg-white/80 shadow-sm ring-1 ring-white/50">
      {/* Header แผงฟิลเตอร์ */}
      <div className="flex items-center justify-between gap-3 border-b bg-gradient-to-r from-sky-50 to-white px-4 py-3 rounded-t-2xl">
        <div className="flex items-center gap-2 text-slate-700">
          <span className="inline-flex h-2 w-2 rounded-full bg-sky-500" />
          <span className="font-medium">ตัวกรองข้อมูล</span>
        </div>
      </div>

      {/* เนื้อหา */}
      <div className="grid grid-cols-1 gap-6 p-4 md:grid-cols-2">
        {/* ซ้าย: วันที่ + ปุ่มลัด */}
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ตั้งแต่วันที่</label>
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full rounded-lg border border-sky-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-sky-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">รูปแบบ: {toThaiDisplay(from || "")}</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">ถึงวันที่</label>
              <input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                className="w-full rounded-lg border border-sky-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-sky-500"
              />
              <p className="mt-1 text-[11px] text-slate-500">รูปแบบ: {toThaiDisplay(to || "")}</p>
            </div>
          </div>

          {/* ปุ่มลัดแบบ segmented */}
          <div className="flex flex-wrap items-center gap-1 rounded-xl border border-sky-200 bg-white p-1">
            {[
              { k: "7d", label: "7 วัน" },
              { k: "30d", label: "30 วัน" },
              { k: "90d", label: "90 วัน" },
              { k: "month", label: "เดือนนี้" },
              { k: "quarter", label: "ไตรมาสนี้" },
              { k: "all", label: "ทั้งหมด" },
            ].map((b) => (
              <button
                key={b.k}
                onClick={() => quickSet(b.k as any)}
                className="rounded-lg px-3 py-1.5 text-xs text-slate-700 hover:bg-sky-50"
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* ขวา: กลุ่มผู้ใช้ (read-only) + ช่วงคะแนน + ปุ่ม */}
        <div className="space-y-4">
          {/* กลุ่มผู้ใช้ */}
          <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-sky-500" />
              <span className="text-sm font-medium text-slate-700">กลุ่มผู้ใช้</span>
            </div>

            {/* จำนวนกลุ่ม */}
            <div className="inline-flex items-center gap-2 rounded-lg border border-sky-200 bg-white px-2.5 py-1 text-xs font-medium text-sky-700">
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
              {countText}
            </div>

            {/* รายการชื่อ + badge */}
            <div className="mt-2 text-[12px] text-slate-600">
              รายการ: <span className="font-medium">{listText}</span>
            </div>
            <div className="mt-1.5 flex max-h-16 flex-wrap gap-1.5 overflow-auto pr-1">
              {chips.map((g) => (
                <span
                  key={g}
                  className="inline-flex items-center rounded-full bg-white px-2.5 py-0.5 text-[11px] font-medium text-sky-700 ring-1 ring-sky-200"
                >
                  {g}
                </span>
              ))}
            </div>
          </div>

          {/* ช่วงคะแนน */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">คะแนนขั้นต่ำ</label>
              <input
                type="number"
                min={1}
                max={5}
                value={ratingMin}
                onChange={(e) =>
                  setRatingMin(Math.max(1, Math.min(5, Number(e.target.value) || 1)))
                }
                className="w-full rounded-lg border border-sky-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">คะแนนสูงสุด</label>
              <input
                type="number"
                min={1}
                max={5}
                value={ratingMax}
                onChange={(e) =>
                  setRatingMax(Math.max(1, Math.min(5, Number(e.target.value) || 5)))
                }
                className="w-full rounded-lg border border-sky-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-sky-500"
              />
            </div>
          </div>

          {/* ปุ่มคำสั่ง */}
          <div className="flex justify-end gap-2">
            <button
              onClick={reset}
              className="rounded-lg border border-sky-200 px-4 py-2 text-sm text-slate-700 hover:bg-sky-50"
            >
              รีเซ็ต
            </button>
            <button
              onClick={apply}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-sky-700"
            >
              ใช้ฟิลเตอร์
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
