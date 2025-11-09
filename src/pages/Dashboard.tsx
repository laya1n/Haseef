// src/pages/Dashboard.tsx
/// <reference types="vite/client" />
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
  BellRing,
  Bot,
  Home,
  LogOut,
  MessageSquareCode,
  Pill,
  Plus,
  Search,
  Shield,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";
import { apiGet, apiPost } from "@/lib/api";

/* ============================== أنواع البيانات (مطابقة للباك) ============================== */
type MedicalRow = {
  doctor_name: string;
  patient_name: string;
  treatment_date: string;
  ICD10CODE: string;
  chief_complaint: string;
  significant_signs: string;
  claim_type: string;
  refer_ind: string;
  emer_ind: string;
  contract: string;
  ai_analysis?: string;
};

type RecordsResponse = {
  total_records: number;
  total_doctors: number;
  alerts_count: number;
  records: MedicalRow[];
};

type AiInsight = {
  message: string;
  meta?: Record<string, unknown>;
};

/* ============================== ثوابت التصميم ============================== */
const brand = {
  green: "#0E6B43",
  accent: "#97FC4A",
  secondary: "#0D16D1",
};

const ENDPOINTS = {
  records: "/medical/records",
  analyze: "/ai/analyze", // اختياري إن لم تكن مفعّلة تجاهل زر التشغيل
};

const DATE_OPTIONS = ["الكل", "الأسبوع الأخير"];

/* ====================================================================== */
export default function Dashboard() {
  const navigate = useNavigate();

  // فلاتر
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [q, setQ] = useState<string>("");

  // بيانات
  const [rows, setRows] = useState<MedicalRow[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);

  // حالات
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [ai, setAi] = useState<AiInsight | null>(null);

  /* --------------------------- تحميل البيانات من الباك --------------------------- */
  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setAi(null);

        const params: Record<string, string> = {};
        if (selDate === "الأسبوع الأخير") params["last_week"] = "true";
        if (selDoctor !== "الكل") params["doctor"] = selDoctor;

        const data = await apiGet<RecordsResponse>(ENDPOINTS.records, params);
        if (cancel) return;

        const list = data.records || [];
        setRows(list);

        // بناء قائمة الأطباء
        const uniq = Array.from(
          new Set(list.map((r) => r.doctor_name).filter(Boolean))
        );
        setDoctors(uniq);
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
  }, [selDate, selDoctor]);

  /* --------------------------- تصفية محلية سريعة --------------------------- */
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim().toLowerCase();
    return rows.filter((r) =>
      [
        r.doctor_name,
        r.patient_name,
        r.ICD10CODE,
        r.chief_complaint,
        r.significant_signs,
        r.claim_type,
        r.refer_ind,
        r.emer_ind,
        r.contract,
        r.treatment_date,
      ]
        .join(" ")
        .toLowerCase()
        .includes(s)
    );
  }, [rows, q]);

  /* --------------------------- بيانات الرسم --------------------------- */
  const chartData = useMemo(() => {
    const by: Record<string, number> = {};
    filtered.forEach((r) => (by[r.doctor_name] = (by[r.doctor_name] ?? 0) + 1));
    const ordered = Object.entries(by).map(([label, value]) => ({
      label,
      value,
    }));
    return ordered;
  }, [filtered]);

  const maxVal = useMemo(
    () => chartData.reduce((m, c) => Math.max(m, c.value), 0) || 1,
    [chartData]
  );

  /* --------------------------- تشغيل AI (اختياري) --------------------------- */
  async function runAi() {
    try {
      setAiLoading(true);
      setAi(null);
      const res = await apiPost<AiInsight>(ENDPOINTS.analyze, {
        filters: {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          q: q.trim(),
        },
        context: filtered,
      });
      setAi(res);
    } catch (e: any) {
      setAi({
        message:
          "تعذّر تشغيل التحليل الآن. تأكدي من مسار خدمة AI واتصال الخادم.",
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
        {/* Sidebar */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
          {/* الشعار */}
          <div className="absolute top-4 right-4">
            <img
              src={logo}
              alt="شعار حصيف الذكي"
              className="w-10 md:w-12 drop-shadow-sm select-none"
            />
          </div>

          {/* القائمة */}
          <div className="p-6 pt-20 space-y-4 flex-1">
            <nav className="px-4 space-y-2">
              <SideItem
                active
                icon={<Plus className="size-4" />}
                label="السجلات الطبية"
              />
              <SideItem
                icon={<Shield className="size-4" />}
                label="السجلات التأمينية"
                onClick={() => navigate("/insurance")}
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

          {/* خروج */}
          <div className="mt-auto px-4 pt-4 pb-6">
            <button
              onClick={() => {
                localStorage.removeItem("haseef_auth");
                sessionStorage.removeItem("haseef_auth");
                navigate("/");
              }}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5 transition"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* عودة للهوم */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition"
            title="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div
                className="text-xl md:text-2xl font-semibold"
                style={{ color: brand.green }}
              >
                السجلات الطبية
              </div>
            </div>

            {/* البحث */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                placeholder="ابحث باسم الطبيب، المريض، ICD10، أو غيرها…"
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>

            {/* الفلاتر */}
            <div className="flex items-end gap-2">
              <Dropdown
                label="الطبيب"
                value={selDoctor}
                onChange={setSelDoctor}
                options={["الكل", ...doctors]}
              />
              <Dropdown
                label="التاريخ"
                value={selDate}
                onChange={setSelDate}
                options={DATE_OPTIONS}
              />
            </div>
          </div>

          {/* خطأ */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* إحصائيات */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 md:max-w-[760px]">
            <StatPill
              title="عدد السجلات"
              value={filtered.length}
              bg="#D9DBFF"
              text={brand.secondary}
            />
            <StatPill
              title="عدد الأطباء"
              value={doctors.length}
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

          {/* AI + الرسم */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
            {/* بطاقة التحليل */}
            <div className="rounded-2xl shadow-ai overflow-hidden h-full">
              <div
                className="h-full min-h-[260px] p-6 text-white flex flex-col justify-between bg-ai-card"
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
                    {aiLoading ? "جاري التحليل..." : "تشغيل"}
                  </button>
                </div>

                <div className="mt-6 flex-1 flex items-center justify-center leading-relaxed">
                  {ai ? (
                    <p className="text-white/95 text-center">{ai.message}</p>
                  ) : (
                    <p className="text-white/90 text-center">
                      اضغطي «تشغيل» لتحليل أنماط السجلات وفق الفلاتر الحالية.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* الرسم البسيط */}
            <Card className="shadow-soft">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">
                  عدد السجلات لكل طبيب
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-2">
                <div className="h-[260px] rounded-xl border border-black/10 bg-white overflow-hidden">
                  <div className="h-full w-full p-4">
                    {loading ? (
                      <div className="h-full w-full animate-pulse rounded-lg bg-black/5" />
                    ) : filtered.length === 0 ? (
                      <div className="h-full w-full grid place-items-center text-black/50 text-sm">
                        لا توجد بيانات مطابقة للفلاتر الحالية
                      </div>
                    ) : (
                      <div className="h-full flex items-end justify-between gap-4">
                        {chartData.map((c) => {
                          const h = Math.max(
                            6,
                            Math.round((c.value / maxVal) * 100)
                          );
                          return (
                            <div
                              key={c.label}
                              className="flex-1 h-full flex flex-col justify-end items-center"
                            >
                              <div className="text-xs font-medium text-black/80 mb-1">
                                {c.value}
                              </div>
                              <div
                                className="w-7 md:w-8 rounded-t-lg bg-gradient-to-t from-[#4C4DE9] to-[#9AA0FF] transition-all duration-500 ease-out"
                                style={{ height: `${h}%` }}
                                title={`${c.label}: ${c.value}`}
                              />
                              <div className="mt-2 text-[11px] text-black/60 text-center truncate w-full">
                                {c.label}
                              </div>
                            </div>
                          );
                        })}
                      </div>
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
                      <Th w="80px">#</Th>
                      <Th w="140px">اسم الطبيب</Th>
                      <Th w="160px">اسم المريض</Th>
                      <Th w="140px">تاريخ العلاج</Th>
                      <Th w="120px">رمز ICD10</Th>
                      <Th w="200px">الشكوى الرئيسية</Th>
                      <Th w="200px">الأعراض/العلامات</Th>
                      <Th w="120px">نوع المطالبة</Th>
                      <Th w="110px">إحالة</Th>
                      <Th w="110px">طوارئ</Th>
                      <Th w="120px">العقد</Th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-black/5">
                          {Array.from({ length: 11 }).map((__, j) => (
                            <Td key={j}>
                              <div className="h-4 bg-black/10 rounded animate-pulse" />
                            </Td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={11}
                          className="px-4 py-8 text-center text-black/60"
                        >
                          لا توجد سجلات للعرض.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr
                          key={`${r.doctor_name}-${r.patient_name}-${i}`}
                          className={clsx(
                            "border-t border-black/5",
                            i % 2 === 1 && "bg-black/[0.025]"
                          )}
                        >
                          <Td>{i + 1}</Td>
                          <Td>{r.doctor_name}</Td>
                          <Td>{r.patient_name}</Td>
                          <Td>{r.treatment_date}</Td>
                          <Td>{r.ICD10CODE}</Td>
                          <Td className="truncate" title={r.chief_complaint}>
                            {r.chief_complaint}
                          </Td>
                          <Td className="truncate" title={r.significant_signs}>
                            {r.significant_signs}
                          </Td>
                          <Td>{r.claim_type}</Td>
                          <Td>{r.refer_ind}</Td>
                          <Td>{r.emer_ind}</Td>
                          <Td>{r.contract}</Td>
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

/* ============================== مكوّنات فرعية ============================== */

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
