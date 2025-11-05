// src/pages/Drugs.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
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
  Home,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";

/* ============================== Types ============================== */
type RxRow = {
  id: number;
  doctor: string;
  diagnosis: string;
  drug: string;
  date: string;
  note: string;
};

type DonutSlice = {
  label: string;
  value: number; // 0..100 (المجموع ~100)
  color?: string;
};

type ListResponse = { items: RxRow[]; doctors?: string[]; drugs?: string[] };
type DonutResponse = { distribution: DonutSlice[] };
type AiInsight = { message: string; sourceTag?: string };

/* ============================== API config ============================== */
// ضعي الدومين في .env لو كان خارجيًا: VITE_API_BASE_URL=https://api.example.com
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const ENDPOINTS = {
  list: "/api/drugs/list",
  donut: "/api/drugs/distribution",
  analyze: "/api/ai/drugs/analyze",
};

async function httpGet<T>(path: string, params?: Record<string, string>) {
  const url = new URL(BASE_URL + path || path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== "الكل") url.searchParams.set(k, v);
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

/* ============================== Brand ============================== */
const brand = {
  green: "#0E6B43",
  greenHover: "#0f7d4d",
  accent: "#97FC4A",
  secondary: "#0D16D1",
};

/* ============================== Page ============================== */
export default function Drugs() {
  const navigate = useNavigate();

  // بيانات
  const [rows, setRows] = useState<RxRow[]>([]);
  const [donut, setDonut] = useState<DonutSlice[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);

  // واجهة
  const [loading, setLoading] = useState(false);
  const [loadingDonut, setLoadingDonut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // فلاتر/بحث
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selDrug, setSelDrug] = useState<string>("الكل");
  const [q, setQ] = useState("");

  /* ---------- تحميل السجلات ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        setAiMsg(null); // اتساق مع بقية الصفحات
        const data = await httpGet<ListResponse>(ENDPOINTS.list, {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        });
        if (cancel) return;
        const items = data.items ?? [];
        setRows(items);
        setDoctors(
          data.doctors?.length
            ? data.doctors
            : Array.from(new Set(items.map((r) => r.doctor))).filter(Boolean)
        );
        setDrugs(
          data.drugs?.length
            ? data.drugs
            : Array.from(new Set(items.map((r) => r.drug))).filter(Boolean)
        );
      } catch (e: any) {
        if (!cancel) setError(e?.message || "فشل تحميل سجلات الصرف.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selDate, selDoctor, selDrug, q]);

  /* ---------- تحميل توزيع الدونات ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoadingDonut(true);
        const d = await httpGet<DonutResponse>(ENDPOINTS.donut, {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        });
        if (cancel) return;
        const palette = [
          "#3853FF",
          "#6FE38A",
          "#A7F3A8",
          "#E6ECFF",
          "#9AA0FF",
          "#B9E4C9",
        ];
        const cleaned =
          d.distribution?.map((s, i) => ({
            ...s,
            color: s.color ?? palette[i % palette.length],
          })) ?? [];
        setDonut(cleaned);
      } catch {
        // يكفي تجاهل الخطأ في المخطط
      } finally {
        if (!cancel) setLoadingDonut(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selDate, selDoctor, selDrug, q]);

  /* ---------- تصفية محلية ---------- */
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim();
    return rows.filter(
      (r) =>
        r.doctor?.includes(s) ||
        r.diagnosis?.includes(s) ||
        r.drug?.includes(s) ||
        r.note?.includes(s) ||
        r.date?.includes(s)
    );
  }, [rows, q]);

  /* ---------- أعلى دواء ---------- */
  const topDrug = useMemo(() => {
    if (!donut?.length) return "—";
    return donut.reduce((a, b) => (a.value >= b.value ? a : b)).label;
  }, [donut]);

  /* ---------- conic-gradient ---------- */
  const donutBg = useMemo(() => {
    if (!donut?.length) return "conic-gradient(#E6ECFF 0deg 360deg)";
    let start = 0;
    const parts = donut.map((s) => {
      const end = start + s.value * 3.6;
      const seg = `${s.color} ${start}deg ${end}deg`;
      start = end;
      return seg;
    });
    return `conic-gradient(${parts.join(",")})`;
  }, [donut]);

  async function runAi() {
    try {
      setAiLoading(true);
      setAiMsg(null);
      setAiSource(null);
      const res = await httpPost<AiInsight>(ENDPOINTS.analyze, {
        filters: {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        },
      });
      setAiMsg(res.message || "تم التحليل.");
      if (res.sourceTag) setAiSource(res.sourceTag);
    } catch {
      setAiMsg("تعذّر تشغيل التحليل الآن. تحقّقي من خدمة الذكاء الاصطناعي.");
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
        <aside
          className="min-h-screen border-l bg-white sticky top-0"
          dir="rtl"
        >
          <div className="p-6 pb-4 flex items-center justify-between">
            <div className="text-2xl font-semibold">الشعار</div>
          </div>

          <nav className="px-4 space-y-2">
            <SideItem
              icon={<Plus className="size-4" />}
              label="طب"
              onClick={() => navigate("/dashboard")}
            />
            <SideItem
              icon={<Shield className="size-4" />}
              label="التأمين"
              onClick={() => navigate("/insurance")}
            />
            <SideItem active icon={<Pill className="size-4" />} label="دواء" />
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
                sessionStorage.removeItem("haseef_auth");
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
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* زر العودة للهوم (منزل فقط) */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition"
            title="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          {/* Header */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <div className="flex items-center gap-3">
              <div
                className="text-xl md:text-2xl font-semibold"
                style={{ color: brand.green }}
              >
                صرف الأدوية
              </div>
            </div>

            {/* Search */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                placeholder="ابحث..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>

            {/* Filters (Dropdown مخصّص) */}
            <div className="flex items-end gap-2">
              <Dropdown
                label="الدواء"
                value={selDrug}
                onChange={setSelDrug}
                options={["الكل", ...drugs]}
              />
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
                options={["الكل", "الأسبوع الأخير"]}
              />
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Stats */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 md:max-w-[760px]">
            <StatPill
              title="عدد العمليات"
              value={filtered.length}
              bg="#D9DBFF"
              text={brand.secondary}
            />
            <StatPill
              title="الدواء الأعلى صرفًا"
              value={topDrug}
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

          {/* AI + Donut */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
            {/* AI */}
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
                  {aiMsg ? (
                    <div className="text-center">
                      <p className="text-white/95">{aiMsg}</p>
                      {aiSource && (
                        <p className="text-white/70 text-sm mt-2">
                          المصدر: {aiSource}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/90 text-center">
                      اضغطي «تشغيل» لتحليل أنماط صرف الأدوية وفق الفلاتر
                      الحالية.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Donut */}
            <Card className="shadow-soft">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">نسبة الصرف</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-[1fr_1fr] items-center gap-4">
                  {/* legend */}
                  <ul className="space-y-2">
                    {(donut?.slice(0, 4) ?? []).map((s) => (
                      <li
                        key={s.label}
                        className="flex items-center gap-2 text-sm text-black/80"
                      >
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.label} {s.value}%
                      </li>
                    ))}
                    {loadingDonut && (
                      <li className="text-sm text-black/50">
                        جارِ تحميل التوزيع…
                      </li>
                    )}
                    {!loadingDonut && donut.length === 0 && (
                      <li className="text-sm text-black/50">
                        لا يوجد توزيع متاح.
                      </li>
                    )}
                  </ul>

                  {/* donut */}
                  <div className="flex justify-center">
                    <div
                      className="relative size-44 md:size-52 rounded-full border-8 border-white shadow-sm"
                      style={{ background: donutBg }}
                      title="Drug dispensing distribution"
                    >
                      <div className="absolute inset-6 rounded-full bg-white" />
                    </div>
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
                      <Th w="110px">رقم السجل</Th>
                      <Th w="140px">الطبيب</Th>
                      <Th w="160px">التشخيص</Th>
                      <Th w="160px">الدواء</Th>
                      <Th w="140px">التاريخ</Th>
                      <Th>ملاحظة</Th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-t border-black/5">
                          {Array.from({ length: 6 }).map((__, j) => (
                            <Td key={j}>
                              <div className="h-4 bg-black/10 rounded animate-pulse" />
                            </Td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-black/60"
                        >
                          لا توجد سجلات مطابقة.
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
                          <Td w="110px">{r.id}</Td>
                          <Td w="140px">{r.doctor}</Td>
                          <Td w="160px">{r.diagnosis}</Td>
                          <Td w="160px">{r.drug}</Td>
                          <Td w="140px">{r.date}</Td>
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
