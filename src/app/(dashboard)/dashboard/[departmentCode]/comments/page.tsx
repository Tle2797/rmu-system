// app/(dashboard)/dashboard/[departmentCode]/comments/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import axios from "axios";

/** ---------- Types from API ---------- */
type CommentRow = {
  answer_id: number;
  department_code: string;
  department_name: string;
  user_group: string;
  created_at: string;
  question_text: string;
  comment: string;
  sentiment: "positive" | "neutral" | "negative" | null;
  sentiment_score: number | null;
  themes: string[] | null;
};

type Summary = {
  bySent: { sentiment: string | null; cnt: number }[];
  byTheme: { theme: string; cnt: number }[];
};

type ActionRow = {
  id: number;
  answer_id: number;
  department_id: number;
  department_code: string;
  department_name: string;
  title: string;
  status: "open" | "in_progress" | "done";
  assignee: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DepartmentInfo = { id: number; code: string; name: string };

/** ---------- Utils ---------- */
// แสดงเป็น วัน/เดือน/ปี (ค.ศ.) ไม่รวมเวลา
const toDDMMYYYY = (d: string | number | Date) =>
  new Date(d).toLocaleDateString("th-TH-u-ca-gregory", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

/** ---------- Page ---------- */
export default function DeptCommentsPage() {
  const { departmentCode } = useParams<{ departmentCode: string }>();

  // ฟิลเตอร์
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [sentiment, setSentiment] = useState<string>("");

  // ข้อมูลหลัก
  const [dept, setDept] = useState<DepartmentInfo | null>(null);
  const [rows, setRows] = useState<CommentRow[]>([]);
  const [sum, setSum] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  // ภารกิจ (actions)
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [actionLoading, setActionLoading] = useState(true);
  const [actionStatusFilter, setActionStatusFilter] = useState<string>("");

  // Drawer/Modal “สร้างภารกิจ”
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedComment, setSelectedComment] = useState<CommentRow | null>(null);
  const [formTitle, setFormTitle] = useState("");
  const [formAssignee, setFormAssignee] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [creating, setCreating] = useState(false);

  /** โหลด department_id จาก departmentCode */
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const r = await axios.get(`/api/departments/${departmentCode}`);
        if (!ok) return;
        if ((r.data as any)?.error) setDept(null);
        else setDept(r.data as DepartmentInfo);
      } catch {
        if (ok) setDept(null);
      }
    })();
    return () => {
      ok = false;
    };
  }, [departmentCode]);

  /** debounce ค้นหา */
  useEffect(() => {
    const t = setTimeout(() => setQ(qInput.trim()), 350);
    return () => clearTimeout(t);
  }, [qInput]);

  /** โหลดคอมเมนต์ + summary */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const params: any = { department_code: departmentCode };
        if (q) params.q = q;
        if (sentiment) params.sentiment = sentiment;

        const [s1, s2] = await Promise.all([
          axios.get("/api/comments/search", { params }),
          axios.get("/api/comments/summary", { params }),
        ]);

        if (!mounted) return;
        setRows(Array.isArray(s1.data) ? s1.data : []);
        setSum(s2.data || null);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [departmentCode, q, sentiment]);

  /** โหลดภารกิจของหน่วยงาน */
  const fetchActions = async () => {
    setActionLoading(true);
    try {
      const params: any = { department_code: departmentCode };
      if (actionStatusFilter) params.status = actionStatusFilter;
      const r = await axios.get<ActionRow[]>("/api/comments/actions", { params });
      setActions(Array.isArray(r.data) ? r.data : []);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    fetchActions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [departmentCode, actionStatusFilter]);

  /** สรุปอารมณ์ */
  const sentMap = useMemo(() => {
    const m: Record<"positive" | "neutral" | "negative", number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    sum?.bySent.forEach((x) => {
      const k = (x.sentiment ?? "neutral") as "positive" | "neutral" | "negative";
      m[k] = x.cnt;
    });
    return m;
  }, [sum]);

  /** Drawer */
  const openDrawer = (row: CommentRow) => {
    setSelectedComment(row);
    setFormTitle(`[${row.user_group}] ${row.question_text}`);
    setFormAssignee("");
    setFormNotes(row.comment || "");
    setDrawerOpen(true);
  };

  const submitCreate = async () => {
    if (!selectedComment) return;

    if (!dept) {
      alert("ยังไม่พบ department_id ของหน่วยงานนี้ (รอโหลด/ตรวจ API /api/departments/[code])");
      return;
    }
    if (!formTitle.trim()) {
      alert("กรุณากรอกหัวข้อภารกิจ");
      return;
    }

    setCreating(true);
    try {
      const payload = {
        answer_id: selectedComment.answer_id,
        department_id: dept.id,
        title: formTitle.trim(),
        assignee: formAssignee.trim() || null,
        notes: formNotes.trim() || null,
      };
      await axios.post("/api/comments/actions", payload);
      setDrawerOpen(false);
      setSelectedComment(null);
      await fetchActions();
      alert("สร้างภารกิจสำเร็จ");
    } catch (e: any) {
      const msg =
        e?.response?.status === 404
          ? "ไม่พบ API POST /api/comments/actions (ฝั่งเซิร์ฟเวอร์ยังไม่ได้ทำ?)"
          : e?.response?.data?.error || "สร้างภารกิจล้มเหลว";
      alert(msg);
    } finally {
      setCreating(false);
    }
  };

  /** เปลี่ยนสถานะภารกิจ */
  const updateActionStatus = async (id: number, status: ActionRow["status"]) => {
    try {
      await axios.put("/api/comments/actions", { id, status });
      await fetchActions();
    } catch (e: any) {
      alert(e?.response?.data?.error || "อัปเดตสถานะล้มเหลว");
    }
  };

  const clearFilters = () => {
    setQInput("");
    setSentiment("");
  };

  /** ---------- จัดลำดับภารกิจ: เปิดใหม่ > กำลังทำ > เสร็จสิ้น, จากนั้นตาม updated_at ใหม่ก่อน ---------- */
  const sortedActions = useMemo(() => {
    const order: Record<ActionRow["status"], number> = { open: 0, in_progress: 1, done: 2 };
    return [...actions].sort((a, b) => {
      const byStatus = order[a.status] - order[b.status];
      if (byStatus !== 0) return byStatus;
      return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
    });
  }, [actions]);

  /** ---------- Table cell styles (ให้สม่ำเสมอ) ---------- */
  const TH = "px-4 py-2.5 text-left font-semibold text-slate-700";
  const TD = "px-4 py-2.5 align-middle text-slate-800";

  return (
    <div className="mx-auto max-w-7xl p-4 space-y-6">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="space-y-0.5">
          <h1 className="text-2xl font-bold tracking-tight">ความคิดเห็น &amp; ภารกิจ</h1>
          <div className="text-slate-600 text-sm">
            หน่วยงาน:{" "}
            <span className="inline-flex items-center gap-2">
              <span className="font-semibold">{dept?.name || "-"}</span>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-700 border border-slate-200">
                {departmentCode}
              </span>
            </span>
          </div>
        </div>

        {/* KPI ย่อ */}
        <div className="hidden md:flex items-center gap-2">
          <MiniKPI label="บวก" tone="green" value={sentMap.positive ?? 0} />
          <MiniKPI label="กลาง" tone="slate" value={sentMap.neutral ?? 0} />
          <MiniKPI label="ลบ" tone="rose" value={sentMap.negative ?? 0} />
        </div>
      </header>

      {/* Summary Cards */}
      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <CardStat title="เชิงบวก" value={sentMap.positive ?? 0} tone="green" />
        <CardStat title="กลาง ๆ" value={sentMap.neutral ?? 0} tone="slate" />
        <CardStat title="เชิงลบ" value={sentMap.negative ?? 0} tone="rose" />
      </section>

      {/* Toolbar */}
      <section className="rounded-xl border bg-white/70 backdrop-blur-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center px-3 py-3">
          <div className="font-medium">ตัวกรองความคิดเห็น</div>
          <div className="md:ml-auto flex flex-col sm:flex-row gap-2 w-full md:w-auto">
            <div className="relative">
              <input
                className="w-full sm:w-[320px] border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="พิมพ์คำที่ต้องการค้นหา (คำถาม/กลุ่ม/ข้อความ)…"
                value={qInput}
                onChange={(e) => setQInput(e.target.value)}
              />
              <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400 text-sm">🔎</span>
            </div>
            <select
              className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={sentiment}
              onChange={(e) => setSentiment(e.target.value)}
              title="กรองอารมณ์"
            >
              <option value="">ทุกอารมณ์</option>
              <option value="positive">เชิงบวก</option>
              <option value="neutral">กลาง ๆ</option>
              <option value="negative">เชิงลบ</option>
            </select>
            {(q || sentiment) && (
              <button
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-50"
                onClick={clearFilters}
                title="ล้างตัวกรอง"
              >
                ล้างตัวกรอง
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Comments */}
      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center justify-between border-b bg-slate-50/60 px-4 py-2.5">
          <div className="font-semibold">รายการความคิดเห็น</div>
          {sum?.byTheme?.length ? (
            <div className="hidden md:flex items-center gap-1">
              <span className="text-xs text-slate-500 mr-1">ธีมเด่น:</span>
              {sum.byTheme.slice(0, 3).map((t) => (
                <span
                  key={t.theme}
                  className="text-xs rounded-full bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5"
                  title={`${t.cnt.toLocaleString()} รายการ`}
                >
                  {t.theme}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        <div className="overflow-auto">
          <table
            className="min-w-[1120px] w-full text-sm border-collapse table-fixed"
            style={{ wordBreak: "break-word" }}
          >
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b text-slate-700">
                <th className={`${TH} w-32`}>วันที่</th>
                <th className={`${TH} w-36`}>กลุ่ม</th>
                <th className={`${TH} w-[26%]`}>คำถาม</th>
                <th className={`${TH} w-44`}>อารมณ์</th>
                <th className={`${TH} w-44`}>ธีม</th>
                <th className={`${TH} w-[50%]`}>ความคิดเห็น</th>
                <th className={`${TH} w-40`}>ภารกิจ</th>
              </tr>
            </thead>
            <tbody className="leading-relaxed">
              {loading ? (
                <TableLoading cols={7} TD={TD} />
              ) : rows.length ? (
                rows.map((r) => (
                  <tr key={r.answer_id} className="border-b hover:bg-slate-50/50">
                    <td className={`${TD} whitespace-nowrap`}>{toDDMMYYYY(r.created_at)}</td>
                    <td className={`${TD} whitespace-nowrap`}>{r.user_group}</td>
                    <td className={TD}>{r.question_text}</td>
                    <td className={`${TD} whitespace-nowrap`}>
                      <SentimentBadge s={r.sentiment} score={r.sentiment_score} />
                    </td>
                    <td className={TD}>
                      <ThemeChips themes={r.themes} />
                    </td>
                    <td className={TD}>
                      <ClampText text={r.comment} lines={4} />
                    </td>
                    <td className={TD}>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-600 text-white px-3 py-1.5 text-xs hover:bg-blue-700"
                        onClick={() => openDrawer(r)}
                        title="สร้างภารกิจจากคอมเมนต์นี้"
                      >
                        <span>＋</span> สร้างภารกิจ
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    ไม่มีความคิดเห็นที่ตรงกับตัวกรอง
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions */}
      <section className="rounded-xl border bg-white overflow-hidden">
        <div className="flex items-center gap-2 border-b bg-slate-50/60 px-4 py-2.5">
          <div className="font-semibold">ภารกิจจากคอมเมนต์</div>
          <div className="ml-auto flex items-center gap-2">
            <select
              className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
              value={actionStatusFilter}
              onChange={(e) => setActionStatusFilter(e.target.value)}
              title="กรองสถานะ"
            >
              <option value="">ทุกสถานะ</option>
              <option value="open">เปิดใหม่</option>
              <option value="in_progress">กำลังดำเนินการ</option>
              <option value="done">เสร็จสิ้น</option>
            </select>
          </div>
        </div>

        <div className="overflow-auto">
          <table
            className="min-w-[980px] w-full text-sm border-collapse table-fixed"
            style={{ wordBreak: "break-word" }}
          >
            <thead className="sticky top-0 z-10 bg-white">
              <tr className="border-b text-slate-700">
                <th className={`${TH}`}>เรื่อง</th>
                <th className={`${TH} w-44`}>ผู้รับผิดชอบ</th>
                <th className={`${TH} w-36`}>สถานะ</th>
                <th className={`${TH} w-36`}>อัปเดตเมื่อ</th>
                <th className={`${TH} w-48`}>เปลี่ยนสถานะ</th>
              </tr>
            </thead>
            <tbody className="leading-relaxed">
              {actionLoading ? (
                <TableLoading cols={5} TD={TD} />
              ) : sortedActions.length ? (
                sortedActions.map((a) => (
                  <tr key={a.id} className="border-b hover:bg-slate-50/50">
                    <td className={TD}>
                      <div className="font-medium">{a.title}</div>
                      <div className="text-xs text-slate-500">
                        #{a.id} • จากคำตอบ #{a.answer_id}
                      </div>
                      {a.notes ? (
                        <div className="mt-1 text-xs text-slate-600 line-clamp-2">{a.notes}</div>
                      ) : null}
                    </td>
                    <td className={TD}>{a.assignee || "-"}</td>
                    <td className={TD}>
                      <StatusBadge status={a.status} />
                    </td>
                    <td className={`${TD} whitespace-nowrap`}>{toDDMMYYYY(a.updated_at)}</td>
                    <td className={TD}>
                      {/* แนวตั้ง: เปิดใหม่ (บน) → กำลังทำ (กลาง) → เสร็จสิ้น (ล่าง) */}
                      <div className="inline-flex flex-col items-stretch rounded-md border border-slate-200 overflow-hidden">
                        <SegBtn
                          active={a.status === "open"}
                          onClick={() => updateActionStatus(a.id, "open")}
                          label="เปิดใหม่"
                          rounded="top"
                        />
                        <SegBtn
                          active={a.status === "in_progress"}
                          onClick={() => updateActionStatus(a.id, "in_progress")}
                          label="กำลังทำ"
                        />
                        <SegBtn
                          active={a.status === "done"}
                          onClick={() => updateActionStatus(a.id, "done")}
                          label="เสร็จสิ้น"
                          rounded="bottom"
                        />
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-500">
                    ยังไม่มีภารกิจ
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Drawer: สร้างภารกิจ */}
      {drawerOpen && selectedComment && (
        <div className="fixed inset-0 z-50">
          {/* backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-[1px]"
            onClick={() => setDrawerOpen(false)}
          />
          {/* panel */}
          <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="font-semibold">สร้างภารกิจ</div>
              <button
                className="rounded-lg border bg-red-500  px-3 py-1.5 text-sm hover:bg-red-600 text-white"
                onClick={() => setDrawerOpen(false)}
              >
                ปิด
              </button>
            </div>

            <div className="p-4 space-y-4">
              {!dept && (
                <p className="text-xs text-amber-600">
                  ⚠️ ยังไม่พบ department_id — จะบันทึกไม่ได้จนกว่าจะโหลดสำเร็จ
                </p>
              )}

              <InfoRow label="คำถาม" value={selectedComment.question_text} />
              <InfoRow label="ความคิดเห็น" value={selectedComment.comment} />
              <div className="grid grid-cols-2 gap-3">
                <InfoRow label="กลุ่มผู้ใช้" value={selectedComment.user_group} />
                <InfoRow
                  label="อารมณ์"
                  value={`${labelFromSent(selectedComment.sentiment)}${
                    typeof selectedComment.sentiment_score === "number"
                      ? ` (${selectedComment.sentiment_score.toFixed(2)})`
                      : ""
                  }`}
                />
              </div>

              <hr className="border-slate-200" />

              <div className="space-y-1.5">
                <label className="text-sm font-medium">หัวข้อภารกิจ</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                  // value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="หัวข้อกระชับ ชี้ชัดสิ่งที่ต้องทำ"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">มอบหมายให้</label>
                <input
                  className="w-full rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sky-200"
                  value={formAssignee}
                  onChange={(e) => setFormAssignee(e.target.value)}
                  placeholder="เช่น เจ้าหน้าที่ฝ่าย..."
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium">บันทึกเพิ่มเติม</label>
                <textarea
                  className="w-full rounded-lg border px-3 py-2 text-sm min-h-[96px] focus:outline-none focus:ring-2 focus:ring-sky-200"
                  // value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="รายละเอียด/แนวทางการแก้ไข/กำหนดเวลา"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  className="rounded-lg bg-blue-600 px-4 py-2 text-white text-sm hover:bg-blue-700 disabled:opacity-60"
                  onClick={submitCreate}
                  disabled={creating}
                >
                  {creating ? "กำลังบันทึก…" : "สร้างภารกิจ"}
                </button>
                <button
                  className="rounded-lg border bg-red-500 px-4 py-2 text-sm hover:bg-red-600 text-white"
                  onClick={() => setDrawerOpen(false)}
                >
                  ยกเลิก
                </button>
              </div>

              {!dept && (
                <p className="text-xs text-red-600">
                  ไม่พบ department_id ของหน่วยงานนี้ — ตรวจสอบ API /api/departments/{String(departmentCode)}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** ---------- Small UI helpers ---------- */
function CardStat({
  title,
  value,
  tone,
}: {
  title: string;
  value: number;
  tone: "green" | "slate" | "rose";
}) {
  const toneMap: Record<string, string> = {
    green: "bg-emerald-50 text-emerald-700 border-emerald-100",
    slate: "bg-slate-50 text-slate-700 border-slate-100",
    rose: "bg-rose-50 text-rose-700 border-rose-100",
  };
  return (
    <div className={`rounded-xl border ${toneMap[tone]} p-4`}>
      <div className="text-[12px]">{title}</div>
      <div className="text-3xl font-extrabold tracking-tight">{value.toLocaleString()}</div>
    </div>
  );
}

function MiniKPI({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "slate" | "rose";
}) {
  const toneDot: Record<string, string> = {
    green: "bg-emerald-500",
    slate: "bg-slate-500",
    rose: "bg-rose-500",
  };
  return (
    <div className="flex items-center gap-2 rounded-lg border bg-white px-2.5 py-1.5">
      <span className={`h-2.5 w-2.5 rounded-full ${toneDot[tone]}`} />
      <span className="text-[12px] text-slate-600">{label}</span>
      <span className="text-sm font-semibold">{value.toLocaleString()}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: "open" | "in_progress" | "done" }) {
  const map: Record<string, string> = {
    open: "bg-amber-100 text-amber-800 border-amber-200",
    in_progress: "bg-sky-100 text-sky-800 border-sky-200",
    done: "bg-emerald-100 text-emerald-800 border-emerald-200",
  };
  const label: Record<string, string> = {
    open: "เปิดใหม่",
    in_progress: "กำลังดำเนินการ",
    done: "เสร็จสิ้น",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs ${map[status]}`}
      title={label[status]}
    >
      {label[status]}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-sm">
      <div className="text-slate-500">{label}</div>
      <div className="font-medium">{value || "-"}</div>
    </div>
  );
}

function TableLoading({ cols, TD }: { cols: number; TD: string }) {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <tr key={i} className="border-b">
          {Array.from({ length: cols }).map((__, j) => (
            <td key={j} className={TD}>
              <div className="h-4 w-full max-w-[220px] animate-pulse rounded bg-slate-100" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function SegBtn({
  active,
  label,
  onClick,
  rounded,
}: {
  active?: boolean;
  label: string;
  onClick: () => void;
  rounded?: "top" | "bottom";
}) {
  const radius =
    rounded === "top"
      ? "rounded-t-md"
      : rounded === "bottom"
      ? "rounded-b-md"
      : "rounded-none";
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs border-t first:border-t-0 ${
        active
          ? `bg-sky-600 text-white ${radius}`
          : `bg-white hover:bg-slate-50 ${radius}`
      }`}
      aria-pressed={active}
      style={{ borderColor: "rgb(226 232 240)" }} // slate-200
    >
      {label}
    </button>
  );
}

function SentimentBadge({
  s,
  score,
}: {
  s: CommentRow["sentiment"];
  score: number | null;
}) {
  const label = labelFromSent(s);
  const color =
    s === "positive"
      ? "bg-emerald-50 text-emerald-700 border-emerald-100"
      : s === "negative"
      ? "bg-rose-50 text-rose-700 border-rose-100"
      : "bg-slate-50 text-slate-700 border-slate-100";
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${color}`}>
      {label}
      {typeof score === "number" && <span className="text-[11px] opacity-70">({score.toFixed(2)})</span>}
    </span>
  );
}

function labelFromSent(s: CommentRow["sentiment"]) {
  if (s === "positive") return "เชิงบวก";
  if (s === "negative") return "เชิงลบ";
  if (s === "neutral" || s == null) return "กลาง ๆ";
  return String(s);
}

function ThemeChips({ themes }: { themes: string[] | null }) {
  if (!themes?.length) return <span className="text-xs text-slate-400">-</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {themes.map((t) => (
        <span
          key={t}
          className="text-xs rounded-full bg-violet-50 text-violet-700 border border-violet-100 px-2 py-0.5"
        >
          {t}
        </span>
      ))}
    </div>
  );
}

function ClampText({ text, lines = 3 }: { text: string; lines?: number }) {
  return (
    <p
      className="text-slate-800"
      style={{
        display: "-webkit-box",
        WebkitLineClamp: lines,
        WebkitBoxOrient: "vertical",
        overflow: "hidden",
      }}
      title={text}
    >
      {text}
    </p>
  );
}
