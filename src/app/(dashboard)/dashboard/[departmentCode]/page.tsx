"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import axios from "axios";

/* ============================
   ประเภทข้อมูลสำหรับหน้าแดชบอร์ด
   ============================ */
type แถวสรุปคำถาม = {
  question_id: number;
  question_text: string;
  question_type: "rating" | "text";
  avg_rating: number | null;
  answers_count: number;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  r5: number | null;
};

type รายการคอมเมนต์ = {
  comment: string;
  question_id: number;
  question_text: string;
  user_group: string;
  created_at: string;
};

// ใช้ survey กลางหมายเลข 1
const SURVEY_ID = 1;

export default function หน้าแดชบอร์ดหน่วยงาน() {
  const { departmentCode } = useParams() as { departmentCode: string };
  const search = useSearchParams();

  // 🗓️ ช่วงวันที่ (เว้นว่างได้)
  const [ตั้งแต่วันที่, setตั้งแต่วันที่] = useState(search.get("from") || "");
  const [ถึงวันที่, setถึงวันที่] = useState(search.get("to") || "");

  const [สรุป, setสรุป] = useState<{ department_name?: string; items: แถวสรุปคำถาม[] }>({ items: [] });
  const [คอมเมนต์, setคอมเมนต์] = useState<รายการคอมเมนต์[]>([]);
  const [กำลังโหลด, setกำลังโหลด] = useState(true);
  const [ข้อผิดพลาด, setข้อผิดพลาด] = useState("");

  // ✅ สถานะควบคุมการแสดงคอมเมนต์: เริ่มต้นแสดงแค่ 3 ความคิดเห็น
  const [แสดงคอมเมนต์ทั้งหมด, setแสดงคอมเมนต์ทั้งหมด] = useState(false);

  // 📥 โหลดข้อมูลสรุป + คอมเมนต์จาก API
  const โหลดข้อมูล = async () => {
    try {
      setกำลังโหลด(true);
      const [sumRes, comRes] = await Promise.all([
        axios.get(`/api/departments/${departmentCode}/summary`, {
          params: {
            survey_id: SURVEY_ID,
            from: ตั้งแต่วันที่ || undefined,
            to: ถึงวันที่ || undefined,
          },
        }),
        axios.get(`/api/departments/${departmentCode}/comments`, {
          params: {
            survey_id: SURVEY_ID,
            from: ตั้งแต่วันที่ || undefined,
            to: ถึงวันที่ || undefined,
            limit: 50,
            offset: 0,
          },
        }),
      ]);
      setสรุป(sumRes.data || { items: [] });
      setคอมเมนต์(comRes.data?.items || []);
      setข้อผิดพลาด("");
      setแสดงคอมเมนต์ทั้งหมด(false); // รีเซ็ตกลับเป็นย่อเมื่อกดแสดงข้อมูลใหม่
    } catch (e: any) {
      setข้อผิดพลาด(e?.response?.data?.error || "ไม่สามารถโหลดข้อมูลได้");
    } finally {
      setกำลังโหลด(false);
    }
  };

  // โหลดครั้งแรกเมื่อรู้ departmentCode
  useEffect(() => {
    if (departmentCode) โหลดข้อมูล();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentCode]);

  // เมื่อผู้ใช้กดปุ่ม "แสดงข้อมูล" หลังเลือกช่วงวันที่
  const กดแสดงข้อมูล = () => {
    โหลดข้อมูล();
  };

  // 🧮 คำนวณ KPI จากผลรวมทุกคำถาม
  const kpi = useMemo(() => {
    const rows = สรุป.items || [];
    let จำนวนคำตอบรวม = 0,
      ผลรวมคะแนนถ่วงน้ำหนัก = 0;
    let r1 = 0,
      r2 = 0,
      r3 = 0,
      r4 = 0,
      r5 = 0;

    rows.forEach((it) => {
      const c1 = Number(it.r1 || 0),
        c2 = Number(it.r2 || 0),
        c3 = Number(it.r3 || 0),
        c4 = Number(it.r4 || 0),
        c5 = Number(it.r5 || 0);
      const รวมข้อนี้ = c1 + c2 + c3 + c4 + c5;

      จำนวนคำตอบรวม += รวมข้อนี้;
      ผลรวมคะแนนถ่วงน้ำหนัก += 1 * c1 + 2 * c2 + 3 * c3 + 4 * c4 + 5 * c5;

      r1 += c1;
      r2 += c2;
      r3 += c3;
      r4 += c4;
      r5 += c5;
    });

    const ค่าเฉลี่ยรวม = จำนวนคำตอบรวม ? ผลรวมคะแนนถ่วงน้ำหนัก / จำนวนคำตอบรวม : null;
    const สัดส่วนคะแนนสูง = จำนวนคำตอบรวม ? (r4 + r5) / จำนวนคำตอบรวม : 0;
    const สัดส่วนคะแนนต่ำ = จำนวนคำตอบรวม ? (r1 + r2) / จำนวนคำตอบรวม : 0;

    return { ค่าเฉลี่ยรวม, จำนวนคำตอบรวม, สัดส่วนคะแนนสูง, สัดส่วนคะแนนต่ำ };
  }, [สรุป]);

  // 🔽 ลิงก์ดาวน์โหลดไฟล์รายงาน
  const excelUrl =
    `/api/departments/${departmentCode}/export.xlsx?survey_id=${SURVEY_ID}` +
    (ตั้งแต่วันที่ ? `&from=${encodeURIComponent(ตั้งแต่วันที่)}` : "") +
    (ถึงวันที่ ? `&to=${encodeURIComponent(ถึงวันที่)}` : "");

  const pdfUrl =
    `/api/departments/${departmentCode}/export.pdf?survey_id=${SURVEY_ID}` +
    (ตั้งแต่วันที่ ? `&from=${encodeURIComponent(ตั้งแต่วันที่)}` : "") +
    (ถึงวันที่ ? `&to=${encodeURIComponent(ถึงวันที่)}` : "");

  // ✅ เลือกรายการคอมเมนต์ที่จะโชว์: 3 รายการแรก หรือทั้งหมด
  const คอมเมนต์ที่จะแสดง = useMemo(
    () => (แสดงคอมเมนต์ทั้งหมด ? คอมเมนต์ : คอมเมนต์.slice(0, 3)),
    [แสดงคอมเมนต์ทั้งหมด, คอมเมนต์]
  );

  // จำนวนคอมเมนต์ที่ยังไม่ได้แสดง (ไว้โชว์ในปุ่ม)
  const เหลืออีกกี่รายการ = Math.max(คอมเมนต์.length - 3, 0);

  // 🔧 helpers
  const fmt = (n: number | null | undefined, d = 0) =>
    n === null || n === undefined ? "-" : Number(n).toLocaleString(undefined, { maximumFractionDigits: d });

  const pct = (v: number) => `${(v * 100).toFixed(1)}%`;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-800">
            แดชบอร์ดหน่วยงาน
          </h1>
          <p className="text-slate-500">
            {สรุป.department_name ? (
              <>
                หน่วยงาน: <span className="font-semibold text-slate-700">{สรุป.department_name}</span>{" "}
                <span className="rounded-full bg-sky-50 text-sky-700 text-[11px] px-2 py-0.5 border border-sky-200 ml-1">
                  {departmentCode}
                </span>
              </>
            ) : (
              <span className="rounded-full bg-sky-50 text-sky-700 text-[11px] px-2 py-0.5 border border-sky-200">
                {departmentCode}
              </span>
            )}
          </p>
        </div>

        {/* ปุ่มดาวน์โหลด */}
        <div className="flex gap-2">
          <a
            href={excelUrl}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 shadow-sm transition"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-white/90" />
            ดาวน์โหลด Excel
          </a>
          <a
            href={pdfUrl}
            target="_blank"
            className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 shadow-sm transition"
          >
            <span className="inline-block h-2 w-2 rounded-full bg-white/90" />
            ดาวน์โหลด PDF
          </a>
        </div>
      </div>

      {/* ฟิลเตอร์วันที่ */}
      <div className="mt-5 rounded-2xl border bg-white/60 backdrop-blur p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto_auto] sm:items-end">
          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">ตั้งแต่วันที่</label>
            <input
              type="date"
              className="rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
              value={ตั้งแต่วันที่}
              onChange={(e) => setตั้งแต่วันที่(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <div className="flex flex-col">
            <label className="text-sm text-slate-600 mb-1">ถึงวันที่</label>
            <input
              type="date"
              className="rounded-lg border p-2 focus:outline-none focus:ring-2 focus:ring-sky-300"
              value={ถึงวันที่}
              onChange={(e) => setถึงวันที่(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <button
            onClick={กดแสดงข้อมูล}
            className="h-[42px] rounded-xl bg-sky-600 hover:bg-sky-700 text-white px-4 shadow-sm transition"
          >
            แสดงข้อมูล
          </button>

          {(ตั้งแต่วันที่ || ถึงวันที่) && (
            <button
              onClick={() => {
                setตั้งแต่วันที่("");
                setถึงวันที่("");
                setTimeout(โหลดข้อมูล, 0);
              }}
              className="h-[42px] rounded-xl border px-4 text-slate-700 hover:bg-slate-50 transition"
              title="ล้างช่วงวันที่"
            >
              ล้างตัวกรอง
            </button>
          )}
        </div>
      </div>

      {/* Error Banner */}
      {!กำลังโหลด && ข้อผิดพลาด && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 text-red-700 p-4">
          <div className="font-semibold">เกิดข้อผิดพลาด</div>
          <div className="text-sm">{ข้อผิดพลาด}</div>
        </div>
      )}

      {/* Loading Skeleton */}
      {กำลังโหลด && (
        <div className="mt-6 space-y-4">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonTable />
        </div>
      )}

      {/* 📊 การ์ด KPI */}
      {!กำลังโหลด && !ข้อผิดพลาด && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <KpiCard
            label="คะแนนรวม (เฉลี่ย)"
            value={kpi.ค่าเฉลี่ยรวม ? kpi.ค่าเฉลี่ยรวม.toFixed(2) : "-"}
            hint="ค่าเฉลี่ยถ่วงน้ำหนักจากทุกข้อคำถาม"
            progress={kpi.ค่าเฉลี่ยรวม ? kpi.ค่าเฉลี่ยรวม / 5 : 0}
            gradient="from-sky-500 to-sky-600"
          />
          <KpiCard
            label="จำนวนคำตอบ (ทั้งหมด)"
            value={fmt(kpi.จำนวนคำตอบรวม)}
            hint="จำนวนเรคคอร์ดของคำตอบทั้งหมด"
            progress={kpi.จำนวนคำตอบรวม ? Math.min(kpi.จำนวนคำตอบรวม / 1000, 1) : 0}
            gradient="from-indigo-500 to-indigo-600"
          />
          <KpiCard
            label="คะแนนสูง (4–5 ดาว)"
            value={pct(kpi.สัดส่วนคะแนนสูง)}
            hint="สัดส่วนคำตอบที่ให้ 4–5 ดาว"
            progress={kpi.สัดส่วนคะแนนสูง}
            gradient="from-emerald-500 to-emerald-600"
          />
          <KpiCard
            label="คะแนนต่ำ (1–2 ดาว)"
            value={pct(kpi.สัดส่วนคะแนนต่ำ)}
            hint="สัดส่วนคำตอบที่ให้ 1–2 ดาว"
            progress={kpi.สัดส่วนคะแนนต่ำ}
            gradient="from-rose-500 to-rose-600"
          />
        </div>
      )}

      {/* 🧾 ตารางสรุปคะแนนรายคำถาม + ความคิดเห็นล่าสุด */}
      {!กำลังโหลด && !ข้อผิดพลาด && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">สรุปคะแนนรายคำถาม</h2>
            <div className="text-xs text-slate-500">
              ทั้งหมด {fmt(สรุป.items?.length || 0)} ข้อ
            </div>
          </div>

          <div className="mt-2 rounded-2xl border bg-white overflow-hidden shadow-sm">
            <div className="max-h-[520px] overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0 z-10">
                  <tr className="text-slate-600">
                    <Th>ข้อ</Th>
                    <Th className="text-left">คำถาม</Th>
                    <Th>เฉลี่ย</Th>
                    <Th>จำนวนคำตอบ</Th>
                    <Th>1★</Th>
                    <Th>2★</Th>
                    <Th>3★</Th>
                    <Th>4★</Th>
                    <Th>5★</Th>
                    <Th>สูง</Th>
                    <Th>ต่ำ</Th>
                  </tr>
                </thead>
                <tbody>
                  {สรุป.items?.map((it, idx) => {
                    const total =
                      Number(it.r1 || 0) +
                      Number(it.r2 || 0) +
                      Number(it.r3 || 0) +
                      Number(it.r4 || 0) +
                      Number(it.r5 || 0);
                    const pctHigh = total ? (Number(it.r4 || 0) + Number(it.r5 || 0)) / total : 0;
                    const pctLow = total ? (Number(it.r1 || 0) + Number(it.r2 || 0)) / total : 0;

                    return (
                      <tr key={it.question_id} className="odd:bg-white even:bg-slate-50/60">
                        <Td className="text-center">{idx + 1}</Td>
                        <Td className="text-left">
                          <div className="font-medium text-slate-800">{it.question_text}</div>
                          <div className="text-[11px] text-slate-500">
                            ประเภท: {it.question_type === "rating" ? "ให้คะแนน" : "คำตอบข้อความ"}
                          </div>
                        </Td>
                        <Td className="text-center">{it.avg_rating ?? "-"}</Td>
                        <Td className="text-center">{fmt(it.answers_count)}</Td>
                        <Td className="text-center">{fmt(it.r1 ?? 0)}</Td>
                        <Td className="text-center">{fmt(it.r2 ?? 0)}</Td>
                        <Td className="text-center">{fmt(it.r3 ?? 0)}</Td>
                        <Td className="text-center">{fmt(it.r4 ?? 0)}</Td>
                        <Td className="text-center">{fmt(it.r5 ?? 0)}</Td>
                        <Td>
                          <Bar value={pctHigh} label={pct(pctHigh)} tone="high" />
                        </Td>
                        <Td>
                          <Bar value={pctLow} label={pct(pctLow)} tone="low" />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 💬 ความคิดเห็นล่าสุด */}
          <div className="mt-10">
            <h2 className="font-semibold text-slate-800">ความคิดเห็นล่าสุด</h2>

            {คอมเมนต์.length === 0 ? (
              <p className="text-slate-600 mt-2">ยังไม่มีความคิดเห็น</p>
            ) : (
              <>
                <ul className="mt-3 grid gap-3 sm:grid-cols-2">
                  {คอมเมนต์ที่จะแสดง.map((c, i) => (
                    <li
                      key={i}
                      className="rounded-2xl border bg-white p-4 shadow-sm hover:shadow transition"
                    >
                      <div className="text-[11px] text-slate-500 flex items-center gap-2">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />
                        {new Date(c.created_at).toLocaleString()} • {c.user_group}
                      </div>
                      <div className="mt-2 text-slate-800 leading-relaxed">
                        {c.comment}
                      </div>
                      <div className="mt-2 text-[12px] text-slate-500">
                        (เกี่ยวข้องกับ: {c.question_text})
                      </div>
                    </li>
                  ))}
                </ul>

                {/* ✅ ปุ่ม “ดูเพิ่มเติม / ซ่อนความคิดเห็น” */}
                {คอมเมนต์.length > 3 && (
                  <div className="mt-3">
                    {!แสดงคอมเมนต์ทั้งหมด ? (
                      <button
                        onClick={() => setแสดงคอมเมนต์ทั้งหมด(true)}
                        className="px-4 py-2 rounded-xl border text-slate-700 hover:bg-slate-50 transition"
                        aria-label={`ดูความคิดเห็นเพิ่มเติมอีก ${เหลืออีกกี่รายการ} รายการ`}
                      >
                        ความคิดเห็นเพิ่มเติม{เหลืออีกกี่รายการ ? ` (${เหลืออีกกี่รายการ})` : ""}
                      </button>
                    ) : (
                      <button
                        onClick={() => setแสดงคอมเมนต์ทั้งหมด(false)}
                        className="px-4 py-2 rounded-xl border text-slate-700 hover:bg-slate-50 transition"
                      >
                        ซ่อนความคิดเห็น
                      </button>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------------
   UI Subcomponents (Tailwind)
-------------------------- */

function KpiCard({
  label,
  value,
  hint,
  progress,
  gradient = "from-slate-500 to-slate-600",
}: {
  label: string;
  value: string;
  hint?: string;
  progress?: number; // 0..1
  gradient?: string;
}) {
  const pct = Math.max(0, Math.min(progress || 0, 1));
  return (
    <div className="rounded-2xl border bg-white overflow-hidden shadow-sm">
      <div className={`p-4 bg-gradient-to-r ${gradient} text-white`}>
        <div className="text-xs/5 opacity-90">{label}</div>
        <div className="text-2xl font-semibold">{value}</div>
      </div>
      <div className="p-4">
        {hint && <div className="text-xs text-slate-500 mb-2">{hint}</div>}
        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full bg-sky-500 transition-[width]"
            style={{ width: `${(pct * 100).toFixed(0)}%` }}
          />
        </div>
      </div>
    </div>
  );
}

function Bar({ value, label, tone }: { value: number; label: string; tone: "high" | "low" }) {
  const pct = Math.max(0, Math.min(value, 1));
  const color = tone === "high" ? "bg-emerald-500" : "bg-rose-500";
  const bg = tone === "high" ? "bg-emerald-50" : "bg-rose-50";
  const border = tone === "high" ? "border-emerald-100" : "border-rose-100";
  return (
    <div className={`flex items-center gap-2 ${bg} ${border} border rounded-full p-1`}>
      <div className="h-2 w-24 rounded-full bg-white/70 overflow-hidden">
        <div
          className={`h-full ${color}`}
          style={{ width: `${(pct * 100).toFixed(0)}%` }}
        />
      </div>
      <span className="text-[11px] text-slate-600 min-w-[3rem] text-right">{label}</span>
    </div>
  );
}

function Th({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <th
      className={
        `p-3 border-b border-slate-200 text-center 
         text-sm sm:text-base font-semibold tracking-wide whitespace-nowrap ` + className
      }
    >
      {children}
    </th>
  );
}


function Td({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`p-2.5 border-b border-slate-200 ${className}`}>{children}</td>;
}

/* -------- Skeletons -------- */

function SkeletonCard() {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm animate-pulse">
      <div className="h-8 rounded-xl bg-slate-200 mb-4" />
      <div className="h-2 rounded bg-slate-200 w-2/3" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="rounded-2xl border bg-white p-4 shadow-sm animate-pulse">
      <div className="h-6 rounded bg-slate-200 w-1/3 mb-3" />
      <div className="space-y-2">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-4 rounded bg-slate-200" />
        ))}
      </div>
    </div>
  );
}
