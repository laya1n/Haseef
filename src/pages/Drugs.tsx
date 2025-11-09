// src/pages/Drugs.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
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
  Bot,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";

/* ============================== Types (match backend) ============================== */
type DrugRow = {
  doctor_name: string;
  patient_name: string;
  service_code: string;
  service_description: string;
  quantity: number | string;
  item_unit_price: number | string;
  gross_amount: number | string;
  vat_amount: number | string;
  discount: number | string;
  net_amount: number | string;
  date: string; // ISO-ish text
  ai_analysis?: string;
};

type RecordsResponse = {
  total_operations: number;
  top_drug: string;
  alerts_count: number;
  records: DrugRow[];
};

type AiInsight = { message: string; meta?: Record<string, unknown> };

/* ============================== API config ============================== */
const RAW_BASE_URL = "https://haseef.onrender.com";

function joinUrl(base: string, path: string) {
  if (!base) return path;
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

const ENDPOINTS = {
  records: "/api/drugs/records",
  analyze: "/api/ai/analyze",
};

async function httpGet<T>(path: string, params?: Record<string, string>) {
  const full = joinUrl(RAW_BASE_URL, path);
  const url = new URL(full, window.location.origin);
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
  const full = joinUrl(RAW_BASE_URL, path);
  const res = await fetch(full, {
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
  const [rows, setRows] = useState<DrugRow[]>([]);
  const [totalOps, setTotalOps] = useState<number>(0);
  const [topDrug, setTopDrug] = useState<string>("—");
  const [doctors, setDoctors] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);

  // واجهة
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // فلاتر/بحث
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selDrug, setSelDrug] = useState<string>("الكل");
  const [q, setQ] = useState("");

  /* ---------- تحميل السجلات من /api/drugs/records ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        setAiMsg(null);

        const params: Record<string, string> = {};
        if (selDate === "الأسبوع الأخير") params["last_week"] = "true";
        // مبدئيًا الباك لا يدعم doctor أو drug كـ params؛ نعتمد تصفية محلية
        const data = await httpGet<RecordsResponse>(ENDPOINTS.records, params);
        if (cancel) return;

        const list = data.records ?? [];
        setRows(list);
        setTotalOps(data.total_operations ?? list.length);
        setTopDrug(data.top_drug || "—");

        // استخراج خيارات الأطباء والأدوية من الداتا
        setDoctors(
          Array.from(new Set(list.map((r) => r.doctor_name).filter(Boolean)))
        );
        setDrugs(
          Array.from(
            new Set(list.map((r) => r.service_description).filter(Boolean))
          )
        );
      } catch (e: any) {
        if (!cancel) setError(e?.message || "فشل تحميل سجلات الأدوية.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selDate]);

  /* ---------- تصفية محلية (doctor_name / service_description) + البحث ---------- */
  const filtered = useMemo(() => {
    let out = rows;
    if (selDoctor !== "الكل") {
      out = out.filter((r) => r.doctor_name === selDoctor);
    }
    if (selDrug !== "الكل") {
      out = out.filter((r) => r.service_description === selDrug);
    }
    if (q.trim()) {
      const s = q.trim();
      out = out.filter((r) => {
        const vals = [
          r.doctor_name,
          r.patient_name,
          r.service_code,
          r.service_description,
          r.quantity,
          r.item_unit_price,
          r.gross_amount,
          r.vat_amount,
          r.discount,
          r.net_amount,
          r.date,
        ]
          .filter((v) => v !== undefined && v !== null)
          .map((v) => String(v));
        return vals.some((v) => v.includes(s));
      });
    }
    return out;
  }, [rows, selDoctor, selDrug, q]);

  /* ---------- حساب توزيع دونات محليًا (حسب service_description) ---------- */
  type DonutSlice = { label: string; value: number; color?: string };
  const donut = useMemo<DonutSlice[]>(() => {
    if (!filtered.length) return [];
    const counts = new Map<string, number>();
    filtered.forEach((r) => {
      const key = r.service_description || "-";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    const palette = [
      "#3853FF",
      "#6FE38A",
      "#A7F3A8",
      "#E6ECFF",
      "#9AA0FF",
      "#B9E4C9",
    ];
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, c], i) => ({
        label,
        value: Math.round((c / total) * 100),
        color: palette[i % palette.length],
      }));
  }, [filtered]);

  const donutBg = useMemo(() => {
    if (!donut.length) return "conic-gradient(#E6ECFF 0deg 360deg)";
    let start = 0;
    const parts = donut.map((s) => {
      const end = start + s.value * 3.6;
      const seg = `${s.color} ${start}deg ${end}deg`;
      start = end;
      return seg;
    });
    return `conic-gradient(${parts.join(",")})`;
  }, [donut]);

  /* ---------- أعلى دواء من الدونات (fallback لو رجع الباك ‘-’) ---------- */
  const topDrugLocal = useMemo(() => {
    if (topDrug && topDrug !== "-") return topDrug;
    if (!donut.length) return "—";
    return donut.reduce((a, b) => (a.value >= b.value ? a : b)).label;
  }, [topDrug, donut]);

  /* ---------- AI ---------- */
  async function runAi() {
    try {
      setAiLoading(true);
      setAiMsg(null);
      const res = await httpPost<AiInsight>(ENDPOINTS.analyze, {
        filters: {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        },
        context: filtered,
      });
      setAiMsg(res.message || "تم التحليل.");
    } catch (e: any) {
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
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
          {/* الشعار */}
          <div className="absolute top-4 right-4">
            <img
              src={logo}
              alt="شعار حصيف الذكي"
              className="w-10 md:w-12 drop-shadow-sm select-none"
            />
          </div>

          <div className="p-6 pt-20 space-y-4 flex-1">
            <nav className="px-4 space-y-2">
              <SideItem
                icon={<Plus className="size-4" />}
                label="السجلات الطبية"
                onClick={() => navigate("/dashboard")}
              />
              <SideItem
                icon={<Shield className="size-4" />}
                label="السجلات التأمينية"
                onClick={() => navigate("/insurance")}
              />
              <SideItem
                active
                icon={<Pill className="size-4" />}
                label="سجلات الأدوية"
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

        {/* Main */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* زر العودة للهوم */}
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
                سجلات الأدوية
              </div>
            </div>

            {/* Search */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                placeholder="ابحث باسم الطبيب/المريض/الدواء/الكود/التاريخ…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>

            {/* Filters */}
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
              value={filtered.length || totalOps}
              bg="#D9DBFF"
              text={brand.secondary}
            />
            <StatPill
              title="الدواء الأعلى صرفًا"
              value={topDrugLocal}
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
                    <p className="text-white/95 text-center">{aiMsg}</p>
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
                <CardTitle className="text-base">
                  نسبة الصرف حسب الدواء
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-[1fr_1fr] items-center gap-4">
                  {/* legend */}
                  <ul className="space-y-2">
                    {(donut.slice(0, 5) ?? []).map((s) => (
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
                    {!donut.length && (
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
                      <Th w="140px">الطبيب</Th>
                      <Th w="160px">المريض</Th>
                      <Th w="120px">كود الخدمة</Th>
                      <Th w="220px">وصف الخدمة/الدواء</Th>
                      <Th w="90px">الكمية</Th>
                      <Th w="120px">سعر الوحدة</Th>
                      <Th w="120px">الإجمالي</Th>
                      <Th w="110px">الضريبة</Th>
                      <Th w="110px">الخصم</Th>
                      <Th w="130px">الصافي</Th>
                      <Th w="140px">التاريخ</Th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
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
                          لا توجد سجلات مطابقة.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr
                          key={`${r.doctor_name}-${r.patient_name}-${r.service_code}-${i}`}
                          className={clsx(
                            "border-t border-black/5",
                            i % 2 === 1 && "bg-black/[0.025]"
                          )}
                        >
                          <Td>{r.doctor_name}</Td>
                          <Td>{r.patient_name}</Td>
                          <Td>{r.service_code}</Td>
                          <Td
                            className="truncate"
                            title={r.service_description}
                          >
                            {r.service_description}
                          </Td>
                          <Td>{r.quantity}</Td>
                          <Td>{r.item_unit_price}</Td>
                          <Td>{r.gross_amount}</Td>
                          <Td>{r.vat_amount}</Td>
                          <Td>{r.discount}</Td>
                          <Td>{r.net_amount}</Td>
                          <Td>{r.date}</Td>
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

/** Dropdown مخصص */
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
