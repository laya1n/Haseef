// src/pages/Dashboard.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";

/* ============================== أنواع البيانات ============================== */
type MedicalRow = {
  id: number;
  doctor: string;
  diagnosis: string;
  drug: string;
  date: string; // ISO e.g. 2025-05-27
  note: string;
};

type AiInsight = {
  message: string; // ملخص بالعربية
  meta?: Record<string, unknown>;
};

/* ============================== إعدادات API ============================== */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const ENDPOINTS = {
  records: "/api/medical/records",
  analyze: "/api/ai/analyze",
};

/* ============================== أدوات مساعدة ============================== */
async function httpGet<T>(path: string, params?: Record<string, string>) {
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

/* ---------- ألوان العلامة ---------- */
const brand = {
  secondary: "#0D16D1",
  accentLight: "#97FC4A",
};

/* خيارات الفلاتر الثابتة */
const dates = ["الكل", "الأسبوع الأخير"];
const patternTypes = [
  "الكل",
  "تكرار التشخيص",
  "تكرار الوصفة",
  "صرف غير مناسب",
  "طبيعي",
];

/* ====================================================================== */
export default function Dashboard() {
  const navigate = useNavigate();

  /* فلاتر */
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selPattern, setSelPattern] = useState<string>("الكل");
  const [q, setQ] = useState<string>("");

  /* بيانات قادمة من الخادم */
  const [rows, setRows] = useState<MedicalRow[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);

  /* حالات */
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  /* AI */
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

        const data = await httpGet<{ items: MedicalRow[] }>(ENDPOINTS.records, {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          pattern: selPattern,
          q: q.trim(),
        });

        if (cancel) return;
        setRows(data.items || []);
        const unique = Array.from(
          new Set((data.items || []).map((r) => r.doctor))
        );
        setDoctors(unique);
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
  }, [selDate, selDoctor, selPattern, q]);

  /* --------------------------- تصفية محلية (اختيارية) --------------------------- */
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim();
    return rows.filter(
      (r) =>
        r.doctor.includes(s) ||
        r.diagnosis.includes(s) ||
        r.drug.includes(s) ||
        r.note.includes(s) ||
        r.date.includes(s)
    );
  }, [rows, q]);

  /* --------------------------- بيانات الشارت --------------------------- */
  const chartData = useMemo(() => {
    const by: Record<string, number> = {};
    doctors.forEach((d) => (by[d] = 0));
    filtered.forEach((r) => (by[r.doctor] = (by[r.doctor] ?? 0) + 1));
    return doctors.map((d) => ({ label: d, value: by[d] ?? 0 }));
  }, [filtered, doctors]);

  const maxVal = useMemo(
    () => chartData.reduce((m, c) => Math.max(m, c.value), 0) || 1,
    [chartData]
  );

  /* --------------------------- تشغيل تحليل AI --------------------------- */
  async function runAi() {
    try {
      setAiLoading(true);
      setAi(null);
      const res = await httpPost<AiInsight>(ENDPOINTS.analyze, {
        filters: {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          pattern: selPattern,
          q: q.trim(),
        },
        context: filtered,
      });
      setAi(res);
    } catch (e: any) {
      setAi({
        message:
          "تعذّر تشغيل التحليل الآن. تأكد من مسار خدمة AI أو راجع السجلات.",
        meta: { error: e?.message },
      });
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF1F8]">
      <div className="grid grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside
          className="min-h-screen border-l bg-white sticky top-0"
          dir="rtl"
        >
          <div className="p-6 pb-4 flex items-center justify-between">
            <div className="text-2xl font-semibold">الشعار</div>
            <UserRound className="size-6 text-black/70" />
          </div>

          <nav className="px-4 space-y-2">
            <SideItem active icon={<Plus className="size-4" />} label="طب" />
            <SideItem
              icon={<Shield className="size-4" />}
              label="التأمين"
              onClick={() => navigate("/insurance")}
            />
            <SideItem
              icon={<Pill className="size-4" />}
              label="دواء"
              onClick={() => navigate("/drugs")}
            />
            <SideItem
              icon={<BellRing className="size-4" />}
              label="إشعارات"
              onClick={() => navigate("/notifications")}
            />
            <SideItem
              icon={<MessageSquareCode className="size-4" />}
              label="مساعد ذكي"
              onClick={() => navigate("/chat")}
            />
          </nav>

          <div className="mt-auto px-4 pt-10 pb-6">
            <button
              onClick={() => {
                localStorage.removeItem("haseef_auth");
                navigate("/login");
              }}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-xl md:text-2xl font-semibold">
                السجلات الطبية
              </div>
              <UserRound className="size-6 text-black/80" />
              <Bell className="size-5 text-black/70" />
            </div>

            {/* البحث */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50"
                placeholder="ابحث..."
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>

            {/* الفلاتر */}
            <div className="flex items-end gap-1.5 sm:gap-2 md:gap-2.5">
              <FilterSelect
                label="التاريخ"
                value={selDate}
                onChange={setSelDate}
                options={dates}
                placeholder="النطاق الزمني"
              />
              <FilterSelect
                label="الطبيب"
                value={selDoctor}
                onChange={setSelDoctor}
                options={["الكل", ...doctors]}
                placeholder="اختر طبيب"
              />
              <FilterSelect
                label="نوع النمط"
                value={selPattern}
                onChange={setSelPattern}
                options={patternTypes}
                placeholder="اختر النمط"
              />
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 md:max-w-[760px]">
            <StatPill
              title="عدد التشخيصات"
              value={filtered.length}
              bg={brand.accentLight}
              text="#173E1C"
            />
            <StatPill
              title="عدد الأطباء"
              value={doctors.length}
              bg="#CDEFE3"
              text="#1B4D3B"
            />
            <StatPill
              title="عدد السجلات"
              value={rows.length}
              bg="#D9DBFF"
              text={brand.secondary}
            />
          </div>

          {/* AI + Chart */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
            {/* ✅ بطاقة التحليل تغطي كامل الإطار */}
            <div className="rounded-2xl shadow-ai overflow-hidden h-full">
              <div
                className="h-full min-h-[260px] p-6 text-white flex flex-col justify-between"
                style={{
                  background:
                    "linear-gradient(135deg, #2C34D4 0%, #4C4DE9 38%, #0D16D1 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">تحليل</span>
                    <Bot className="size-5 text-white" />
                  </div>
                  <button
                    onClick={runAi}
                    disabled={aiLoading || loading || filtered.length === 0}
                    className="h-9 px-4 rounded-full bg-white text-[#0D16D1] text-sm font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    type="button"
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
                      اضغطي «تشغيل» لتحليل أنماط التكرار وفق الفلاتر الحالية.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Chart */}
            <Card className="shadow-soft">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">نسبة التكرار</CardTitle>
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

          {/* Table */}
          <Card className="mt-6 shadow-soft">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed" dir="rtl">
                  <thead>
                    <tr className="text-right text-black/70 text-sm">
                      <Th w="80px">رقم السجل</Th>
                      <Th w="120px">الطبيب</Th>
                      <Th w="140px">التشخيص</Th>
                      <Th w="160px">الدواء</Th>
                      <Th w="140px">التاريخ</Th>
                      <Th>ملاحظة</Th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      Array.from({ length: 5 }).map((_, i) => (
                        <tr key={i} className="border-t border-black/5">
                          <Td>
                            <div className="h-4 bg-black/10 rounded animate-pulse" />
                          </Td>
                          <Td>
                            <div className="h-4 bg-black/10 rounded animate-pulse" />
                          </Td>
                          <Td>
                            <div className="h-4 bg-black/10 rounded animate-pulse" />
                          </Td>
                          <Td>
                            <div className="h-4 bg-black/10 rounded animate-pulse" />
                          </Td>
                          <Td>
                            <div className="h-4 bg-black/10 rounded animate-pulse" />
                          </Td>
                          <Td>
                            <div className="h-4 bg-black/10 rounded animate-pulse" />
                          </Td>
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-black/60"
                        >
                          لا توجد سجلات للعرض.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr
                          key={r.id}
                          className={clsx(
                            "border-t border-black/5",
                            i % 2 === 1 && "bg-black/2.5"
                          )}
                        >
                          <Td>{r.id}</Td>
                          <Td>{r.doctor}</Td>
                          <Td>{r.diagnosis}</Td>
                          <Td>{r.drug}</Td>
                          <Td>{r.date}</Td>
                          <Td className="truncate">{r.note}</Td>
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

/* ---------- عناصر فرعية ---------- */

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
      style={active ? { backgroundColor: "#97FC4A" } : {}}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  id,
  minWidth = "min-w-[8rem]",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  id?: string;
  minWidth?: string;
}) {
  const selectId = id ?? `select-${label}`;
  return (
    <div className={clsx("flex flex-col gap-1", minWidth)}>
      <label htmlFor={selectId} className="text-xs text-black/60 pr-1">
        {label}
      </label>
      <div className="relative inline-block">
        <select
          id={selectId}
          dir="rtl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            select-green
            pr-9
            rounded-2xl
            border border-black/10
            shadow-md
            h-10
            text-sm
            focus:outline-none
            focus:ring-4
            focus:ring-emerald-300/30
          "
          style={{ WebkitAppearance: "none", MozAppearance: "none" }}
        >
          <option hidden>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-white text-black">
              {opt}
            </option>
          ))}
        </select>
      </div>
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
