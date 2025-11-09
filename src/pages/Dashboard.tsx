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
import { apiGetMedical, apiLogout } from "@/lib/api";

/* ============================== Types (match backend) ============================== */
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
type AiInsight = { message: string; meta?: Record<string, unknown> };

/* ============================== Design tokens ============================== */
const brand = { green: "#0E6B43", accent: "#97FC4A", secondary: "#0D16D1" };
const DATE_OPTIONS = ["الكل", "الأسبوع الأخير"];

/* ====================================================================== */
export default function Dashboard() {
  const navigate = useNavigate();

  // Filters
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [q, setQ] = useState<string>("");

  // Data
  const [rows, setRows] = useState<MedicalRow[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);

  // State
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // AI (placeholder)
  const [aiLoading, setAiLoading] = useState<boolean>(false);
  const [ai, setAi] = useState<AiInsight | null>(null);

  /* --------------------------- Load from backend --------------------------- */
  useEffect(() => {
    let cancel = false;

    async function load() {
      try {
        setLoading(true);
        setError(null);
        setAi(null);

        const params: Record<string, string | boolean> = {};
        if (selDate === "الأسبوع الأخير") params["last_week"] = true;
        if (selDoctor !== "الكل") params["doctor"] = selDoctor;

        const data = (await apiGetMedical(params)) as RecordsResponse;
        if (cancel) return;

        const list = data.records || [];
        setRows(list);

        const uniq = Array.from(
          new Set(list.map((r) => r.doctor_name).filter(Boolean))
        );
        setDoctors(uniq);
      } catch (e: any) {
        if (!cancel) {
          const msg = extractErr(e);
          // لا نعرض أخطاء HTML (مثل <DOCTYPE>) كتنبيه أحمر
          if (!/<!doctype/i.test(msg || ""))
            setError(msg || "فشل تحميل البيانات");
        }
      } finally {
        if (!cancel) setLoading(false);
      }
    }

    load();
    return () => {
      cancel = true;
    };
  }, [selDate, selDoctor]);

  /* --------------------------- Quick client filter --------------------------- */
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

  /* --------------------------- Simple bar data --------------------------- */
  const chartData = useMemo(() => {
    const by: Record<string, number> = {};
    filtered.forEach((r) => (by[r.doctor_name] = (by[r.doctor_name] ?? 0) + 1));
    return Object.entries(by).map(([label, value]) => ({ label, value }));
  }, [filtered]);
  const maxVal = useMemo(
    () => chartData.reduce((m, c) => Math.max(m, c.value), 0) || 1,
    [chartData]
  );

  /* --------------------------- AI (placeholder only) --------------------------- */
  async function runAi() {
    try {
      setAiLoading(true);
      setAi({
        message:
          "ميزة التحليل الذكي ستُفعّل لاحقًا بعد إضافة مسار /ai/analyze في الباك-إند.",
      });
    } finally {
      setAiLoading(false);
    }
  }

  async function doLogout() {
    try {
      await apiLogout();
    } catch {}
    navigate("/", { replace: true });
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, #F5F7FB 0%, #E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,0.15), transparent 60%)",
      }}
    >
      <div className="grid grid-cols-[260px_1fr]">
        {/* Sidebar (يمين) */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col">
          <div className="absolute top-5 right-5">
            <img src={logo} alt="شعار حصيف" className="w-10 drop-shadow-sm" />
          </div>

          <nav className="px-5 pt-20 space-y-2">
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
              label="الإشعارات"
              onClick={() => navigate("/notifications")}
            />
            <SideItem
              icon={<MessageSquareCode className="size-4" />}
              label="مساعد ذكي"
              onClick={() => navigate("/chat")}
            />
          </nav>

          <div className="mt-auto px-5 pb-6">
            <button
              onClick={doLogout}
              className="w-full flex items-center justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5 transition"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="py-6 md:py-8 relative" dir="rtl">
          <div className="mx-auto w-full max-w-[1180px] px-3 md:px-5">
            {/* زر الرجوع للهوم */}
            <button
              onClick={() => navigate("/home")}
              className="absolute top-5 right-[300px] p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition"
              title="العودة للصفحة الرئيسية"
            >
              <Home className="size-5" style={{ color: brand.green }} />
            </button>

            {/* العنوان والفلترة */}
            <div className="mb-3 flex items-center justify-between">
              <h2
                className="text-xl md:text-2xl font-semibold"
                style={{ color: brand.green }}
              >
                السجلات الطبية
              </h2>
            </div>

            {/* شريط الفلاتر + البحث (نحيف) */}
            <div className="flex flex-wrap items-end gap-3">
              <Dropdown
                label="التاريخ"
                value={selDate}
                onChange={setSelDate}
                options={DATE_OPTIONS}
              />
              <Dropdown
                label="الطبيب"
                value={selDoctor}
                onChange={setSelDoctor}
                options={["الكل", ...doctors]}
              />

              <div className="relative flex-1 min-w-[240px] max-w-[540px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full h-9 rounded-full border border-black/10 bg-white pl-9 pr-4 outline-none placeholder:text-black/50 text-sm focus:ring-4 focus:ring-emerald-300/30"
                  placeholder="ابحث باسم الطبيب، المريض، ICD10…"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
              </div>
            </div>

            {/* خطأ (مخفى لو HTML) */}
            {error && (
              <div className="mt-3 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-sm">
                <TriangleAlert className="size-4" />
                <span>{error}</span>
              </div>
            )}

            {/* KPIs صغيرة */}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3 md:max-w-[760px]">
              <StatPill
                title="عدد السجلات"
                value={filtered.length}
                bg="#E7EAFE"
                text={brand.secondary}
              />
              <StatPill
                title="عدد الأطباء"
                value={new Set(filtered.map((r) => r.doctor_name)).size}
                bg="#CDEFE3"
                text="#1B4D3B"
              />
              <StatPill
                title="عدد التنبيهات"
                value={"0"}
                bg="#E0F6CF"
                text="#173E1C"
              />
            </div>

            {/* الرسم + بطاقة AI */}
            <div className="mt-4 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-4">
              <Card className="shadow-soft">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">
                    عدد السجلات لكل طبيب
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="h-[180px] rounded-lg border border-black/10 bg-white overflow-hidden">
                    <div className="h-full w-full p-3">
                      {loading ? (
                        <div className="h-full w-full animate-pulse rounded bg-black/5" />
                      ) : filtered.length === 0 ? (
                        <div className="h-full w-full grid place-items-center text-black/50 text-xs">
                          لا توجد بيانات مطابقة للفلاتر الحالية
                        </div>
                      ) : (
                        <div className="h-full flex items-end justify-between gap-2">
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
                                <div className="text-[11px] text-black/70 mb-1">
                                  {c.value}
                                </div>
                                <div
                                  className="w-6 md:w-7 rounded-t bg-gradient-to-t from-[#4C4DE9] to-[#9AA0FF] transition-[height] duration-500 ease-out"
                                  style={{ height: `${h}%` }}
                                  title={`${c.label}: ${c.value}`}
                                />
                                <div className="mt-1 text-[10px] text-black/60 text-center truncate w-full">
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

              <div className="rounded-2xl shadow-ai overflow-hidden min-h-[180px]">
                <div
                  className="h-full p-5 text-white flex flex-col justify-between"
                  style={{
                    background:
                      "linear-gradient(135deg, #2B2D6B 0%, #4C4DE9 42%, #0D16D1 100%)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">تحليل</span>
                      <Bot className="size-5 text-white" />
                    </div>
                    <button
                      className="h-8 px-4 rounded-full bg-white text-[#0D16D1] text-xs font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                      type="button"
                      onClick={runAi}
                      disabled={aiLoading || loading}
                    >
                      {aiLoading ? "جاري التحليل..." : "تشغيل"}
                    </button>
                  </div>

                  <div className="mt-4 flex-1 flex items-center justify-center leading-relaxed">
                    {ai ? (
                      <p className="text-white/95 text-center text-sm">
                        {ai.message}
                      </p>
                    ) : (
                      <p className="text-white/90 text-center text-sm">
                        اضغطي «تشغيل» لتحليل أنماط السجلات وفق الفلاتر الحالية.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* الجدول المدمج */}
            <Card className="mt-5 shadow-soft">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full table-fixed" dir="rtl">
                    <thead>
                      <tr className="text-right text-black/70 text-[12.5px]">
                        <Th w="56px">#</Th>
                        <Th w="150px">اسم الطبيب</Th>
                        <Th w="160px">اسم المريض</Th>
                        <Th w="120px">تاريخ العلاج</Th>
                        <Th w="110px">رمز ICD10</Th>
                        <Th w="220px">الشكوى الرئيسية</Th>
                        <Th w="220px">الأعراض/العلامات</Th>
                        <Th w="110px">نوع المطالبة</Th>
                        <Th w="90px">إحالة</Th>
                        <Th w="90px">طوارئ</Th>
                        <Th w="130px">العقد</Th>
                      </tr>
                    </thead>
                    <tbody className="text-[13px]">
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
                              i % 2 === 1 && "bg-black/[0.02]"
                            )}
                          >
                            <Td>{i + 1}</Td>
                            <Td className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.doctor_name}
                            </Td>
                            <Td className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.patient_name}
                            </Td>
                            <Td className="whitespace-nowrap">
                              {r.treatment_date}
                            </Td>
                            <Td
                              className="uppercase whitespace-nowrap overflow-hidden text-ellipsis"
                              title={r.ICD10CODE}
                            >
                              {r.ICD10CODE}
                            </Td>
                            <Td
                              className="capitalize whitespace-nowrap overflow-hidden text-ellipsis"
                              title={r.chief_complaint}
                            >
                              {r.chief_complaint}
                            </Td>
                            <Td
                              className="capitalize whitespace-nowrap overflow-hidden text-ellipsis"
                              title={r.significant_signs}
                            >
                              {r.significant_signs}
                            </Td>
                            <Td className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.claim_type}
                            </Td>
                            <Td className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.refer_ind}
                            </Td>
                            <Td className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.emer_ind}
                            </Td>
                            <Td className="capitalize whitespace-nowrap overflow-hidden text-ellipsis">
                              {r.contract}
                            </Td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================== Subcomponents ============================== */

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
        active
          ? "text-[#0D16D1] border border-black/10 bg-[#97FC4A]"
          : "hover:bg-black/5"
      )}
    >
      <span className="font-medium text-sm">{label}</span>
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
    <div className="relative" ref={ref}>
      <label className="text-xs text-black/60 pr-1 block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-9 min-w-[110px] rounded-full bg-[#0E6B43] text-white font-semibold px-4 flex items-center justify-between text-[13px] shadow-md hover:bg-[#0f7d4d] transition"
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
      className="rounded-2xl px-4 py-3 shadow-soft h-14 flex flex-col justify-center"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="text-xs opacity-80">{title}</div>
      <div className="text-lg font-semibold leading-tight">{value}</div>
    </div>
  );
}

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th
      className="px-3 py-2.5 border-b border-black/10 font-medium bg-white sticky top-0 z-[1]"
      style={{ width: w }}
    >
      {children}
    </th>
  );
}
function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <td className={clsx("px-3 py-2 align-middle", className)}>{children}</td>
  );
}

/* ============================== Helpers ============================== */
function extractErr(e: any): string | null {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e.message) {
    try {
      const j = JSON.parse(e.message);
      if (typeof j === "object")
        return (j as any).detail || (j as any).error || e.message;
    } catch {
      return e.message;
    }
  }
  return null;
}
