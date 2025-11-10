// src/pages/Dashboard.tsx
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
  Home,
  Search,
  Loader2,
  TriangleAlert,
  Bot,
  X,
  Eye,
  CalendarDays,
} from "lucide-react";
import clsx from "clsx";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  ResponsiveContainer,
  CartesianGrid,
  LabelList,
} from "recharts";

import { AgGridReact } from "ag-grid-react";
import type { ColDef, GetRowIdParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

/* ===================== الهوية اللونية (Tokens) ===================== */
const brand = {
  green: "#0E6B43",
  greenHover: "#0B5A38",
  accent: "#97FC4A",
  secondary: "#0D16D1",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F7FB",
  text: "#111827",
  muted: "#6B7280",
};

/* ===================== Helpers ===================== */
const toTitle = (s: string) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const dropTitles = new Set([
  "dr",
  "dr.",
  "doctor",
  "د",
  "د.",
  "دكتور",
  "الدكتور",
  "د/",
  "د\\",
]);
const firstNameOf = (name: string) => {
  const parts = (name || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const firstReal = parts.find((p) => !dropTitles.has(p)) || parts[0] || "";
  return toTitle(firstReal);
};

// تطبيع عربي/إنجليزي بسيط + إزالة تشكيل
const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0610-\u061A]/g, "") // حركات
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[‐-–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

// تطابق تقريبي (≤1)
const near = (a: string, b: string) => {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return true;
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0,
    j = 0,
    edit = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      i++;
      j++;
      continue;
    }
    edit++;
    if (edit > 1) return false;
    if (a.length > b.length) i++;
    else if (a.length < b.length) j++;
    else {
      i++;
      j++;
    }
  }
  if (i < a.length || j < b.length) edit++;
  return edit <= 1;
};

// مختصرات العرض السريع في الجدول
const firstIcd = (s: string) =>
  String(s || "")
    .split(/[,،;\n|]/)[0]
    ?.trim();

const brief = (s: string, max = 48) => {
  const firstChunk =
    String(s || "")
      .split(/[,،;\n-]/)[0]
      ?.trim() || "";
  return firstChunk.length > max ? firstChunk.slice(0, max) + "…" : firstChunk;
};

/* ===================== Types ===================== */
type MedRow = {
  id?: number | string;
  doctor_name: string;
  patient_name: string;
  treatment_date: string; // YYYY-MM-DD
  ICD10CODE: string;
  chief_complaint: string;
  ai_analysis?: string;
  claim_type?: string;
  refer_ind?: string;
  emer_ind?: string;
  contract?: string;
};
type RecordsResponse = {
  total_records: number;
  total_doctors: number;
  alerts_count: number;
  records: MedRow[];
};

/* ===================== API ===================== */
const RAW_BASE = (import.meta as any).env?.VITE_API_BASE || "";
const API_BASE = String(RAW_BASE || "");
const USE_PROXY = !API_BASE;
const ENDPOINTS = {
  records: USE_PROXY ? "/api/medical/records" : "/medical/records",
  analyze: USE_PROXY ? "/api/ai/analyze" : "/ai/analyze",
};
const joinUrl = (b: string, p: string) =>
  b ? `${b.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}` : p;

async function httpGet<T>(path: string, params?: Record<string, string>) {
  const full = joinUrl(API_BASE, path);
  const url = new URL(full, window.location.origin);
  if (params)
    for (const [k, v] of Object.entries(params))
      if (v) url.searchParams.set(k, v);
  const r = await fetch(url.toString(), { credentials: "include" });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) throw new Error(await r.text());
  if (!ct.includes("application/json")) throw new Error("Unexpected response");
  return r.json() as Promise<T>;
}
async function httpPost<T>(path: string, body: unknown) {
  const r = await fetch(joinUrl(API_BASE, path), {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(await r.text());
  return r.json() as Promise<T>;
}

/* ===================== Hooks: قياس عنصر ===================== */
function useElementSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const measure = () =>
      setSize({ width: el.clientWidth, height: el.clientHeight });
    measure();

    const ro = new ResizeObserver(() => measure());
    ro.observe(el);

    // احتياطي في حال كانت الحاوية تدخل بعد transition/animate
    const id = setTimeout(measure, 150);

    return () => {
      ro.disconnect();
      clearTimeout(id);
    };
  }, [ref.current]);

  return { ref, size };
}

/* ===================== الصفحة ===================== */
export default function Dashboard() {
  const navigate = useNavigate();

  // فلاتر
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selDate, setSelDate] = useState<string>(""); // YYYY-MM-DD
  const [q, setQ] = useState("");
  const [qKey, setQKey] = useState(""); // Debounced

  // بيانات
  const [rows, setRows] = useState<MedRow[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);

  // حالات
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiLoading, setAiLoading] = useState(false);
  const [aiMsg, setAiMsg] = useState<string | null>(null);

  // Viewer
  const [viewRow, setViewRow] = useState<MedRow | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const openViewer = (row: MedRow) => {
    setViewRow(row);
    setShowViewer(true);
  };
  const closeViewer = () => {
    setShowViewer(false);
    setViewRow(null);
  };

  // قياس الشارت عبر ResizeObserver
  const { ref: chartBoxRef, size: chartSize } =
    useElementSize<HTMLDivElement>();
  const chartReady = chartSize.width > 10 && chartSize.height > 10;

  // Debounce البحث
  useEffect(() => {
    const id = setTimeout(() => setQKey(normalize(q.trim())), 220);
    return () => clearTimeout(id);
  }, [q]);

  // تحميل
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        setAiMsg(null);
        const params: Record<string, string> = {};
        if (selDoctor !== "الكل") params["doctor"] = selDoctor;
        if (selDate) params["date"] = selDate;
        const data = await httpGet<RecordsResponse>(ENDPOINTS.records, params);
        if (cancel) return;
        const list = (data?.records || []).map((r, i) => ({
          id: r.id ?? i + 1,
          ...r,
        }));
        setRows(list);
        setTotalRecords(data?.total_records ?? list.length);
        const uniq = Array.from(
          new Set(list.map((r) => toTitle(r.doctor_name)).filter(Boolean))
        ).sort();
        setDoctors(uniq);
      } catch (e: any) {
        if (!cancel) setError(e?.message || "فشل تحميل البيانات");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selDoctor, selDate]);

  // تصفية
  const filtered = useMemo(() => {
    let out = rows;
    if (qKey) {
      out = out.filter((r) => {
        const fields = [
          r.doctor_name,
          r.patient_name,
          r.ICD10CODE,
          r.chief_complaint,
          r.treatment_date,
        ].map((x) => normalize(String(x || "")));
        const first = normalize(firstNameOf(r.doctor_name));
        return fields.some((f) => f.includes(qKey)) || near(first, qKey);
      });
    }
    if (selDoctor !== "الكل") {
      const norm = normalize(selDoctor);
      out = out.filter(
        (r) =>
          normalize(r.doctor_name).includes(norm) ||
          near(firstNameOf(r.doctor_name), selDoctor)
      );
    }
    return out;
  }, [rows, qKey, selDoctor]);

  // الشارت
  const chartData = useMemo(() => {
    const by: Record<string, number> = {};
    filtered.forEach((r) => {
      const fn = firstNameOf(r.doctor_name || "");
      if (!fn || fn.toLowerCase() === "nan") return;
      by[fn] = (by[fn] ?? 0) + 1;
    });
    return Object.entries(by).map(([doctor, count]) => ({ doctor, count }));
  }, [filtered]);

  const yMeta = useMemo(() => {
    const max = chartData.reduce((m, c) => Math.max(m, c.count), 0);
    const step = max <= 10 ? 1 : max <= 20 ? 2 : max <= 40 ? 4 : 5;
    const top = Math.max(3, Math.ceil((max + step) / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { ticks, top };
  }, [chartData]);

  /* ===================== أعمدة الجدول ===================== */
  const colDefs: ColDef<MedRow>[] = [
    {
      headerName: "#",
      valueGetter: (p) => (p.node ? p.node.rowIndex + 1 : 0),
      width: 90,
      pinned: "right",
      suppressMenu: true,
      resizable: false,
    },
    {
      field: "doctor_name",
      headerName: "اسم الطبيب",
      minWidth: 160,
      maxWidth: 220,
      valueGetter: (p) => firstNameOf(p.data?.doctor_name || ""),
      tooltipValueGetter: (p) => p.data?.doctor_name || "",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? ""} />,
    },
    {
      field: "patient_name",
      headerName: "اسم المريض",
      minWidth: 180,
      maxWidth: 240,
      tooltipValueGetter: (p) => p.data?.patient_name || "",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? ""} />,
    },
    {
      field: "chief_complaint",
      headerName: "الشكوى الرئيسية",
      flex: 1,
      minWidth: 280,
      valueGetter: (p) => brief(p.data?.chief_complaint || "", 42),
      tooltipValueGetter: (p) => p.data?.chief_complaint || "",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? ""} />,
    },
    {
      field: "ICD10CODE",
      headerName: "ICD10",
      minWidth: 160,
      maxWidth: 220,
      valueGetter: (p) => firstIcd(p.data?.ICD10CODE || ""),
      tooltipValueGetter: (p) => p.data?.ICD10CODE || "",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? ""} />,
    },
    {
      field: "treatment_date",
      headerName: "التاريخ",
      width: 150,
      cellRenderer: (p: any) => (
        <span title={p.value} className="tabular-nums">
          {p.value || "—"}
        </span>
      ),
    },
    {
      headerName: "عرض",
      width: 170,
      pinned: "left",
      sortable: false,
      resizable: false,
      cellStyle: { paddingInline: "6px", overflow: "visible" },
      cellRenderer: (p: any) => (
        <div className="h-full flex items-center justify-start">
          <button
            onClick={() => openViewer(p.data)}
            aria-label="عرض كل تفاصيل السجل"
            className="h-8 w-[120px] rounded-full text-[12px] font-medium text-white
                       shadow-sm hover:shadow transition flex items-center gap-1.5
                       justify-center whitespace-nowrap focus-visible:outline-none
                       focus-visible:ring-2 focus-visible:ring-emerald-300"
            style={{
              backgroundColor: "rgba(14, 107, 67, 0.78)",
              border: "1px solid rgba(14, 107, 67, 0.45)",
              backdropFilter: "saturate(120%)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "rgba(14, 107, 67, 0.9)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor =
                "rgba(14, 107, 67, 0.78)";
            }}
            title="عرض كل تفاصيل السجل"
          >
            <Eye className="size-3.5" />
            عرض كامل
          </button>
        </div>
      ),
    },
  ];

  async function runAi() {
    try {
      setAiLoading(true);
      setAiMsg(null);
      const res = await httpPost<{ message: string }>(ENDPOINTS.analyze, {
        filters: { date: selDate || "all", doctor: selDoctor, q: qKey },
        context: filtered.slice(0, 200),
      });
      setAiMsg(res?.message || "تم التحليل.");
    } catch {
      setAiMsg("تعذّر تشغيل التحليل الآن. تحقّقي من خدمة الذكاء الاصطناعي.");
    } finally {
      setAiLoading(false);
    }
  }

  const pageBg =
    "linear-gradient(180deg,#F5F7FB 0%,#E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,.15), transparent 60%)";

  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <div className="grid grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
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
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Content */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            title="العودة للصفحة الرئيسية"
            aria-label="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          <div className="flex items-center justify-between gap-4 mt-2">
            <div
              className="text-xl md:text-2xl font-semibold"
              style={{ color: brand.green }}
            >
              السجلات الطبية
            </div>

            {/* أدوات */}
            <div className="flex items-end gap-3 flex-wrap">
              {/* search */}
              <div className="relative w-[320px] max-w-[45vw]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                  placeholder="ابحث باسم الطبيب/المريض/ICD/الشكوى…"
                  aria-label="بحث في السجلات"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
              </div>

              {/* doctor filter + clear */}
              <Dropdown
                label="الطبيب"
                value={selDoctor}
                onChange={setSelDoctor}
                options={["الكل", ...doctors]}
              />
              {selDoctor !== "الكل" && (
                <button
                  onClick={() => setSelDoctor("الكل")}
                  className="h-10 px-3 rounded-full bg-white border text-sm flex items-center gap-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <X className="size-4" /> مسح
                </button>
              )}

              {/* date picker */}
              <div className="flex flex-col">
                <label className="text-[11px] text-black/60 pr-1 mb-1">
                  التاريخ
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={selDate}
                    onChange={(e) => setSelDate(e.target.value)}
                    className="h-10 rounded-full border px-10 pr-3 text-sm text-neutral-800 focus:outline-none focus:ring-4 tabular-nums"
                    style={{
                      borderColor: brand.green,
                      backgroundColor: "#ffffff",
                      minWidth: 200,
                    }}
                    aria-label="تحديد التاريخ"
                  />
                  <CalendarDays
                    className="absolute left-3 top-1/2 -translate-y-1/2 size-4"
                    style={{ color: brand.green }}
                  />
                </div>
              </div>
              {selDate && (
                <button
                  onClick={() => setSelDate("")}
                  className="h-10 px-3 rounded-full bg-white border text-sm flex items-center gap-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <X className="size-4" /> مسح التاريخ
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Skeleton عند التحميل الأولي */}
          {loading && rows.length === 0 && (
            <div className="mt-6 grid gap-4">
              <div className="h-20 bg-white rounded-2xl animate-pulse" />
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
              <div className="h-[460px] bg-white rounded-2xl animate-pulse" />
            </div>
          )}

          {!loading && (
            <>
              {/* KPIs */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 md:max-w-[760px]">
                <StatPill
                  title="عدد السجلات"
                  value={filtered.length || totalRecords}
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

              {/* AI + Chart */}
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-5">
                <div className="rounded-2xl shadow-ai overflow-hidden">
                  <div
                    className="min-h-[200px] h-full p-5 text-white flex flex-col justify-between"
                    style={{
                      background:
                        "linear-gradient(135deg,#2B2D6B 0%,#4C4DE9 42%,#0D16D1 100%)",
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">تحليل</span>
                        <Bot className="size-5 text-white" />
                      </div>
                      <button
                        className="h-9 px-4 rounded-full bg-white text-[#0D16D1] text-sm font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                        onClick={runAi}
                        disabled={aiLoading || loading}
                        aria-label="تشغيل تحليل الذكاء الاصطناعي"
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
                    <p className="mt-4 text-white/95 leading-relaxed text-sm text-center">
                      {aiMsg ??
                        "اضغطي «تشغيل» لتحليل أنماط السجلات وفق الفلاتر الحالية."}
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl bg-white shadow-soft p-5">
                  <div className="mb-3 font-semibold text-neutral-700">
                    عدد السجلات لكل طبيب
                  </div>
                  <div
                    ref={chartBoxRef}
                    style={{
                      width: "100%",
                      height: 360,
                      minWidth: 320,
                      minHeight: 200,
                    }}
                  >
                    {chartData.length > 0 && chartReady ? (
                      <ResponsiveContainer
                        width="100%"
                        height="100%"
                        debounce={80}
                        key={`${chartSize.width}x${chartSize.height}-${chartData.length}`}
                      >
                        <BarChart
                          data={chartData}
                          margin={{ top: 10, right: 24, left: 8, bottom: 28 }}
                          barCategoryGap={30}
                          barGap={6}
                        >
                          <CartesianGrid
                            vertical={false}
                            strokeDasharray="3 3"
                            stroke="#E5E7EB"
                          />
                          <defs>
                            <linearGradient
                              id="barGrad"
                              x1="0"
                              y1="0"
                              x2="0"
                              y2="1"
                            >
                              <stop
                                offset="0%"
                                stopColor="#4C4DE9"
                                stopOpacity="0.95"
                              />
                              <stop
                                offset="100%"
                                stopColor="#0D16D1"
                                stopOpacity="0.95"
                              />
                            </linearGradient>
                          </defs>
                          <XAxis
                            dataKey="doctor"
                            tick={{ fontSize: 12, fill: "#374151" }}
                            angle={-15}
                            interval={0}
                            height={54}
                            tickLine={false}
                            axisLine={{ stroke: "#E5E7EB" }}
                          />
                          <YAxis
                            ticks={yMeta.ticks}
                            domain={[0, yMeta.top]}
                            tick={{ fontSize: 12, fill: "#374151" }}
                            axisLine={false}
                            tickLine={false}
                            width={36}
                          />
                          <RTooltip
                            contentStyle={{
                              backgroundColor: "white",
                              borderRadius: 12,
                              boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                              border: "1px solid #E5E7EB",
                            }}
                            formatter={(v) => [`${v}`, "عدد السجلات"]}
                            labelFormatter={(l) => `الطبيب: ${l}`}
                          />
                          <Bar
                            dataKey="count"
                            barSize={44}
                            radius={[12, 12, 8, 8]}
                            fill="url(#barGrad)"
                            animationDuration={500}
                            animationBegin={100}
                          >
                            <LabelList
                              dataKey="count"
                              position="top"
                              formatter={(v: number) => `${v}`}
                              fontSize={12}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full grid place-items-center text-neutral-500 text-sm">
                        {chartData.length === 0
                          ? "لا توجد بيانات مطابقة للفلاتر الحالية"
                          : "جاري تهيئة الرسم…"}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Table */}
              <div className="rounded-2xl mt-6 p-4 bg-white shadow-soft">
                {filtered.length === 0 ? (
                  <div className="h-[420px] grid place-items-center text-center text-neutral-500">
                    <div>
                      <div className="text-lg font-medium mb-1">
                        لا توجد بيانات
                      </div>
                      <div className="text-sm">
                        جرّبي تغيير الفلاتر أو إزالة البحث.
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    className="ag-theme-quartz"
                    style={{ width: "100%", height: 450 }}
                  >
                    <AgGridReact<MedRow>
                      rowData={filtered ?? []}
                      columnDefs={colDefs}
                      getRowId={(p: GetRowIdParams<MedRow>) =>
                        String(
                          p.data?.id ?? `${p.data?.doctor_name}-${p.rowIndex}`
                        )
                      }
                      animateRows
                      suppressDragLeaveHidesColumns
                      enableCellTextSelection
                      defaultColDef={{
                        sortable: true,
                        resizable: true,
                        flex: 1,
                        tooltipValueGetter: (p) => String(p.value ?? ""),
                      }}
                      rowHeight={56}
                      headerHeight={46}
                      overlayNoRowsTemplate="<span style='padding:8px;display:inline-block;color:#6b7280'>لا توجد بيانات</span>"
                    />
                  </div>
                )}
              </div>

              {/* Viewer */}
              {showViewer && viewRow && (
                <RecordViewer row={viewRow} onClose={closeViewer} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ===================== Sub Components ===================== */

// يعرض سطرًا واحدًا مع ellipsis فقط (بدون قصّ نص برمجيًا)
function ClipCell({ text }: { text: string }) {
  const t = typeof text === "string" ? text : "";
  return (
    <span
      title={t}
      style={{
        display: "inline-block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        verticalAlign: "bottom",
      }}
    >
      {t}
    </span>
  );
}

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
        "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
        active ? "text-[#0D16D1] border border-black/10" : "hover:bg-black/5"
      )}
      style={active ? { backgroundColor: brand.accent } : {}}
      aria-current={active ? "page" : undefined}
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
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  return (
    <div className="relative min-w-[11rem]" ref={ref}>
      <label className="text-[11px] text-black/60 pr-1 block mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-10 w-full rounded-full text-white font-semibold px-4 flex items-center justify-between text-sm shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        style={{ backgroundColor: brand.green }}
        onMouseEnter={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
            brand.greenHover)
        }
        onMouseLeave={(e) =>
          ((e.currentTarget as HTMLButtonElement).style.backgroundColor =
            brand.green)
        }
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`تغيير ${label}`}
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
        <ul
          className="absolute mt-2 w-[260px] max-h-[300px] overflow-auto bg-white rounded-xl border border-gray-200 shadow-lg z-50"
          style={{ scrollbarWidth: "thin" as any }}
          role="listbox"
        >
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-right px-4 py-2 text-[13px] leading-5 hover:bg-emerald-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300",
                  value === opt && "bg-emerald-50 font-semibold text-[#0E6B43]"
                )}
                title={opt}
                role="option"
                aria-selected={value === opt}
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

/* ===================== Viewer (Drawer) ===================== */
function RecordViewer({ row, onClose }: { row: MedRow; onClose: () => void }) {
  const badge = (txt: string, color: string) => (
    <span
      className="px-3 py-1 text-xs rounded-full font-semibold"
      style={{ background: `${color}22`, color }}
    >
      {txt}
    </span>
  );

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px]"
      onClick={onClose}
      dir="rtl"
    >
      <div
        className="absolute top-0 bottom-0 right-0 w-full max-w-[720px] bg-white shadow-2xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{ borderTopLeftRadius: 24, borderBottomLeftRadius: 24 }}
        aria-modal="true"
        role="dialog"
      >
        {/* Header */}
        <div
          className="px-6 py-5 flex items-center justify-between"
          style={{
            background:
              "linear-gradient(135deg, #0E6B43 0%, #1B5A45 60%, #2C7A63 100%)",
            color: "white",
            borderTopLeftRadius: 24,
          }}
        >
          <div className="text-lg md:text-xl font-semibold">
            تفاصيل السجل الطبي
          </div>
          <button
            onClick={onClose}
            className="h-9 w-9 rounded-full bg-white/15 hover:bg-white/25 grid place-items-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
            title="إغلاق"
            aria-label="إغلاق"
          >
            <X className="size-5 text-white" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Top badges */}
          <div className="flex flex-wrap items-center gap-2">
            {row.claim_type &&
              badge(`نوع المطالبة: ${row.claim_type}`, "#0D16D1")}
            {row.emer_ind && badge(`عاجل: ${row.emer_ind}`, "#B45309")}
            {row.refer_ind && badge(`تحويل: ${row.refer_ind}`, "#2563EB")}
            {row.contract && badge("يوجد عقد", "#065F46")}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="اسم الطبيب" value={row.doctor_name} />
            <Field label="اسم المريض" value={row.patient_name} />

            <Field
              label="التاريخ"
              value={
                <div className="flex items-center gap-2">
                  <CalendarDays
                    className="size-4"
                    style={{ color: brand.green }}
                  />
                  <span className="tabular-nums">
                    {row.treatment_date || "—"}
                  </span>
                </div>
              }
            />
            <Field label="ICD10" value={row.ICD10CODE} />

            <Field
              label="الشكوى الرئيسية"
              value={row.chief_complaint}
              full
              multiline
            />

            {row.contract && <Field label="العقد" value={row.contract} full />}

            {row.ai_analysis && (
              <Field label="تحليل AI" value={row.ai_analysis} full multiline />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  full,
  multiline,
}: {
  label: string;
  value: React.ReactNode;
  full?: boolean;
  multiline?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="text-[12px] text-black/60 mb-1">{label}</div>
      <div
        className={clsx(
          "rounded-2xl border px-3 py-2",
          multiline ? "whitespace-pre-wrap leading-7" : ""
        )}
        style={{ background: "#F7FAF9", borderColor: "#E5F0EB" }}
        title={typeof value === "string" ? value : undefined}
      >
        {value || "—"}
      </div>
    </div>
  );
}
