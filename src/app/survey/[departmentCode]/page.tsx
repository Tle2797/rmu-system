/* src/app/survey/[department]/page.tsx */
"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import axios from "axios";

/* ================= Types ================= */
type Question = {
  id: number;
  survey_id: number;
  text: string;
  type: "rating" | "text";
};

type SurveyMeta = {
  id: number;
  title: string;
  description?: string | null;
};

type AnswerMap = Record<number, { rating?: number; comment?: string }>;

/* ================ Helpers ================= */
const isRating = (q: Question) => q.type === "rating";
const isText = (q: Question) => q.type === "text";
const isValidRating = (v: unknown): v is number =>
  Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 5;

/* ================ Consts ================= */
const USER_GROUPS = ["นักศึกษา", "บุคลากร", "บุคคลทั่วไป"] as const;
const SURVEY_ID = 1;

/* ================ Page =================== */
export default function SurveyPage() {
  // ล็อก scroll ของ body ไว้หน้าเดียว (ปล่อยคืนเมื่อออก)
  useEffect(() => {
    const prev = document.body.style.overflowY;
    document.body.style.overflowY = "hidden";
    return () => {
      document.body.style.overflowY = prev;
    };
  }, []);

  const router = useRouter();

  const params = useParams();
  const departmentCode =
    (Array.isArray((params as any)?.departmentCode)
      ? (params as any).departmentCode[0]
      : ((params as any)?.departmentCode as string | undefined)) ?? "";

  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<AnswerMap>({});
  const [userGroup, setUserGroup] = useState("");
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [fetchError, setFetchError] = useState<string>("");
  const [departmentName, setDepartmentName] = useState("");
  const [submitted, setSubmitted] = useState(false);

  // ดึงชื่อแบบประเมินจาก DB (title/description)
  const [surveyMeta, setSurveyMeta] = useState<SurveyMeta | null>(null);
  const surveyTitle = surveyMeta?.title?.trim() || "แบบประเมินความพึงพอใจ";
  const surveyDesc = surveyMeta?.description?.trim() || "";

  /* ------------- Fetch -------------- */
  useEffect(() => {
    let mounted = true;

    if (!departmentCode) {
      setLoading(false);
      setFetchError("ไม่พบรหัสหน่วยงานในลิงก์");
      return;
    }

    const fetchDept = async () => {
      try {
        const res = await axios.get(`/api/departments/${departmentCode}`);
        if (mounted && res.data?.name) setDepartmentName(res.data.name);
      } catch {
        if (mounted) setDepartmentName("");
      }
    };

    const fetchQuestions = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/api/surveys/${SURVEY_ID}/questions`);
        if (!mounted) return;

        const list: Question[] = Array.isArray(res.data) ? res.data : [];
        setQuestions(list);

        const init: AnswerMap = {};
        for (const q of list) {
          init[q.id] = {
            rating: isRating(q) ? undefined : undefined,
            comment: isText(q) ? "" : undefined,
          };
        }
        setAnswers(init);
        setFetchError("");
      } catch {
        if (mounted) setFetchError("ไม่สามารถโหลดคำถามได้ กรุณาลองใหม่อีกครั้ง");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    const fetchSurveyMeta = async () => {
      try {
        const res = await axios.get(`/api/surveys/${SURVEY_ID}`);
        if (!mounted) return;
        const data = res.data || {};
        if (data?.id) {
          setSurveyMeta({
            id: Number(data.id),
            title: String(data.title || ""),
            description: typeof data.description === "string" ? data.description : null,
          });
        } else {
          setSurveyMeta(null);
        }
      } catch {
        if (mounted) setSurveyMeta(null);
      }
    };

    fetchDept();
    fetchQuestions();
    fetchSurveyMeta();

    return () => {
      mounted = false;
    };
  }, [departmentCode]);

  /* ------------- Computed -------------- */
  const ratingQuestions = useMemo(() => questions.filter(isRating), [questions]);
  const ratingQuestionsCount = ratingQuestions.length;

  const answeredRatingCount = useMemo(() => {
    let c = 0;
    for (const q of ratingQuestions) {
      const v = answers[q.id]?.rating;
      if (isValidRating(v)) c++;
    }
    return c;
  }, [ratingQuestions, answers]);

  const remainingRatings = Math.max(ratingQuestionsCount - answeredRatingCount, 0);
  const ratingsOk = ratingQuestions.every((q) => isValidRating(answers[q.id]?.rating));
  const groupOk = userGroup.trim().length > 0;

  const canSubmit = useMemo(() => {
    if (loading || submitting || questions.length === 0) return false;
    if (!groupOk || !ratingsOk) return false;
    if (submitted) return false;
    return true;
  }, [groupOk, ratingsOk, loading, submitting, questions.length, submitted]);

  const progressPct =
    ratingQuestionsCount === 0
      ? 0
      : Math.round((answeredRatingCount / ratingQuestionsCount) * 100);

  /* ------------- Handlers -------------- */
  const setRating = useCallback((qid: number, value: number) => {
    const v = Math.max(1, Math.min(5, Math.trunc(value)));
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], rating: v } }));
  }, []);

  const setComment = useCallback((qid: number, value: string) => {
    setAnswers((prev) => ({ ...prev, [qid]: { ...prev[qid], comment: value } }));
  }, []);

  const resetAllAndStartOver = () => {
    const next: AnswerMap = {};
    for (const q of questions) {
      next[q.id] = {
        rating: isRating(q) ? undefined : undefined,
        comment: isText(q) ? "" : undefined,
      };
    }
    setAnswers(next);
    setUserGroup("");
    setSubmitted(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async () => {
    setMessage("");

    if (!departmentCode) {
      setMessage("❌ ไม่พบรหัสหน่วยงานในลิงก์");
      return;
    }
    if (!groupOk || !ratingsOk || questions.length === 0 || loading || submitting || submitted) {
      setMessage("❌ เลือกกลุ่มผู้ใช้และให้คะแนนครบทุกข้อก่อนส่ง");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        survey_id: SURVEY_ID,
        department_code: departmentCode,
        user_group: userGroup,
        answers: questions.map((q) => {
          const base = { question_id: q.id };
          if (isRating(q)) {
            const r = answers[q.id]?.rating;
            return { ...base, rating: isValidRating(r) ? r : undefined };
          }
          return { ...base, comment: answers[q.id]?.comment ?? "" };
        }),
      };

      await axios.post(`/api/submit-response`, payload);

      // นำทางไปหน้าขอบคุณ (คงไว้ตามที่ตั้งใจ)
      router.replace(
        `/survey/thanks?dept=${encodeURIComponent(departmentCode)}&survey=${SURVEY_ID}`
      );
      return; // ป้องกัน setState ต่อจากนี้

    } catch (err: any) {
      const apiErr = err?.response?.data?.error;
      setMessage(`❌ ${apiErr || "เกิดข้อผิดพลาดในการส่งแบบประเมิน"}`);
    } finally {
      setSubmitting(false);
    }
  };

  /* ------------- UI (Mobile-first, ป้องกันบัง) -------------- */
  return (
    // คอนเทนเนอร์หลักเป็น scroll container
    <div className="h-dvh overflow-y-auto overflow-x-hidden overscroll-contain relative text-slate-900 bg-gradient-to-b from-sky-50 via-white to-slate-50">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-sky-100/80 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/70">
        <div className="mx-auto w-full max-w-screen-xl px-3 sm:px-4 md:px-5 py-3 sm:py-4">
          <div className="flex items-start sm:items-center gap-3">
            <div className="relative h-9 w-9 sm:h-10 sm:w-10 rounded-xl overflow-hidden ring-1 ring-sky-100 bg-white shrink-0">
              <Image
                src="/logos/rmu.png"
                alt="University Logo"
                fill
                sizes="40px"
                className="object-contain p-1.5"
                priority
              />
            </div>

            <div className="min-w-0 flex-1">
              {/* หัวข้อ: บนจอเล็กตัดคำและขึ้นบรรทัด, จอใหญ่ค่อย truncate */}
              <h1
                className="
                  font-extrabold tracking-tight leading-snug
                  text-[clamp(1rem,3.8vw,1.25rem)] text-slate-800
                  break-words whitespace-normal
                  sm:whitespace-nowrap sm:truncate
                "
              >
                {surveyTitle}
              </h1>

              <p className="text-[12px] sm:text-sm text-slate-600 break-words">
                {surveyDesc ? (
                  <span className="block sm:inline">{surveyDesc}</span>
                ) : (
                  <>
                    หน่วยงาน:{" "}
                    <span className="font-semibold text-slate-800">
                      {departmentName || departmentCode || "-"}
                    </span>
                  </>
                )}
              </p>
            </div>

            {/* ชิปความคืบหน้า: แสดงเฉพาะจอ >= sm */}
            <span
              className="hidden sm:inline-flex items-center gap-2 text-[11px] sm:text-xs rounded-full border border-sky-200 bg-sky-50 text-sky-700 px-3 py-1 shrink-0"
              aria-live="polite"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-sky-500" />
              {answeredRatingCount}/{ratingQuestionsCount}
            </span>
          </div>
        </div>
        <div className="h-px w-full bg-gradient-to-r from-sky-200/70 via-transparent to-sky-200/70" />
      </header>

      {/* Main content */}
      <main
        className="
          mx-auto w-full max-w-screen-xl
          px-3 sm:px-4 md:px-5
          pt-4 sm:pt-6
          pb-[calc(96px+env(safe-area-inset-bottom))]
          /* ↑ เผื่อพื้นที่ footer (มือถือ) ไม่ให้บังฟอร์ม */
        "
      >
        {/* Group + progress card */}
        <section className="mb-4 sm:mb-6">
          <div className="rounded-2xl border border-sky-100 bg-white shadow-sm overflow-hidden ring-1 ring-white/50 backdrop-blur">
            <div className="p-3 sm:p-4 md:p-6">
              <div className="grid gap-4 md:grid-cols-2">
                {/* User group */}
<div id="userGroupWrap" className="scroll-mt-28">
  <label className="block text-[13px] sm:text-sm font-medium text-slate-800 mb-1">
    กลุ่มผู้ใช้ <span className="text-rose-600">*</span>
  </label>

  <select
    id="userGroup"
    disabled={submitted}
    className="
      w-full rounded-xl border border-slate-200 bg-white
      focus:border-sky-500 focus:ring-sky-500
      h-11 px-3 text-[15px]
      disabled:bg-slate-100
      relative z-[60]   /* ให้ลอยเหนือคอมโพเนนต์อื่น ๆ */
    "
    value={userGroup}
    onChange={(e) => setUserGroup(e.target.value)}
    /* เลื่อนตัวเองขึ้นกลางจอหนี footer */
    onFocus={() => {
      document.getElementById("userGroupWrap")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }}
    onClick={() => {
      // บางเบราว์เซอร์จะเปิดลิสต์ตอน click มากกว่า focus
      document.getElementById("userGroupWrap")
        ?.scrollIntoView({ block: "center", behavior: "smooth" });
    }}
  >
    <option value="">-- เลือกกลุ่ม --</option>
    {USER_GROUPS.map((g) => (
      <option key={g} value={g}>{g}</option>
    ))}
  </select>

  {!userGroup && !submitted && (
    <p className="mt-1.5 text-[12px] text-slate-500">
      กรุณาเลือกกลุ่มผู้ใช้งานก่อนส่งแบบประเมิน
    </p>
  )}
</div>


                {/* Progress */}
                <div className="flex flex-col justify-end">
                  <label className="block text-[13px] sm:text-sm font-medium text-slate-800 mb-1">
                    ความคืบหน้าให้คะแนน
                  </label>
                  <div className="w-full bg-slate-100 rounded-full h-2 sm:h-2.5 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-sky-600 transition-[width] duration-300"
                      style={{ width: `${progressPct}%` }}
                    />
                  </div>
                  <div className="mt-1 text-[11px] sm:text-xs text-slate-500 flex items-center justify-between">
                    <span>
                      {answeredRatingCount}/{ratingQuestionsCount} ข้อ
                    </span>
                    <span>{progressPct}%</span>
                  </div>
                </div>
              </div>
            </div>

            {!submitted && remainingRatings > 0 && (
              <div className="border-t border-amber-200 bg-amber-50 text-amber-700 text-[12px] sm:text-sm px-3 sm:px-4 md:px-6 py-2.5">
                ยังเหลือข้อให้คะแนนอีก {remainingRatings} ข้อก่อนส่ง
              </div>
            )}
          </div>
        </section>

        {/* States */}
        {loading && <QuestionSkeletonList />}

        {!loading && fetchError && (
          <div
            className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 p-4 text-[13px] sm:text-sm"
            role="alert"
          >
            {fetchError}
          </div>
        )}

        {!loading && !fetchError && questions.length === 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-700 p-4 text-[13px] sm:text-sm">
            ยังไม่มีคำถามสำหรับแบบประเมินนี้
          </div>
        )}

        {/* Questions */}
        {!loading &&
          !fetchError &&
          questions.map((q, idx) => (
            <QuestionCard
              key={q.id}
              index={idx}
              question={q}
              value={answers[q.id]}
              onRating={(val) => setRating(q.id, val)}
              onComment={(val) => setComment(q.id, val)}
              disabled={submitted}
            />
          ))}

        {/* Message */}
        {message && (
          <div
            aria-live="polite"
            className={`mt-4 sm:mt-6 rounded-xl border p-4 text-[13px] sm:text-sm ${
              message.startsWith("✅")
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : message.startsWith("❌")
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            {message}
          </div>
        )}
      </main>

      {/* Bottom Sheet (ไม่บังคอนเทนต์: main เผื่อพื้นที่แล้ว) */}
      <footer className="fixed bottom-0 inset-x-0 z-40 border-t border-slate-200 bg-white/90 backdrop-blur shadow-[0_-4px_12px_rgba(0,0,0,0.06)]">
        <div
          className="
            mx-auto w-full max-w-screen-xl
            px-3 sm:px-4 md:px-5
            pt-2 pb-[calc(10px+env(safe-area-inset-bottom))]
            flex flex-col sm:flex-row gap-2 sm:gap-3 sm:items-center sm:justify-between
          "
        >
          <div className="text-[12px] sm:text-sm text-slate-700">
            {submitted ? (
              <span className="inline-flex items-center gap-2 text-emerald-700">
                ส่งแบบประเมินเรียบร้อยแล้ว ขอบคุณครับ
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            ) : canSubmit ? (
              <span className="inline-flex items-center gap-2">
                พร้อมส่งแบบประเมิน
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                เลือกกลุ่มผู้ใช้และให้คะแนนครบทุกข้อก่อนส่ง
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
              </span>
            )}
          </div>

          {submitted ? (
            <div className="flex flex-col xs:flex-row gap-2">
              <a
                href={`/survey/${departmentCode}`}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 border text-slate-700 hover:bg-slate-50"
              >
                โหลดหน้าใหม่
              </a>
              <button
                onClick={resetAllAndStartOver}
                className="inline-flex items-center justify-center rounded-xl px-5 py-3 bg-sky-600 hover:bg-sky-700 text-white"
              >
                ทำแบบใหม่อีกครั้ง
              </button>
            </div>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className={`
                w-full sm:w-auto inline-flex items-center justify-center
                rounded-xl px-5 py-3 text-white shadow-sm transition
                focus:outline-none focus:ring-2 focus:ring-offset-2
                text-[15px]
                ${canSubmit ? "bg-sky-600 hover:bg-sky-700 focus:ring-sky-500" : "bg-slate-300 cursor-not-allowed"}
              `}
            >
              {submitting ? "กำลังส่ง..." : "ส่งแบบประเมิน"}
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}

/* ============== Subcomponents ============== */
function QuestionCard({
  index,
  question,
  value,
  onRating,
  onComment,
  disabled,
}: {
  index: number;
  question: Question;
  value?: { rating?: number; comment?: string };
  onRating: (val: number) => void;
  onComment: (val: string) => void;
  disabled?: boolean;
}) {
  return (
    <section
      className="
        rounded-2xl border border-sky-100 bg-white shadow-sm
        p-3 sm:p-4 md:p-6 mb-3 sm:mb-4 md:mb-5
        ring-1 ring-white/50 backdrop-blur
        focus-within:ring-2 focus-within:ring-sky-200
      "
    >
      <p className="font-semibold text-slate-900 text-[clamp(1rem,2.8vw,1.06rem)] leading-6 break-words">
        {index + 1}. {question.text}
      </p>

      {isRating(question) ? (
        <StarRating value={value?.rating} onChange={onRating} disabled={disabled} />
      ) : (
        <div className="mt-3">
          <label className="sr-only">ความคิดเห็น</label>
          <textarea
            disabled={disabled}
            className="
              w-full rounded-xl border border-slate-200
              focus:border-sky-500 focus:ring-sky-500
              p-3 min-h-[116px]
              text-[15px]
              bg-white disabled:bg-slate-100
            "
            placeholder="เขียนความคิดเห็นเพิ่มเติม"
            value={value?.comment ?? ""}
            onChange={(e) => onComment(e.target.value)}
            maxLength={800}
          />
          <div className="mt-1 text-[12px] text-slate-500">
            {`${(value?.comment?.length ?? 0)}/800`} อักษร
          </div>
        </div>
      )}

      {isRating(question) && (
        <div className="mt-2 hidden md:flex text-[11px] text-slate-500 items-center gap-3">
          <span>1 = ควรปรับปรุงมาก</span>
          <span className="h-1 w-px bg-slate-200" />
          <span>3 = ปานกลาง</span>
          <span>5 = ดีเยี่ยม</span>
        </div>
      )}
    </section>
  );
}

function StarRating({
  value,
  onChange,
  disabled,
}: {
  value?: number;
  onChange: (val: number) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      onChange(Math.min((value ?? 0) + 1, 5));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      onChange(Math.max((value ?? 0) - 1, 1));
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(value ?? 3);
    }
  };

  return (
    <div className="mt-3">
      <div
        ref={containerRef}
        className="grid grid-cols-5 gap-2 sm:flex sm:flex-wrap sm:gap-2.5"
        role="radiogroup"
        aria-label="ให้คะแนน 1-5 ดาว"
        tabIndex={disabled ? -1 : 0}
        onKeyDown={handleKeyDown}
        aria-disabled={disabled || undefined}
      >
        {[1, 2, 3, 4, 5].map((n) => {
          const active = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={!!disabled}
              onClick={() => !disabled && onChange(n)}
              className={`
                rounded-2xl border transition select-none
                inline-flex items-center justify-center gap-2
                focus:outline-none focus:ring-2 focus:ring-offset-2
                text-[15px] min-h-[46px] min-w-[3.25rem] px-3
                sm:min-w-[3.5rem] md:min-w-[3.75rem] lg:min-w-[4rem]
                ${active
                  ? "bg-yellow-100 border-yellow-300 text-yellow-900 focus:ring-yellow-400"
                  : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 focus:ring-slate-300"}
                ${disabled ? "opacity-60 cursor-not-allowed" : ""}
              `}
            >
              <span aria-hidden className="text-base md:text-[17px] lg:text-[18px]">⭐</span>
              <span className="font-medium">{n}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ============== Skeleton ============== */
function QuestionSkeletonList() {
  return (
    <div className="space-y-2.5 sm:space-y-3 md:space-y-4">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl border border-sky-100 bg-white p-3 sm:p-4 md:p-6 shadow-sm animate-pulse"
        >
          <div className="h-4 w-3/4 bg-slate-200/70 rounded" />
          <div className="mt-4 grid grid-cols-5 gap-2 sm:flex sm:flex-wrap sm:gap-2.5">
            {[...Array(5)].map((__, j) => (
              <div
                key={j}
                className="h-[46px] w-full sm:w-[3.5rem] md:w-[3.75rem] lg:w-[4rem] bg-slate-100 rounded-2xl"
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
