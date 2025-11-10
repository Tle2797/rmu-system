// src/app/(dashboard)/dashboard/[departmentCode]/comments/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  MessageSquare,
  AlertTriangle,
  Smile,
  Frown,
  Meh,
  Plus,
  ClipboardList,
  CheckCircle2,
  Loader2,
  UserCircle,
} from "lucide-react";

/* ========== Types ========== */

type Role = "admin" | "exec" | "dept_head" | "staff";

type MePayload = {
  uid: number;
  username: string;
  role: Role;
  departmentCode?: string;
};

type Sentiment = "positive" | "neutral" | "negative";

type CommentRow = {
  answer_id: number;
  department_code: string;
  department_name: string;
  user_group: string;
  created_at: string;
  question_text: string;
  comment: string;
  sentiment: Sentiment;
  sentiment_score: number | null;
  // themes ถูกนำออกจากหน้าแล้ว
};

type Summary = {
  bySent: { sentiment: Sentiment; cnt: number }[];
  // byTheme ถูกนำออกจากหน้าแล้ว
};

type ActionStatus = "open" | "in_progress" | "done";

type ActionRow = {
  id: number;
  answer_id: number;
  department_id: number;
  department_code: string;
  department_name: string;
  title: string;
  status: ActionStatus;
  assignee: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type DepartmentMeta = {
  id: number;
  code: string;
  name: string;
};

/* ========== Helpers ========== */

const sentimentLabel: Record<Sentiment, string> = {
  positive: "เชิงบวก",
  neutral: "กลาง ๆ",
  negative: "เชิงลบ",
};

const sentimentIcon: Record<Sentiment, ReactNode> = {
  positive: <Smile className="size-3.5 text-emerald-600" />,
  neutral: <Meh className="size-3.5 text-slate-500" />,
  negative: <Frown className="size-3.5 text-rose-500" />,
};

const statusLabel: Record<ActionStatus, string> = {
  open: "เปิด",
  in_progress: "กำลังดำเนินการ",
  done: "เสร็จสิ้น",
};

const statusColorClass: Record<ActionStatus, string> = {
  open: "bg-amber-50 text-amber-700 ring-amber-200",
  in_progress: "bg-sky-50 text-sky-700 ring-sky-200",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

function buildQuery(params: Record<string, string | undefined>) {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

function formatStable(dt: string) {
  // "2025-01-03T10:22:33.123Z" -> "2025-01-03 10:22"
  return dt.replace("T", " ").slice(0, 16);
}

/* ========== Page Component ========== */

export default function DepartmentCommentsPage() {
  const { departmentCode } = useParams<{ departmentCode: string }>();
  const qs = useSearchParams();
  const surveyId = Number(qs.get("survey_id") ?? 1);

  // auth & meta
  const [me, setMe] = useState<MePayload | null>(null);
  const role = me?.role;
  const [dept, setDept] = useState<DepartmentMeta | null>(null);

  // data
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [actions, setActions] = useState<ActionRow[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // filters
  const [q, setQ] = useState("");
  const [sentiment, setSentiment] = useState<Sentiment | "">("");

  // create action (เฉพาะ dept_head)
  const [draftAnswerId, setDraftAnswerId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftAssignee, setDraftAssignee] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  /* ----- โหลดข้อมูลผู้ใช้ (role) ----- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        if (!r.ok) return;
        const j = (await r.json()) as MePayload;
        if (!cancelled) setMe(j);
      } catch {
        // ปล่อยผ่าน
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /* ----- โหลด meta หน่วยงาน + comments + summary + actions ----- */
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        setError("");

        const commonQuery = buildQuery({
          survey_id: String(surveyId),
          department_code: departmentCode,
          q: q || undefined,
          sentiment: sentiment || undefined,
        });

        const [depRes, cmtRes, sumRes, actRes] = await Promise.all([
          fetch(`/api/departments/${departmentCode}`),
          fetch(`/api/comments/search${commonQuery}`),
          fetch(`/api/comments/summary${commonQuery}`),
          fetch(
            `/api/comments/actions${buildQuery({
              department_code: departmentCode,
            })}`
          ),
        ]);

        const depJson = await depRes.json();
        const cmtJson = (await cmtRes.json()) as CommentRow[];
        const sumJson = (await sumRes.json()) as Summary;
        const actJson = (await actRes.json()) as ActionRow[];

        if (cancelled) return;

        if (!depRes.ok || (depJson as any)?.error) {
          setError((depJson as any)?.error || "ไม่พบหน่วยงานนี้");
          setDept(null);
        } else {
          setDept(depJson as DepartmentMeta);
        }

        if (!cmtRes.ok && (cmtJson as any)?.error) {
          setError((cmtJson as any)?.error || "โหลดความคิดเห็นไม่สำเร็จ");
        } else {
          setComments(Array.isArray(cmtJson) ? cmtJson : []);
        }

        if (!sumRes.ok && (sumJson as any)?.error) {
          // ไม่ถึงกับเป็น fatal error
          setSummary(null);
        } else {
          setSummary(sumJson);
        }

        if (!actRes.ok && (actJson as any)?.error) {
          // ปล่อย actions ว่างไป
          setActions([]);
        } else {
          setActions(Array.isArray(actJson) ? actJson : []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "เกิดข้อผิดพลาด");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [departmentCode, surveyId, q, sentiment]);

  const deptName = dept?.name ?? "-";

  const bySentMap = useMemo(() => {
    const m: Record<Sentiment, number> = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };
    if (!summary) return m;
    for (const s of summary.bySent) {
      m[s.sentiment] = s.cnt;
    }
    return m;
  }, [summary]);

  /* ========== Handlers ========== */

  const canCreateAction = role === "dept_head" || role === "admin";
  const canUpdateStatus = role === "staff" || role === "admin";

  const handleOpenCreateAction = (c: CommentRow) => {
    if (!canCreateAction || !dept) return;
    setDraftAnswerId(c.answer_id);
    setDraftTitle(
      c.comment.length > 40
        ? c.comment.slice(0, 40) + "..."
        : c.comment || `ติดตามข้อร้องเรียนจากความคิดเห็น`
    );
    setDraftAssignee("");
    setDraftNotes(c.comment);
  };

  const handleCancelDraft = () => {
    setDraftAnswerId(null);
    setDraftTitle("");
    setDraftAssignee("");
    setDraftNotes("");
  };

  const handleSubmitAction = async () => {
    if (!canCreateAction || !dept || !draftAnswerId || !draftTitle.trim())
      return;
    try {
      setSavingAction(true);
      const res = await fetch("/api/comments/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answer_id: draftAnswerId,
          department_id: dept.id,
          title: draftTitle.trim(),
          assignee: draftAssignee.trim() || null,
          notes: draftNotes.trim() || null,
        }),
      });
      const j = await res.json();
      if (!res.ok || (j as any)?.error) {
        alert((j as any)?.error || "สร้างภารกิจไม่สำเร็จ");
        return;
      }
      // reload actions list
      const actRes = await fetch(
        `/api/comments/actions${buildQuery({ department_code: departmentCode })}`
      );
      const actJson = (await actRes.json()) as ActionRow[];
      setActions(Array.isArray(actJson) ? actJson : []);

      handleCancelDraft();
    } catch (e: any) {
      alert(e?.message || "เกิดข้อผิดพลาดในการสร้างภารกิจ");
    } finally {
      setSavingAction(false);
    }
  };

  const handleChangeStatus = async (id: number, status: ActionStatus) => {
    if (!canUpdateStatus) return;
    try {
      const res = await fetch("/api/comments/actions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      const j = await res.json();
      if (!res.ok || (j as any)?.error) {
        alert((j as any)?.error || "อัปเดตสถานะไม่สำเร็จ");
        return;
      }
      // update local
      setActions((prev) =>
        prev.map((a) => (a.id === id ? { ...a, status } : a))
      );
    } catch (e: any) {
      alert(e?.message || "เกิดข้อผิดพลาดในการอัปเดตสถานะ");
    }
  };

  /* ========== Render ========== */

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border bg-white shadow-sm p-4 md:p-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"
      >
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs text-sky-700 ring-1 ring-sky-200">
            <MessageSquare className="size-3.5" /> ความคิดเห็นและการแก้ไขปัญหา
          </div>
          <h1 className="mt-2 text-xl md:text-2xl font-semibold tracking-tight">
            หน่วยงาน: <span className="text-sky-700">{deptName}</span>
          </h1>
          {me && (
            <p className="mt-1 text-xs text-slate-500 flex items-center gap-1.5">
              <UserCircle className="size-3.5" />
              ผู้ใช้งาน:{" "}
              <span className="font-medium text-slate-700">
                {me.username}
              </span>{" "}
              ({role})
            </p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-2 md:items-end">
          <div className="flex gap-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="ค้นหาคีย์เวิร์ดในความคิดเห็น/คำถาม"
              className="w-[220px] md:w-[260px] rounded-lg border px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 justify-end">
            {(["", "positive", "neutral", "negative"] as (Sentiment | "")[]).map(
              (s) => {
                const active = sentiment === s;
                const label =
                  s === ""
                    ? "ทั้งหมด"
                    : s === "positive"
                    ? "เชิงบวก"
                    : s === "neutral"
                    ? "กลาง ๆ"
                    : "เชิงลบ";
                return (
                  <button
                    key={s || "all"}
                    onClick={() => setSentiment(s)}
                    className={[
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs ring-1 transition",
                      active
                        ? "bg-sky-600 text-white ring-sky-600"
                        : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50",
                    ].join(" ")}
                  >
                    {s === "" ? (
                      <ClipboardList className="size-3.5" />
                    ) : (
                      sentimentIcon[s as Sentiment]
                    )}
                    {label}
                  </button>
                );
              }
            )}
          </div>
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertTriangle className="inline-block mr-2 size-4" />
          {error}
        </div>
      )}

      {/* Summary chips */}
      {!loading && !error && summary && (
        <div className="grid gap-3 md:grid-cols-4">
          <div className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-500">จำนวนความคิดเห็นทั้งหมด</div>
              <div className="mt-1 text-2xl font-semibold">
                {comments.length}
              </div>
            </div>
            <MessageSquare className="size-6 text-sky-500" />
          </div>
          {(["positive", "neutral", "negative"] as Sentiment[]).map((s) => (
            <div
              key={s}
              className="rounded-2xl border bg-white p-4 shadow-sm flex items-center justify-between"
            >
              <div>
                <div className="text-xs text-slate-500 flex items-center gap-1.5">
                  {sentimentIcon[s]}
                  {sentimentLabel[s]}
                </div>
                <div className="mt-1 text-2xl font-semibold">
                  {bySentMap[s] ?? 0}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main 2-column layout */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)]">
        {/* Left: Comments list */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-white shadow-sm overflow-hidden"
        >
          <div className="flex items-center justify-between border-b bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                ความคิดเห็นล่าสุด
              </h2>
            </div>
            <span className="text-xs text-slate-500">
              ทั้งหมด {comments.length} รายการ
            </span>
          </div>
          {loading ? (
            <div className="p-6 flex items-center justify-center text-slate-500 text-sm gap-2">
              <Loader2 className="size-4 animate-spin" />
              กำลังโหลดข้อมูล...
            </div>
          ) : comments.length === 0 ? (
            <div className="p-6 text-center text-sm text-slate-500">
              — ไม่มีความคิดเห็นในช่วงนี้ —
            </div>
          ) : (
            <div className="divide-y max-h-[70vh] overflow-y-auto">
              {comments.map((c) => (
                <div key={c.answer_id} className="p-4 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[11px] text-slate-500">
                      {formatStable(c.created_at)} • {c.user_group}
                    </div>
                    <div className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      <span className="truncate max-w-[120px]">
                        {c.department_name}
                      </span>
                    </div>
                  </div>
                  <div className="text-sm leading-relaxed">{c.comment}</div>
                  <div className="text-[11px] text-slate-500 line-clamp-2">
                    {c.question_text}
                  </div>

                  {/* ปุ่มสร้างภารกิจ: เฉพาะ dept_head / admin */}
                  {canCreateAction && (
                    <div className="pt-2">
                      <button
                        onClick={() => handleOpenCreateAction(c)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1 text-xs text-white hover:bg-sky-700"
                      >
                        <Plus className="size-3.5" />
                        เพิ่มการแก้ไขปัญหาจากความคิดเห็นนี้
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Right: Actions panel */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border bg-white shadow-sm flex flex-col"
        >
          <div className="flex items-center justify-between border-b bg-slate-50/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="size-4 text-sky-600" />
              <h2 className="text-sm font-semibold text-slate-800">
                ภารกิจการแก้ไขปัญหา
              </h2>
            </div>
          <span className="text-xs text-slate-500">
              ทั้งหมด {actions.length} งาน
            </span>
          </div>

          {/* ฟอร์มสร้างภารกิจ (เฉพาะ dept_head/admin) */}
          {canCreateAction && draftAnswerId && (
            <div className="border-b bg-sky-50/60 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs text-sky-800">
                  <AlertTriangle className="size-3.5" />
                  <span>เพิ่มการแก้ไขปัญหาใหม่</span>
                </div>
                <button
                  onClick={handleCancelDraft}
                  className="text-[11px] text-slate-500 hover:text-slate-700"
                >
                  ยกเลิก
                </button>
              </div>
              <div className="space-y-2">
                <div>
                  <label className="text-[11px] text-slate-600">
                    หัวข้อการแก้ไข
                  </label>
                  <input
                    value={draftTitle}
                    onChange={(e) => setDraftTitle(e.target.value)}
                    className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-600">
                      ผู้รับผิดชอบ (ถ้ามี)
                    </label>
                    <input
                      value={draftAssignee}
                      onChange={(e) => setDraftAssignee(e.target.value)}
                      className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-600">
                      หมายเหตุ (ถ้ามี)
                    </label>
                    <input
                      value={draftNotes}
                      onChange={(e) => setDraftNotes(e.target.value)}
                      className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    onClick={handleCancelDraft}
                    className="rounded-lg border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>
                  <button
                    disabled={savingAction}
                    onClick={handleSubmitAction}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-1.5 text-xs text-white hover:bg-sky-700 disabled:opacity-60"
                  >
                    {savingAction && (
                      <Loader2 className="size-3 animate-spin" />
                    )}
                    บันทึกภารกิจ
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* รายการภารกิจ */}
          <div className="flex-1 overflow-y-auto max-h-[70vh]">
            {loading ? (
              <div className="p-6 flex items-center justify-center text-slate-500 text-sm gap-2">
                <Loader2 className="size-4 animate-spin" />
                กำลังโหลดภารกิจ...
              </div>
            ) : actions.length === 0 ? (
              <div className="p-6 text-center text-sm text-slate-500">
                — ยังไม่มีภารกิจที่สร้างจากความคิดเห็น —
              </div>
            ) : (
              <div className="divide-y">
                {actions.map((a) => (
                  <div key={a.id} className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-medium text-slate-800">
                          {a.title}
                        </div>
                        {a.assignee && (
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            ผู้รับผิดชอบ:{" "}
                            <span className="font-medium">
                              {a.assignee}
                            </span>
                          </div>
                        )}
                        {a.notes && (
                          <div className="mt-0.5 text-[11px] text-slate-500">
                            หมายเหตุ: {a.notes}
                          </div>
                        )}
                      </div>
                      <div className="text-right space-y-1">
                        <span
                          className={[
                            "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] ring-1",
                            statusColorClass[a.status],
                          ].join(" ")}
                        >
                          <CheckCircle2 className="size-3" />
                          {statusLabel[a.status]}
                        </span>
                        <div className="text-[10px] text-slate-400">
                          ปรับปรุงล่าสุด {formatStable(a.updated_at)}
                        </div>
                      </div>
                    </div>

                    {/* เปลี่ยนสถานะ: เฉพาะ staff/admin */}
                    {canUpdateStatus && (
                      <div className="pt-1 flex items-center justify-between gap-2">
                        <span className="text-[11px] text-slate-500">
                          ปรับสถานะงาน
                        </span>
                        <select
                          value={a.status}
                          onChange={(e) =>
                            handleChangeStatus(
                              a.id,
                              e.target.value as ActionStatus
                            )
                          }
                          className="rounded-md border px-2 py-1 text-[11px] focus:outline-none focus:ring-2 focus:ring-sky-500"
                        >
                          <option value="open">เปิด</option>
                          <option value="in_progress">
                            กำลังดำเนินการ
                          </option>
                          <option value="done">เสร็จสิ้น</option>
                        </select>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
