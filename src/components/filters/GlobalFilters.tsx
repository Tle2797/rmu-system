"use client";

import { useEffect, useMemo, useState } from "react";
import { firstDayOfMonthISO, firstDayOfQuarterISO, todayISO, toThaiDisplay, daysAgoISO } from "@/server/utils/date";

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
  // เก็บ state ชั่วคราวของฟอร์ม (เพื่อกด Apply ทีเดียว)
  const [from, setFrom] = useState<string>(value.from || firstDayOfMonthISO());
  const [to, setTo] = useState<string>(value.to || todayISO());
  const [groups, setGroups] = useState<string[]>(value.groups ?? []);
  const [ratingMin, setRatingMin] = useState<number>(value.rating_min ?? 1);
  const [ratingMax, setRatingMax] = useState<number>(value.rating_max ?? 5);

  // เมื่อ parent เปลี่ยนค่า filters (เช่น reset จากภายนอก) → sync กลับมา
  useEffect(() => {
    setFrom(value.from || firstDayOfMonthISO());
    setTo(value.to || todayISO());
    setGroups(value.groups ?? []);
    setRatingMin(value.rating_min ?? 1);
    setRatingMax(value.rating_max ?? 5);
  }, [value.from, value.to, value.groups, value.rating_min, value.rating_max]);

  // ปุ่มลัดช่วงเวลา
  const quickSet = (type: "7d" | "30d" | "90d" | "month" | "quarter" | "all") => {
    if (type === "7d")   { setFrom(daysAgoISO(7));  setTo(todayISO()); return; }
    if (type === "30d")  { setFrom(daysAgoISO(30)); setTo(todayISO()); return; }
    if (type === "90d")  { setFrom(daysAgoISO(90)); setTo(todayISO()); return; }
    if (type === "month"){ setFrom(firstDayOfMonthISO()); setTo(todayISO()); return; }
    if (type === "quarter"){ setFrom(firstDayOfQuarterISO()); setTo(todayISO()); return; }
    if (type === "all")  { setFrom(""); setTo(""); return; } // all = ไม่ส่ง from/to ให้ API
  };

  // กด Apply → ส่งค่าให้ parent
  const apply = () => {
    onChange({
      ...value,
      from: from || undefined,
      to: to || undefined,
      groups: groups.length ? groups : undefined,
      rating_min: ratingMin,
      rating_max: ratingMax
    });
  };

  const reset = () => {
    setFrom(firstDayOfMonthISO());
    setTo(todayISO());
    setGroups([]);
    setRatingMin(1);
    setRatingMax(5);
    onChange({
      ...value,
      from: firstDayOfMonthISO(),
      to: todayISO(),
      groups: undefined,
      rating_min: 1,
      rating_max: 5
    });
  };

  // ตรวจสอบค่าช่วงวันที่
  const dateHint = useMemo(() => {
    const f = from ? toThaiDisplay(from) : "ทั้งหมด";
    const t = to ? toThaiDisplay(to) : "ทั้งหมด";
    return `${f} → ${t}`;
  }, [from, to]);

  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        {/* ซ้าย: ช่วงวันที่ + ปุ่มลัด */}
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">ตั้งแต่วันที่</label>
              {/* input type=date จะมีปฏิทินให้เลือก */}
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
              <p className="text-[11px] text-slate-500 mt-1">รูปแบบ: {toThaiDisplay(from || "")}</p>
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">ถึงวันที่</label>
              <input
                type="date"
                className="w-full border rounded-lg px-3 py-2"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                min={from || undefined}
              />
              <p className="text-[11px] text-slate-500 mt-1">รูปแบบ: {toThaiDisplay(to || "")}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={() => quickSet("7d")} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm">7 วัน</button>
            <button onClick={() => quickSet("30d")} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm">30 วัน</button>
            <button onClick={() => quickSet("90d")} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm">90 วัน</button>
            <button onClick={() => quickSet("month")} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm">เดือนนี้</button>
            <button onClick={() => quickSet("quarter")} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm">ไตรมาสนี้</button>
            <button onClick={() => quickSet("all")} className="px-3 py-1.5 rounded-lg border hover:bg-slate-50 text-sm">ทั้งหมด</button>
          </div>
        </div>

        {/* ขวา: กลุ่มผู้ใช้ + ช่วงคะแนน + ปุ่ม */}
        <div className="space-y-3">
          {/* กลุ่มผู้ใช้ (multi-select แบบง่ายด้วย checkbox) */}
          <div>
            <label className="block text-sm text-slate-600 mb-1">กลุ่มผู้ใช้</label>
            <div className="flex flex-wrap gap-3">
              {GROUPS.map(g => {
                const checked = groups.includes(g);
                return (
                  <label key={g} className="inline-flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={checked}
                      onChange={(e) => {
                        setGroups(prev => e.target.checked ? [...prev, g] : prev.filter(x => x !== g));
                      }}
                    />
                    {g}
                  </label>
                );
              })}
            </div>
          </div>

          {/* ช่วงคะแนน 1..5 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-slate-600 mb-1">คะแนนขั้นต่ำ</label>
              <input
                type="number"
                min={1} max={5}
                className="w-full border rounded-lg px-3 py-2"
                value={ratingMin}
                onChange={(e) => setRatingMin(Math.max(1, Math.min(5, Number(e.target.value) || 1)))}
              />
            </div>
            <div>
              <label className="block text-sm text-slate-600 mb-1">คะแนนสูงสุด</label>
              <input
                type="number"
                min={1} max={5}
                className="w-full border rounded-lg px-3 py-2"
                value={ratingMax}
                onChange={(e) => setRatingMax(Math.max(1, Math.min(5, Number(e.target.value) || 5)))}
              />
            </div>
          </div>

          {/* ปุ่ม */}
          <div className="flex gap-2 justify-end">
            <button onClick={reset} className="px-4 py-2 rounded-lg border hover:bg-slate-50 text-sm">รีเซ็ต</button>
            <button onClick={apply} className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm">ใช้ฟิลเตอร์</button>
          </div>
        </div>
      </div>

      {/* แถบสรุปช่วงที่เลือก (อ่านง่าย) */}
      <div className="mt-3 text-xs text-slate-500">
        ช่วงที่เลือก: <span className="font-medium">{dateHint}</span>
        {groups.length ? <> • กลุ่ม: <span className="font-medium">{groups.join(", ")}</span></> : null}
        {(ratingMin !== 1 || ratingMax !== 5) ? <> • ช่วงคะแนน: <span className="font-medium">{ratingMin}–{ratingMax}</span></> : null}
      </div>
    </div>
  );
}
