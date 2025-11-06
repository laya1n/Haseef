// src/pages/Insurance.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
  Bell,
  UserRound,
  Bot,
  Plus,
  Shield,
  Pill,
  BellRing,
  MessageSquareCode,
  LogOut,
  Search,
  Loader2,
  TriangleAlert,
  Home,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";

/* ============================== أنواع البيانات ============================== */
type Claim = {
  id: number;
  patient: string;
  insurer: string;
  diagnosis: string;
  action: string;
  status: "مرفوض" | "غير واضح" | "مقبول" | "يحتاج مراجعة";
  manager: string;
  note: string;
  date?: string;
};

type AiInsight = {
  message: string;
  meta?: Record<string, unknown>;
};

/* ============================== إعدادات API ============================== */
// ضعي قيمة الدومين في بيئة Vite: VITE_API_BASE_URL=https://your-api.example.com
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const ENDPOINTS = {
  claims: "/api/insurance/claims",
  analyze: "/api/ai/insurance/analyze",
};

/* ============================== أدوات مساعدة ============================== */
async function httpGet<T>(path: string, params?: Record<string, string>) {
  // نضمن عنوانًا مطلقًا بتمرير origin
  const url = new URL(BASE_URL + path || path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== "" && v !== "الكل") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function httpPost<T>(path: string, body: unknown) {
  const res = await fetch(BASE_URL + path || path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

/* ============================== ثابتات الواجهة ============================== */
const statuses = ["الكل", "مرفوض", "غير واضح", "مقبول", "يحتاج مراجعة"];
const dates = ["الكل", "الأسبوع الأخير"];

const brand = {
  green: "#0E6B43",
  greenHover: "#0f7d4d",
  accent: "#97FC4A",
  secondary: "#0D16D1",
};

/* ------------------------------ الصفحة ------------------------------ */
export default function Insurance() {
  const navigate = useNavigate();

  // فلاتر + بحث
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selStatus, setSelStatus] = useState<string>("الكل");
  const [selInsurer, setSelInsurer] = useState<string>("الكل");
  const [q, setQ] = useState<string>("");

  // بيانات قادمة من الخادم
  const [claims, setClaims] = useState<Claim[]>([]);
  const [insurers, setInsurers] = useState<string[]>([]);

  // حالات
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [ai, setAi] = useState<AiInsight | null>(null);

  /* --------------------------- تحميل البيانات --------------------------- */
  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setAi(null);

        // يفضّل أن يرجع الخادم { items: Claim[], insurers?: string[] }
        const data = await httpGet<{ items: Claim[]; insurers?: string[] }>(
          ENDPOINTS.claims,
          {
            dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
            status: selStatus,
            insurer: selInsurer,
            q: q.trim(),
          }
        );

        if (cancel) return;
        const items = data.items || [];
        setClaims(items);

        // إن لم يرجع الخادم قائمة شركات؛ نستنتجها من النتائج
        const uniqIns = data.insurers?.length
          ? data.insurers
          : Array.from(new Set(items.map((c) => c.insurer))).sort();
        setInsurers(uniqIns);
      } catch (e: any) {
        if (!cancel) setError(e?.message || "فشل تحميل البيانات");
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    load();
    return () => {
      cancel = true;
    };
  }, [selDate, selStatus, selInsurer, q]);

  /* --------------------------- تصفية محلية احتياطية --------------------------- */
  const filtered = useMemo(() => {
    if (!q.trim()) return claims;
    const s = q.trim();
    return claims.filter(
      (c) =>
        c.patient.includes(s) ||
        c.insurer.includes(s) ||
        c.diagnosis.includes(s) ||
        c.action.includes(s) ||
        c.note.includes(s) ||
        c.manager.includes(s) ||
        (c.date ?? "").includes(s)
    );
  }, [claims, q]);

  /* --------------------------- بيانات الشارت --------------------------- */
  const chartData = useMemo(() => {
    // عدد الرفض لكل شركة من النتائج المُفلترة
    const by: Record<string, number> = {};
    insurers.forEach((i) => (by[i] = 0));
    filtered.forEach((c) => {
      if (c.status === "مرفوض") by[c.insurer] = (by[c.insurer] ?? 0) + 1;
    });
    return insurers.map((i) => ({ label: i, value: by[i] ?? 0 }));
  }, [filtered, insurers]);

  const totalRejected =
    chartData.reduce(
      (s, d) => s + (Number.isFinite(d.value) ? d.value : 0),
      0
    ) || 1;

  /* --------------------------- تشغيل تحليل AI --------------------------- */
  async function runAi() {
    try {
      setAiLoading(true);
      setAi(null);
      const res = await httpPost<AiInsight>(ENDPOINTS.analyze, {
        filters: {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          status: selStatus,
          insurer: selInsurer,
          q: q.trim(),
        },
        context: filtered,
      });
      setAi(res);
    } catch (e: any) {
      setAi({
        message:
          "تعذّر تشغيل التحليل الآن. تأكدي من مسار خدمة الذكاء الاصطناعي أو راجعي السجلات.",
        meta: { error: e?.message },
      });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, #F5F7FB 0%, #E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,0.15), transparent 60%)",
      }}
    >
      <div className="grid grid-cols-[280px_1fr]">
        {/* الشريط الجانبي */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
          {/* الشعار في الزاوية العلوية اليمنى */}
          <div className="absolute top-4 right-4">
            <img
              src={logo}
              alt="شعار حصيف الذكي"
              className="w-10 md:w-12 drop-shadow-sm select-none"
            />
          </div>

          {/* محتوى القائمة */}
          <div className="p-6 pt-20 space-y-4 flex-1">
            <nav className="px-4 space-y-2">
              <SideItem
                icon={<Plus className="size-4" />}
                label="السجلات الطبية"
                onClick={() => navigate("/dashboard")}
              />
              <SideItem
                active
                icon={<Shield className="size-4" />}
                label="السجلات التأمينية"
              />
              <SideItem
                icon={<Pill className="size-4" />}
                label="سجلات الأدوية"
                onClick={() => navigate("/drugs")}
              />
              <SideItem
                icon={<BellRing className="size-4" />}
                label="الاشعارات"
                onClick={() => navigate("/notifications")}
              />
              <SideItem
                icon={<MessageSquareCode className="size-4" />}
                label="المساعد ذكي"
                onClick={() => navigate("/chat")}
              />
            </nav>
          </div>

          <div className="mt-auto px-4 pt-10 pb-6">
            <button
              onClick={() => {
                localStorage.removeItem("haseef_auth");
                sessionStorage.removeItem("haseef_auth");
                navigate("/");
              }}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* المحتوى الرئيسي */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* زر الرجوع للهوم (أيقونة فقط) */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition"
            title="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          {/* الهيدر */}
          <div className="flex items-center justify-between gap-4 mt-2">
            {/* العنوان + الأيقونات */}
            <div className="flex items-center gap-3">
              <div
                className="text-xl md:text-2xl font-semibold"
                style={{ color: brand.green }}
              >
                السجلات التأمينية
              </div>
            </div>

            {/* البحث */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                placeholder="ابحث..."
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>

            {/* الفلاتر */}
            <div className="flex items-end gap-2">
              <Dropdown
                label="حالة الطلب"
                value={selStatus}
                onChange={setSelStatus}
                options={statuses}
              />
              <Dropdown
                label="شركة التأمين"
                value={selInsurer}
                onChange={setSelInsurer}
                options={["الكل", ...insurers]}
              />

              <Dropdown
                label="التاريخ"
                value={selDate}
                onChange={setSelDate}
                options={dates}
              />
            </div>
          </div>

          {/* رسائل الحالة */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* الإحصاءات */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 md:max-w-[760px]">
            <StatPill
              title="عدد المطالبات"
              value={filtered.length}
              bg="#D9DBFF"
              text={brand.secondary}
            />
            <StatPill
              title="عدد شركات التأمين"
              value={insurers.length}
              bg="#CDEFE3"
              text="#1B4D3B"
            />
            <StatPill
              title="عدد التنبيهات"
              value={"—"}
              bg="#E0F6CF"
              text="#173E1C"
            />
          </div>

          {/* التحليل + الشارت */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
            {/* بطاقة الذكاء الاصطناعي */}
            <div className="rounded-2xl shadow-ai overflow-hidden">
              <div
                className="min-h-[260px] h-full p-6 text-white flex flex-col justify-between"
                style={{
                  background:
                    "linear-gradient(135deg, #2B2D6B 0%, #4C4DE9 42%, #0D16D1 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">تحليل</span>
                    <Bot className="size-5 text-white" />
                  </div>

                  <button
                    className="h-9 px-4 rounded-full bg-white text-[#0D16D1] text-sm font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    type="button"
                    onClick={runAi}
                    disabled={aiLoading || loading}
                  >
                    {aiLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> جاري التحليل
                      </span>
                    ) : (
                      "تشغيل"
                    )}
                  </button>
                </div>

                <div className="mt-6 flex-1 flex items-center justify-center leading-relaxed">
                  {ai ? (
                    <p className="text-white/95 text-center">{ai.message}</p>
                  ) : (
                    <p className="text-white/90 text-center">
                      اضغطي «تشغيل» لتحليل أنماط الرفض وفق الفلاتر الحالية.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* الشارت الأخضر */}
            <Card className="shadow-soft">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">نسبة الرفض</CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="relative rounded-xl border border-black/10 overflow-hidden min-h-[260px] bg-white">
                  <div className="relative h-full flex flex-col gap-6 px-6 py-6">
                    {loading ? (
                      <div className="h-full w-full animate-pulse rounded-lg bg-black/5" />
                    ) : filtered.length === 0 ? (
                      <div className="h-[200px] grid place-items-center text-black/50 text-sm">
                        لا توجد بيانات مطابقة للفلاتر الحالية
                      </div>
                    ) : (
                      chartData.map((d) => {
                        const percent = Math.round(
                          (d.value / totalRejected) * 100
                        );
                        const width = Math.max(percent, 6);
                        return (
                          <div
                            key={d.label}
                            className="w-full text-right select-none"
                          >
                            <div className="flex items-center gap-3" dir="rtl">
                              <div className="text-sm text-black/70 min-w-[72px]">
                                {d.label}
                              </div>
                              <div className="relative flex-1 h-8 rounded-md bg-[#F6FBF5] overflow-hidden">
                                <div
                                  className="absolute inset-y-0 right-0 rounded-md transition-all duration-500 ease-out"
                                  style={{
                                    width: `${width}%`,
                                    background:
                                      "linear-gradient(90deg, #2E7D32 0%, #7CD67F 100%)",
                                  }}
                                  title={`${d.label}: ${percent}%`}
                                />
                              </div>
                              <div className="text-xs text-black/60 w-10 text-left">
                                {percent}%
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* الجدول */}
          <Card className="mt-6 shadow-soft">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed" dir="rtl">
                  <thead>
                    <tr className="text-right text-black/70 text-sm">
                      <Th w="110px">رقم المطالبة</Th>
                      <Th w="140px">اسم المريض</Th>
                      <Th w="160px">شركة التأمين</Th>
                      <Th w="160px">التشخيص</Th>
                      <Th w="160px">الإجراء المطلوب</Th>
                      <Th w="140px">حالة الطلب</Th>
                      <Th w="120px">المدير</Th>
                      <Th>ملاحظة</Th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-black/5">
                          {Array.from({ length: 8 }).map((__, j) => (
                            <Td key={j}>
                              <div className="h-4 bg-black/10 rounded animate-pulse" />
                            </Td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={8}
                          className="px-4 py-8 text-center text-black/60"
                        >
                          لا توجد سجلات للعرض.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((c, i) => (
                        <tr
                          key={c.id}
                          className={clsx(
                            "border-t border-black/5",
                            i % 2 === 1 && "bg-black/2.5"
                          )}
                        >
                          <Td w="110px">{c.id}</Td>
                          <Td w="140px">{c.patient}</Td>
                          <Td w="160px">{c.insurer}</Td>
                          <Td w="160px">{c.diagnosis}</Td>
                          <Td w="160px">{c.action}</Td>
                          <Td w="140px">{c.status}</Td>
                          <Td w="120px">{c.manager}</Td>
                          <Td className="truncate">{c.note}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

/* ---------------- عناصر فرعية ---------------- */

function SideItem({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors",
        active ? "text-[#0D16D1] border border-black/10" : "hover:bg-black/5"
      )}
      style={active ? { backgroundColor: brand.accent } : {}}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

/** Dropdown مخصص (بديل select) */
function Dropdown({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative min-w-[8rem]" ref={ref}>
      <label className="text-xs text-black/60 pr-1 block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-10 w-full rounded-full bg-[#0E6B43] text-white font-semibold px-4 flex items-center justify-between text-sm shadow-md hover:bg-[#0f7d4d] transition"
      >
        <span className="truncate">{value}</span>
        <svg
          className={clsx("size-4 transition-transform", open && "rotate-180")}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <ul className="absolute mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-right px-4 py-2 text-sm hover:bg-emerald-50",
                  value === opt && "bg-emerald-50 font-semibold text-[#0E6B43]"
                )}
              >
                {opt}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatPill({
  title,
  value,
  bg,
  text = "#111827",
}: {
  title: string;
  value: number | string;
  bg: string;
  text?: string;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-3 shadow-soft"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="text-sm opacity-80 mb-1">{title}</div>
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th
      className="px-4 py-3 border-b border-black/10 font-medium bg-white sticky top-0 z-[1]"
      style={{ width: w }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  w,
  className,
}: {
  children: React.ReactNode;
  w?: string;
  className?: string;
}) {
  return (
    <td
      className={clsx("px-4 py-3 align-middle", className)}
      style={{ width: w }}
    >
      {children}
    </td>
  );
}
