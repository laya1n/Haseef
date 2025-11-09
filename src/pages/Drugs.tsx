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
import { apiGetDrugs, apiLogout } from "@/lib/api";

/* ============================== Types ============================== */
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
  date: string;
  ai_analysis?: string;
};

type RecordsResponse = {
  total_operations: number;
  top_drug: string;
  alerts_count: number;
  records: DrugRow[];
};

type AiInsight = { message: string; meta?: Record<string, unknown> };

/* ============================== Helpers ============================== */
const shorten = (s = "", max = 28) =>
  s.length > max ? s.slice(0, max - 1) + "…" : s;
const shortName = (s = "") => shorten(s.replace(/\s+/g, " ").trim(), 18);
const extractErr = (e: any): string | null => {
  if (!e) return null;
  if (typeof e === "string") return e;
  if (e.message) {
    try {
      const j = JSON.parse(e.message);
      return j?.detail || j?.error || e.message;
    } catch {
      return e.message;
    }
  }
  return null;
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

  /* ---------- تحميل السجلات من الباك ---------- */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setError(null);
        setLoading(true);
        setAiMsg(null);

        const params: Record<string, string | boolean> = {};
        if (selDate === "الأسبوع الأخير") params["last_week"] = true;

        const data = (await apiGetDrugs(params)) as unknown as RecordsResponse;
        if (cancel) return;

        const list = data?.records ?? [];
        setRows(list);
        setTotalOps(data?.total_operations ?? list.length);
        setTopDrug(data?.top_drug || "—");

        setDoctors(
          Array.from(new Set(list.map((r) => r.doctor_name).filter(Boolean)))
        );
        setDrugs(
          Array.from(
            new Set(list.map((r) => r.service_description).filter(Boolean))
          )
        );
      } catch (e: any) {
        if (!cancel) setError(extractErr(e) || "فشل تحميل سجلات الأدوية.");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selDate]);

  /* ---------- تصفية محلية + البحث ---------- */
  const filtered = useMemo(() => {
    let out = rows;
    if (selDoctor !== "الكل")
      out = out.filter((r) => r.doctor_name === selDoctor);
    if (selDrug !== "الكل")
      out = out.filter((r) => r.service_description === selDrug);
    if (q.trim()) {
      const s = q.trim().toLowerCase();
      out = out.filter((r) =>
        [
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
          .map((v) => String(v).toLowerCase())
          .some((v) => v.includes(s))
      );
    }
    return out;
  }, [rows, selDoctor, selDrug, q]);

  /* ---------- توزيع الدونات (حسب الدواء) ---------- */
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
      // مبدئيًا لا يوجد /ai/analyze موحّد؛ نعرض رسالة ودّية
      setAiMsg(
        "ميزة التحليل ستُفعّل لاحقًا بعد إضافة مسار /ai/analyze في الباك-إند."
      );
    } finally {
      setAiLoading(false);
    }
  }

  async function doLogout() {
    try {
      await apiLogout();
    } catch {
    } finally {
      navigate("/", { replace: true });
    }
  }

  return (
    <div className="min-h-screen bg-haseef-surface">
      <div className="grid grid-cols-[260px_1fr]">
        {/* Sidebar */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
          <div className="px-5 pt-5">
            <img
              src={logo}
              alt="شعار حصيف الذكي"
              className="w-10 drop-shadow-sm select-none"
            />
          </div>

          <nav className="p-5 space-y-2">
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

          <div className="px-5 pb-6">
            <button
              onClick={doLogout}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-2 hover:bg-black/5"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-5 md:p-8" dir="rtl">
          <div className="mx-auto max-w-[1200px]">
            {/* زر العودة للهوم */}
            <button
              onClick={() => navigate("/")}
              className="p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition inline-flex"
              title="العودة للصفحة الرئيسية"
            >
              <Home
                className="size-5"
                style={{ color: "var(--brand-green)" }}
              />
            </button>

            {/* الهيدر */}
            <div className="flex items-center justify-between gap-3 mt-3">
              <h2
                className="text-xl md:text-2xl font-semibold"
                style={{ color: "var(--brand-green)" }}
              >
                سجلات الأدوية
              </h2>

              {/* البحث */}
              <div className="relative w-[320px] max-w-[45vw]">
                <input
                  className="w-full h-9 rounded-full border border-black/10 bg-white pl-9 pr-3 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30 text-[13px]"
                  placeholder="ابحث باسم الطبيب/المريض/الدواء/الكود/التاريخ…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
              </div>

              {/* الفلاتر */}
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

            {/* تنبيه خطأ */}
            {error && (
              <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-2 rounded-xl text-sm">
                <TriangleAlert className="size-4" />
                <span>{error}</span>
              </div>
            )}

            {/* كروت إحصائية */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-3 md:max-w-[760px]">
              <StatPill
                title="عدد العمليات"
                value={filtered.length || totalOps}
                bg="#E7E9FF"
                text="var(--brand-secondary)"
              />
              <StatPill
                title="الدواء الأعلى صرفًا"
                value={topDrugLocal}
                bg="#E6F4EE"
                text="var(--brand-green)"
              />
              <StatPill
                title="عدد التنبيهات"
                value="—"
                bg="#F0F9E6"
                text="#173E1C"
              />
            </div>

            {/* AI + Donut */}
            <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* AI */}
              <div className="rounded-2xl shadow-ai overflow-hidden">
                <div className="min-h-[220px] p-5 text-white flex flex-col justify-between bg-ai-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">تحليل</span>
                      <Bot className="size-5" />
                    </div>
                    <button
                      className="h-8 px-4 rounded-full bg-white text-[var(--brand-secondary)] text-xs font-semibold hover:bg-white/90 disabled:opacity-60"
                      onClick={runAi}
                      disabled={aiLoading || loading}
                    >
                      {aiLoading ? (
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="size-4 animate-spin" /> جاري
                          التحليل
                        </span>
                      ) : (
                        "تشغيل"
                      )}
                    </button>
                  </div>
                  <div className="mt-3 grid place-items-center text-center leading-relaxed">
                    <p className="text-white/95 text-sm">
                      {aiMsg ??
                        "اضغطي «تشغيل» لتحليل أنماط صرف الأدوية وفق الفلاتر الحالية."}
                    </p>
                  </div>
                </div>
              </div>

              {/* Donut */}
              <Card className="shadow-soft">
                <CardHeader className="pb-0">
                  <CardTitle className="text-sm">
                    نسبة الصرف حسب الدواء
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-3">
                  <div className="grid grid-cols-[1fr_1fr] items-center gap-4">
                    {/* legend */}
                    <ul className="space-y-1.5">
                      {(donut.slice(0, 5) ?? []).map((s) => (
                        <li
                          key={s.label}
                          className="flex items-center gap-2 text-[13px] text-black/80"
                        >
                          <span
                            className="inline-block size-2.5 rounded-full"
                            style={{ backgroundColor: s.color }}
                          />
                          {shorten(s.label, 28)} {s.value}%
                        </li>
                      ))}
                      {!donut.length && (
                        <li className="text-[13px] text-black/50">
                          لا يوجد توزيع متاح.
                        </li>
                      )}
                    </ul>

                    {/* donut */}
                    <div className="flex justify-center">
                      <div
                        className="relative size-40 md:size-48 rounded-full border-8 border-white shadow-sm"
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
            <Card className="mt-5 shadow-soft">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <div className="table-wrapper">
                    <table
                      className="w-full table-fixed table-compact"
                      dir="rtl"
                    >
                      {/* نثبّت عرض الأعمدة لتجنّب التداخل */}
                      <colgroup>
                        <col style={{ width: "12%" }} /> {/* الطبيب */}
                        <col style={{ width: "13%" }} /> {/* المريض */}
                        <col style={{ width: "10%" }} /> {/* كود الخدمة */}
                        <col style={{ width: "23%" }} />{" "}
                        {/* وصف الخدمة/الدواء */}
                        <col style={{ width: "6%" }} /> {/* الكمية */}
                        <col style={{ width: "8%" }} /> {/* سعر الوحدة */}
                        <col style={{ width: "8%" }} /> {/* الإجمالي */}
                        <col style={{ width: "7%" }} /> {/* الضريبة */}
                        <col style={{ width: "6%" }} /> {/* الخصم */}
                        <col style={{ width: "7%" }} /> {/* الصافي */}
                        <col style={{ width: "10%" }} /> {/* التاريخ */}
                      </colgroup>

                      <thead>
                        <tr className="text-right">
                          <Th>الطبيب</Th>
                          <Th>المريض</Th>
                          <Th>كود الخدمة</Th>
                          <Th>وصف الخدمة/الدواء</Th>
                          <Th>الكمية</Th>
                          <Th>سعر الوحدة</Th>
                          <Th>الإجمالي</Th>
                          <Th>الضريبة</Th>
                          <Th>الخصم</Th>
                          <Th>الصافي</Th>
                          <Th>التاريخ</Th>
                        </tr>
                      </thead>

                      <tbody>
                        {loading ? (
                          Array.from({ length: 6 }).map((_, i) => (
                            <tr key={i} className="border-t border-black/5">
                              {Array.from({ length: 11 }).map((__, j) => (
                                <Td key={j}>
                                  <div className="h-3.5 bg-black/10 rounded animate-pulse" />
                                </Td>
                              ))}
                            </tr>
                          ))
                        ) : filtered.length === 0 ? (
                          <tr>
                            <td
                              colSpan={11}
                              className="px-4 py-8 text-center text-black/60 text-sm"
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
                              <Td>
                                <span
                                  className="cell-clip"
                                  title={r.doctor_name}
                                >
                                  {r.doctor_name}
                                </span>
                              </Td>
                              <Td>
                                <span
                                  className="cell-clip"
                                  title={r.patient_name}
                                >
                                  {r.patient_name}
                                </span>
                              </Td>
                              <Td>
                                <span
                                  className="cell-clip"
                                  title={String(r.service_code)}
                                >
                                  {r.service_code}
                                </span>
                              </Td>
                              <Td>
                                <span
                                  className="cell-clip"
                                  title={r.service_description}
                                >
                                  {r.service_description}
                                </span>
                              </Td>
                              <Td className="cell-clip">{r.quantity}</Td>
                              <Td className="cell-clip">{r.item_unit_price}</Td>
                              <Td className="cell-clip">{r.gross_amount}</Td>
                              <Td className="cell-clip">{r.vat_amount}</Td>
                              <Td className="cell-clip">{r.discount}</Td>
                              <Td className="cell-clip">{r.net_amount}</Td>
                              <Td>
                                <span className="cell-clip" title={r.date}>
                                  {r.date}
                                </span>
                              </Td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
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
        "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-2 transition",
        active ? "border border-black/10" : "hover:bg-black/5"
      )}
      style={
        active
          ? {
              background: "var(--brand-accent)",
              color: "var(--brand-secondary)",
            }
          : undefined
      }
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
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="relative min-w-[9.5rem]" ref={ref}>
      <label className="text-[11px] text-black/60 pr-1 block mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="btn-filter w-full px-3 flex items-center justify-between text-xs shadow-md"
      >
        <span className="truncate">{value}</span>
        <svg
          className={clsx("size-4 transition-transform", open && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <ul className="absolute mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50 dropdown-scroll">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-right px-3 py-2 text-[13px] hover:bg-emerald-50",
                  value === opt &&
                    "bg-emerald-50 font-semibold text-[var(--brand-green)]"
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
  text = "var(--ink)",
}: {
  title: string;
  value: number | string;
  bg: string;
  text?: string;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-soft min-h-[74px]"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="text-[12px] opacity-80 mb-0.5">{title}</div>
      <div className="text-xl font-semibold leading-6">{value}</div>
    </div>
  );
}

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th
      className="px-3 py-2 border-b border-black/10 font-medium bg-white sticky top-0 z-[1]"
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
    <td className={clsx("px-3 py-2 align-middle text-xs", className)}>
      {children}
    </td>
  );
}
