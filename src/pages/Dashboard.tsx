// src/pages/MedicalRecords.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
  LogOut,
  Home,
  Search,
  X,
  Pill,
  Shield,
  History,
  CalendarDays,
  Bot,
  Filter,
  Bell,
  Users,
  UserPlus,
  ClipboardList,
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
  Cell,
} from "recharts";

/* ===================== Theme ===================== */
const theme = {
  brandDark: "#0E6B43",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F7FB",
  ink: "#0B0F14",
  border: "#E6EEF0",

  // ألوان البطاقات (ثابتة)
  kpiBlue: "#2563EB",
  kpiYellow: "#F59E0B",
  kpiRed: "#EF4444",
  kpiGreen: "#10B981",
};

const pageBg =
  "linear-gradient(180deg,#F5F9F7 0%,#ECF5F2 100%), radial-gradient(800px 500px at 12% 8%, rgba(169,222,214,0.18) 0%, transparent 60%)";
const headerGrad = `linear-gradient(135deg, ${theme.brandDark} 0%, #0B3B3C 60%, ${theme.brandDark} 100%)`;

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
]);
const firstNameOf = (name: string) => {
  const parts = (name || "").trim().toLowerCase().split(/\s+/).filter(Boolean);
  const firstReal = parts.find((p) => !dropTitles.has(p)) || parts[0] || "";
  return toTitle(firstReal);
};

const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0610-\u061A]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[‐–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();

const firstIcd = (s: string) =>
  String(s || "")
    .split(/[,،;\n|]/)[0]
    ?.trim();
const brief = (s: string, max = 120) => {
  const t = (String(s || "").split(/[\n،,;-]/)[0] || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
};

// Levenshtein
function editDist(a: string, b: string) {
  a = normalize(a);
  b = normalize(b);
  if (a === b) return 0;
  const dp = Array.from({ length: a.length + 1 }, () =>
    new Array(b.length + 1).fill(0)
  );
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }
  return dp[a.length][b.length];
}

/* ===================== Types ===================== */
type MedRow = {
  id?: number | string;
  doctor_name: string;
  patient_name: string;
  treatment_date: string;
  ICD10CODE: string;
  chief_complaint: string;
  claim_type?: string;
  refer_ind?: string; // Y/N
  emer_ind?: string; // Y/N
  contract?: string;
  ai_analysis?: string;
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

/* ===================== Page ===================== */
export default function MedicalRecords() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // البيانات لبطاقات/قائمة السجلات
  const [rows, setRows] = useState<MedRow[]>([]);
  // بيانات الشارت (قد تكون أوسع من rows لتجنّب تصفية الطبيب)
  const [chartRows, setChartRows] = useState<MedRow[]>([]);

  // بحث/اقتراح
  const [q, setQ] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [patients, setPatients] = useState<string[]>([]);
  const [icds, setIcds] = useState<string[]>([]);
  const [recent, setRecent] = useState<string[]>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem("medical_recent") || "[]");
      } catch {
        return [];
      }
    })()
  );
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // فلاتر
  const [dateFrom, setDateFrom] = useState<string>(""); // سنرسل واحدًا فقط للباك-إند (انظر fetchData)
  const [dateTo, setDateTo] = useState<string>("");
  const [fDoctor, setFDoctor] = useState<string>("");
  const [fPatient, setFPatient] = useState<string>("");

  // شارت
  const [selectedDoctor, setSelectedDoctor] = useState<string>("");

  // مراجع
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  /* ============ Boot: جلب أولي ============ */
  useEffect(() => {
    fetchData(); // للبطاقات/القائمة
    fetchChartData(); // للشارت (بدون فلتر الطبيب)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============ إغلاق اقتراحات عند الضغط خارجًا ============ */
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        !suggestRef.current?.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      )
        setShowSuggest(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* ============ جلب من الخادم ============ */
  // تاريخ واحد فقط لأن الباك-إند يدعم "date" فقط
  const singleDate = useMemo(
    () => dateFrom || dateTo || "",
    [dateFrom, dateTo]
  );

  async function fetchData(opts?: { keepLoading?: boolean }) {
    try {
      if (!opts?.keepLoading) setLoading(true);
      setErr(null);
      // نرسل q فقط عندما قام المستخدم بالبحث
      const params: Record<string, string> = {};
      if (hasSearched && q.trim()) params.q = q.trim();
      if (fDoctor) params.doctor = fDoctor;
      if (fPatient) params.patient = fPatient;
      if (singleDate) params.date = singleDate;

      const data = await httpGet<RecordsResponse>(ENDPOINTS.records, params);
      const list = (data?.records || []).map((r, i) => ({
        id: r.id ?? i + 1,
        ...r,
      }));
      setRows(list);

      // بناء اقتراحات من نتائج آخر جلب
      const docSet = new Set<string>();
      const patSet = new Set<string>();
      const icdSet = new Set<string>();
      list.forEach((r) => {
        const dn = toTitle(r.doctor_name);
        if (dn && dn.toLowerCase() !== "nan") docSet.add(dn);
        const pn = toTitle(r.patient_name);
        if (pn && pn.toLowerCase() !== "nan") patSet.add(pn);
        const icd = firstIcd(r.ICD10CODE);
        if (icd) icdSet.add(icd);
      });
      setDoctors(Array.from(docSet).sort());
      setPatients(Array.from(patSet).sort());
      setIcds(Array.from(icdSet).sort());
    } catch (e: any) {
      setErr(e?.message || "تعذّر تحميل البيانات");
    } finally {
      if (!opts?.keepLoading) setLoading(false);
    }
  }

  // جلب للشارت: لا نرسل doctor حتى عند اختياره (حتى تُخفَّت الأعمدة فقط)
  async function fetchChartData() {
    try {
      const params: Record<string, string> = {};
      if (fPatient) params.patient = fPatient; // في وضع المريض، الشارت يعكس أطباء هذا المريض فقط
      if (singleDate) params.date = singleDate;
      const data = await httpGet<RecordsResponse>(ENDPOINTS.records, params);
      const list = (data?.records || []).map((r, i) => ({
        id: r.id ?? i + 1,
        ...r,
      }));
      setChartRows(list);
    } catch {
      // لا شيء
    }
  }

  // أي تغيير على الطبيب/المريض/التاريخ يعيد الجلب (فوري)
  useEffect(() => {
    fetchData();
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fDoctor, fPatient, singleDate]);

  /* ============ البحث النصّي مع Enter ============ */
  const qAsPatient = useMemo(() => {
    const s = toTitle(q.trim());
    return s && patients.includes(s) ? s : "";
  }, [q, patients]);

  function runSearch() {
    if (!q.trim()) return;
    setHasSearched(true);
    const newRecent = [q.trim(), ...recent.filter((x) => x !== q.trim())].slice(
      0,
      10
    );
    setRecent(newRecent);
    localStorage.setItem("medical_recent", JSON.stringify(newRecent));
    if (patients.includes(toTitle(q.trim()))) setFPatient(toTitle(q.trim()));
    fetchData(); // جلب مع q
    fetchChartData(); // الشارت لا يرسل q
    setShowSuggest(false);
  }

  /* ============ KPI ============ */
  const kpis = useMemo(() => {
    const list = rows;
    const byDoc: Record<string, number> = {};
    const patSet = new Set<string>();
    let alerts = 0;
    list.forEach((r) => {
      const n = firstNameOf(r.doctor_name || "");
      if (n && n.toLowerCase() !== "nan") byDoc[n] = (byDoc[n] ?? 0) + 1;
      const pn = toTitle(r.patient_name);
      if (pn && pn.toLowerCase() !== "nan") patSet.add(pn);
      if (
        (r.emer_ind || "").toUpperCase() === "Y" ||
        (r.refer_ind || "").toUpperCase() === "Y"
      )
        alerts++;
    });
    return {
      total: list.length,
      doctors: Object.keys(byDoc).length,
      patients: patSet.size,
      alerts,
    };
  }, [rows]);

  /* ============ Chart Data ============ */
  const chartData = useMemo(() => {
    const by: Record<string, number> = {};
    (chartRows.length ? chartRows : rows).forEach((r) => {
      const fn = firstNameOf(r.doctor_name || "");
      if (!fn || fn.toLowerCase() === "nan") return;
      by[fn] = (by[fn] ?? 0) + 1;
    });
    return Object.entries(by)
      .map(([doctor, count]) => ({ doctor, count }))
      .sort((a, b) => b.count - a.count);
  }, [chartRows, rows]);

  const yMeta = useMemo(() => {
    const max = chartData.reduce((m, c) => Math.max(m, c.count), 0);
    const step = max <= 10 ? 1 : max <= 20 ? 2 : max <= 40 ? 4 : 5;
    const top = Math.max(3, Math.ceil((max + step) / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { ticks, top };
  }, [chartData]);

  /* ===================== UI ===================== */
  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <div className="grid grid-cols-[280px_1fr]">
        {/* Sidebar */}
        <aside className="min-h-screen bg-white border-l sticky top-0 relative flex flex-col justify-between">
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
                icon={<Pill className="size-4" />}
                label="السجلات الطبية"
              />
              <SideItem
                icon={<Shield className="size-4" />}
                label="السجلات التأمينية"
                onClick={() => navigate("/insurance")}
              />
              <SideItem
                icon={<Pill className="size-4" />}
                label="السجلات الدوائية"
                onClick={() => navigate("/drugs")}
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

        {/* Content */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* Back */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            title="العودة للصفحة الرئيسية"
            aria-label="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: theme.brandDark }} />
          </button>

          {/* Header */}
          <div
            className="rounded-2xl p-5 text-white shadow-soft"
            style={{ background: headerGrad }}
          >
            <div className="text-2xl md:text-3xl font-semibold">
              السجلات الطبية
            </div>
            <div className="text-white/90 text-sm mt-1">
              اكتبي حرفًا أو كلمة؛ مثل <b>M</b> لعرض كل ما يبدأ بـ <b>M</b>. ثم
              Enter.
            </div>

            {/* Search */}
            <SearchBar
              q={q}
              setQ={setQ}
              setHasSearched={setHasSearched}
              suggestRef={suggestRef}
              inputRef={inputRef}
              suggestItems={buildSuggestItems(q, doctors, patients, icds)}
              didYouMean={didYouMean(q, doctors, patients, icds)}
              recent={recent}
              setRecent={setRecent}
              onRunSearch={runSearch}
              setShowSuggest={setShowSuggest}
              showSuggest={showSuggest}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
            />

            {/* Filters row */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {/* Date range (واجهة فقط، الخادم يستقبل تاريخًا واحدًا) */}
              <div className="flex items-center gap-1 bg-white/10 rounded-2xl px-2 py-1">
                <div
                  className="flex items-center gap-2 bg-white rounded-xl px-3 py-1"
                  style={{ border: "1px solid transparent" }}
                >
                  <CalendarDays className="size-4 text-black/70" />
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="h-9 bg-transparent outline-none text-[13px] text-black"
                    title="من تاريخ"
                  />
                  <span className="text-black/50 text-xs">إلى</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="h-9 bg-transparent outline-none text-[13px] text-black"
                    title="إلى تاريخ"
                  />
                </div>
              </div>

              {/* Chatbot */}
              <button
                onClick={() =>
                  navigate("/chat", {
                    state: {
                      query: q,
                      date: singleDate,
                      doctor: fDoctor,
                      patient: fPatient || qAsPatient,
                    },
                  })
                }
                className="h-10 px-4 rounded-xl text-sm font-semibold shadow-md transition"
                style={{ background: "#A7F3D0", color: theme.brandDark }}
                title="المساعد الذكي"
              >
                <span className="inline-flex items-center gap-1">
                  <Bot className="size-4" /> المساعد الذكي
                </span>
              </button>

              {/* Quick Filters */}
              <div
                className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border text-black"
                style={{ borderColor: theme.border }}
              >
                <Filter className="size-4 text-black/70" />
                <span className="text-sm">فلترة:</span>

                {/* Doctor */}
                <SelectWithArrow
                  value={fDoctor}
                  onChange={(v) => {
                    setFDoctor(v);
                    setSelectedDoctor(v || "");
                  }}
                  title="حسب الطبيب"
                  placeholder="كل الأطباء"
                  options={doctors}
                />

                {/* Patient */}
                <SelectWithArrow
                  value={fPatient}
                  onChange={(v) => setFPatient(v)}
                  title="حسب المريض"
                  placeholder="كل المرضى"
                  options={patients}
                />

                {(fDoctor || fPatient || dateFrom || dateTo) && (
                  <button
                    onClick={() => {
                      setFDoctor("");
                      setFPatient("");
                      setDateFrom("");
                      setDateTo("");
                      setSelectedDoctor("");
                    }}
                    className="h-9 px-3 rounded-lg text-sm border hover:bg-black/5 text-black"
                    style={{ borderColor: theme.border }}
                    title="إزالة جميع الفلاتر"
                  >
                    إعادة التعيين
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Errors / skeleton */}
          {err && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <X className="size-4" /> <span className="text-sm">{err}</span>
            </div>
          )}
          {loading && rows.length === 0 && (
            <div className="mt-6 grid gap-4">
              <div className="h-20 bg-white rounded-2xl animate-pulse" />
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
              <div className="h-[460px] bg-white rounded-2xl animate-pulse" />
            </div>
          )}

          {/* KPI Cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              title="عدد السجلات"
              value={kpis.total}
              color={theme.kpiBlue}
              icon={<ClipboardList className="size-5" />}
            />
            <KpiCard
              title="عدد الأطباء"
              value={kpis.doctors}
              color={theme.kpiYellow}
              icon={<UserPlus className="size-5" />}
            />
            <KpiCard
              title="عدد المرضى"
              value={kpis.patients}
              color={theme.kpiRed}
              icon={<Users className="size-5" />}
            />
            <KpiCard
              title="عدد التنبيهات"
              value={kpis.alerts}
              color={theme.kpiGreen}
              icon={<Bell className="size-5" />}
            />
          </div>

          {/* Chart */}
          <div
            className="mt-6 rounded-2xl bg-white shadow-soft p-5 border"
            style={{ borderColor: theme.border }}
          >
            <div className="mb-3 font-semibold text-neutral-700 flex items-center justify-between">
              <span>
                {fPatient || qAsPatient
                  ? `عدد سجلات المريض (${fPatient || qAsPatient}) لكل طبيب`
                  : "عدد السجلات لكل طبيب"}
              </span>
              {selectedDoctor && (
                <button
                  className="text-xs px-2 py-1 rounded-full border hover:bg-black/5"
                  style={{ borderColor: theme.border }}
                  onClick={() => setSelectedDoctor("")}
                >
                  إلغاء تمييز الطبيب
                </button>
              )}
            </div>
            <div
              style={{
                width: "100%",
                height: 360,
                minWidth: 320,
                minHeight: 200,
              }}
            >
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 24, left: 8, bottom: 28 }}
                    barCategoryGap={30}
                    barGap={6}
                    onClick={(e: any) => {
                      const name = e?.activeLabel as string | undefined;
                      if (name) setSelectedDoctor(name);
                    }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                    />
                    <defs>
                      <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="0%"
                          stopColor="#34D399"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor={theme.brandDark}
                          stopOpacity={0.95}
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
                      formatter={(v: any) => [
                        String(v),
                        fPatient || qAsPatient ? "سجلات المريض" : "عدد السجلات",
                      ]}
                      labelFormatter={(l: any) => `الطبيب: ${l}`}
                    />
                    <Bar
                      dataKey="count"
                      barSize={44}
                      radius={[12, 12, 8, 8]}
                      animationDuration={250}
                    >
                      {chartData.map((d, i) => {
                        const active =
                          !selectedDoctor || selectedDoctor === d.doctor;
                        return (
                          <Cell
                            key={`cell-${i}`}
                            fill="url(#barGrad)"
                            fillOpacity={active ? 1 : 0.25}
                            stroke={active ? "#34D399" : "transparent"}
                            strokeWidth={active ? 1.2 : 0}
                          />
                        );
                      })}
                      <LabelList
                        dataKey="count"
                        position="top"
                        formatter={(v: number) => String(v)}
                        fontSize={12}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full grid place-items-center text-neutral-500 text-sm">
                  لا توجد بيانات
                </div>
              )}
            </div>
          </div>

          {/* Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 print:gap-2">
            {rows.length === 0 && !loading ? (
              <div
                className="h-[160px] grid place-items-center text-neutral-500 text-sm border rounded-2xl bg-white"
                style={{ borderColor: theme.border }}
              >
                لا توجد بيانات مطابقة — عدّلي مفتاح البحث أو الفلاتر
              </div>
            ) : (
              rows.map((r) => (
                <RecordCard
                  key={String(r.id ?? r.patient_name + r.treatment_date)}
                  r={r}
                />
              ))
            )}
          </div>
        </main>
      </div>
    </div>
  );
}

/* ===================== Sub Components ===================== */
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
        active ? "text-[#0B3B3C] border border-black/10" : "hover:bg-black/5"
      )}
      style={active ? { backgroundColor: "#E6FFF4" } : {}}
      aria-current={active ? "page" : undefined}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

/* ===== بطاقة KPI بتدرّج فاتح + الأيقونة في الجهة المقابلة، وبدون (...) ===== */
function KpiCard({
  title,
  value,
  color,
  icon,
}: {
  title: string;
  value: number | string;
  color: string;
  icon: React.ReactNode;
}) {
  const grad = `linear-gradient(135deg, ${color} 0%, rgba(255,255,255,0.35) 100%)`;
  return (
    <div
      className="relative rounded-2xl text-white p-4 overflow-hidden shadow-soft"
      style={{ background: grad }}
    >
      {/* كبسولة الأيقونة (بالجهة الأخرى) */}
      <div className="absolute top-3 left-3">
        <div className="w-10 h-10 rounded-xl bg-white/25 backdrop-blur-sm grid place-items-center">
          {icon}
        </div>
      </div>

      {/* موجة زخرفية فاتحة */}
      <svg
        width="140"
        height="46"
        viewBox="0 0 120 40"
        className="absolute right-6 top-8 opacity-30"
      >
        <path
          d="M0,20 C20,0 40,40 60,20 C80,0 100,40 120,20"
          fill="none"
          stroke="white"
          strokeWidth="4"
          strokeLinecap="round"
        />
      </svg>

      <div className="mt-8 text-3xl font-semibold tabular-nums text-right">
        {value}
      </div>
      <div className="opacity-95 text-right">{title}</div>
    </div>
  );
}

/* ===== عنصر select مع سهم أعلى النص ===== */
function SelectWithArrow({
  value,
  onChange,
  options,
  placeholder,
  title,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  title?: string;
}) {
  return (
    <div className="relative">
      {/* السهم أعلى النص */}
      <svg
        width="10"
        height="6"
        viewBox="0 0 10 6"
        className="absolute -top-2 left-1/2 -translate-x-1/2"
        aria-hidden="true"
      >
        <path
          d="M0,6 L5,0 L10,6"
          fill="none"
          stroke="#64748B"
          strokeWidth="1.5"
        />
      </svg>

      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        title={title}
        className="h-9 rounded-lg border px-2 text-sm text-black bg-white pr-6 appearance-none"
        style={{
          borderColor: theme.border,
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 20 20'%3E%3Cpath fill='%2364748B' d='M5.5 7.5l4.5 5 4.5-5z'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left 8px center",
        }}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </div>
  );
}

function RecordCard({ r }: { r: MedRow }) {
  const statusColor =
    (r.emer_ind || "").toUpperCase() === "Y"
      ? "#F59E0B"
      : (r.refer_ind || "").toUpperCase() === "Y"
      ? "#2563EB"
      : "#10B981";

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
      className="rounded-2xl border bg-white p-4 shadow-sm print:shadow-none print:p-3 transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-lg relative overflow-hidden"
      style={{ borderColor: theme.border }}
    >
      <div
        className="absolute right-0 top-0 h-full w-1.5"
        style={{ background: statusColor }}
      />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {r.claim_type &&
          badge(`نوع المطالبة: ${r.claim_type}`, theme.brandDark)}
        {(r.emer_ind || "").toUpperCase() === "Y" && badge("عاجل", "#B45309")}
        {(r.refer_ind || "").toUpperCase() === "Y" && badge("تحويل", "#2563EB")}
        {r.contract && badge("يوجد عقد", "#065F46")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="اسم الطبيب" value={r.doctor_name} />
        <Field label="اسم المريض" value={r.patient_name} />
        <Field
          label="التاريخ"
          value={
            <span className="tabular-nums">{r.treatment_date || "—"}</span>
          }
        />
        <Field label="ICD10" value={firstIcd(r.ICD10CODE) || "—"} />
        <Field
          label="الشكوى الرئيسية"
          value={brief(r.chief_complaint, 180)}
          full
          multiline
        />
        {r.contract && <Field label="العقد" value={r.contract} full />}
        {r.ai_analysis && (
          <Field label="تحليل AI" value={r.ai_analysis} full multiline />
        )}
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
        style={{ background: theme.surfaceAlt, borderColor: theme.border }}
        title={typeof value === "string" ? value : undefined}
      >
        {value || "—"}
      </div>
    </div>
  );
}

/* ====== SearchBar مُحسّن (مظهر احترافي) ====== */
function SearchBar(props: {
  q: string;
  setQ: (v: string) => void;
  setHasSearched: (v: boolean) => void;
  suggestRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  suggestItems: {
    label: string;
    kind: "doctor" | "patient" | "icd" | "text";
  }[];
  didYouMean: string;
  recent: string[];
  setRecent: (v: string[]) => void;
  onRunSearch: () => void;
  showSuggest: boolean;
  setShowSuggest: (b: boolean) => void;
  activeIdx: number;
  setActiveIdx: (n: number) => void;
}) {
  const {
    q,
    setQ,
    setHasSearched,
    suggestRef,
    inputRef,
    suggestItems,
    didYouMean,
    recent,
    setRecent,
    onRunSearch,
    showSuggest,
    setShowSuggest,
    activeIdx,
    setActiveIdx,
  } = props;

  const apply = (s: { label: string }) => {
    setQ(s.label);
    setHasSearched(true);
    setShowSuggest(false);
    setTimeout(onRunSearch, 0);
  };

  return (
    <div className="mt-4 relative" ref={suggestRef}>
      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setShowSuggest(true);
              setActiveIdx(0);
            }}
            onFocus={() => setShowSuggest(true)}
            onKeyDown={(e) => {
              if (
                showSuggest &&
                (e.key === "ArrowDown" ||
                  e.key === "ArrowUp" ||
                  e.key === "Tab" ||
                  e.key === "Enter")
              ) {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  setActiveIdx(
                    Math.min(activeIdx + 1, suggestItems.length - 1)
                  );
                  return;
                }
                if (e.key === "ArrowUp") {
                  e.preventDefault();
                  setActiveIdx(Math.max(activeIdx - 1, 0));
                  return;
                }
                if (
                  (e.key === "Enter" || e.key === "Tab") &&
                  suggestItems[activeIdx]
                ) {
                  e.preventDefault();
                  apply(suggestItems[activeIdx]);
                  return;
                }
              }
              if (e.key === "Enter") onRunSearch();
            }}
            className="w-full h-12 rounded-2xl pl-10 pr-4 outline-none placeholder:text-black/60"
            style={{
              background: "#F7FAF9",
              border: `1px solid ${theme.border}`,
              boxShadow: "inset 0 1px 2px rgba(0,0,0,0.06)",
              color: "#111827",
            }}
            placeholder="ابحثي باسم طبيب/مريض/ICD/نص حر… ثم Enter"
            aria-label="بحث موحّد"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/70" />
          {showSuggest && (
            <div className="absolute z-50 mt-2 w-full bg-white border rounded-xl shadow-xl">
              {didYouMean && (
                <div className="px-3 py-2 text-[12px] text-[#9A4A07] bg-[#FFF6E3] rounded-t-xl">
                  هل تقصدين:{" "}
                  <button
                    className="underline font-semibold"
                    onClick={() => {
                      setQ(didYouMean);
                      setShowSuggest(false);
                      setTimeout(onRunSearch, 0);
                    }}
                  >
                    {didYouMean}
                  </button>{" "}
                  ؟
                </div>
              )}
              <ul className="max-h-[260px] overflow-auto">
                {suggestItems.length > 0 ? (
                  suggestItems.map((s, i) => (
                    <li key={`${s.kind}-${s.label}`}>
                      <button
                        className={clsx(
                          "w-full text-right px-4 py-2 text-[13px] leading-6 hover:bg-emerald-50 flex items-center justify-between",
                          i === activeIdx && "bg-emerald-50"
                        )}
                        style={{ color: theme.ink }}
                        onMouseEnter={() => setActiveIdx(i)}
                        onClick={() => apply(s)}
                        title={s.label}
                      >
                        <span className="truncate">{s.label}</span>
                        <span className="text-[11px] text-black/60">
                          {s.kind === "doctor"
                            ? "doctor"
                            : s.kind === "patient"
                            ? "patient"
                            : s.kind === "icd"
                            ? "icd"
                            : "text"}
                        </span>
                      </button>
                    </li>
                  ))
                ) : (
                  <div className="px-4 py-3 text-sm text-neutral-500">
                    لا توجد اقتراحات
                  </div>
                )}
              </ul>
              {recent.length > 0 && (
                <div className="border-t p-2">
                  <div className="px-2 pb-1 text-[11px] text-black/60 flex items-center gap-1">
                    <History className="size-3.5" /> عمليات بحث سابقة
                  </div>
                  <div className="px-2 pb-2 flex flex-wrap gap-2">
                    {recent.slice(0, 8).map((r) => (
                      <button
                        key={r}
                        className="h-7 px-2 rounded-full bg-black/5 text-[12px] hover:bg-black/10"
                        onClick={() => {
                          setQ(r);
                          setShowSuggest(false);
                          setTimeout(onRunSearch, 0);
                        }}
                        title={r}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ======= Utils لبناء الاقتراحات وDidYouMean ======= */
function buildSuggestItems(
  q: string,
  doctors: string[],
  patients: string[],
  icds: string[]
) {
  const key = normalize(q);
  const pool: { label: string; kind: "doctor" | "patient" | "icd" | "text" }[] =
    [];
  doctors.forEach((d) => pool.push({ label: d, kind: "doctor" }));
  patients.forEach((p) => pool.push({ label: p, kind: "patient" }));
  icds.forEach((i) => pool.push({ label: i, kind: "icd" }));

  if (!key) return pool.slice(0, 8);

  const starts = pool.filter((s) => normalize(s.label).startsWith(key));
  const contains = pool.filter(
    (s) =>
      !normalize(s.label).startsWith(key) && normalize(s.label).includes(key)
  );
  const out = [...starts.slice(0, 6), ...contains.slice(0, 4)];
  return out.slice(0, 8);
}

function didYouMean(
  q: string,
  doctors: string[],
  patients: string[],
  icds: string[]
) {
  const key = normalize(q);
  if (!key || key.length < 3) return "";
  const candidates = [...doctors, ...patients, ...icds];
  let best = "",
    bestDist = Infinity;
  candidates.forEach((c) => {
    const d = editDist(normalize(c), key);
    if (d < bestDist) {
      best = c;
      bestDist = d;
    }
  });
  return bestDist > 0 && bestDist <= Math.max(3, Math.floor(key.length * 0.5))
    ? best
    : "";
}
