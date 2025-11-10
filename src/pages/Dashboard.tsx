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
  Upload,
  Bot,
  Filter,
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

/* ===================== Theme (ألوان قوية ورسمية) ===================== */
const theme = {
  deep: "#0E6B43", // أخضر رسمي (مطابق للشعار)
  deep2: "#0B3B3C", // أعمق للعناوين/الأزرار
  accent: "#97FC4A", // إبراز
  blue: "#0D16D1",
  mint: "#8ADE9D",
  mintSoft: "#EAF7F0",
  surface: "#FFFFFF",
  surfaceAlt: "#F5F7FB",
  border: "#E6EEF0",
  ink: "#0B0F14", // أسود قوي (لقائمة الاقتراحات)
  inkMuted: "#475569",
};
const gradientHeader = `linear-gradient(135deg, ${theme.deep} 0%, ${theme.deep2} 55%, ${theme.deep} 100%)`;
const pageBg = `linear-gradient(180deg,#F5F9F7 0%,#ECF5F2 100%), radial-gradient(800px 500px at 12% 8%, ${theme.mintSoft} 0%, transparent 60%)`;

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
const brief = (s: string, max = 56) => {
  const t = (String(s || "").split(/[\n،,;-]/)[0] || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
};

// Levenshtein (للتصحيح الإملائي)
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
  upload: USE_PROXY ? "/api/medical/upload" : "/medical/upload",
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

async function httpUpload(path: string, file: File) {
  const full = joinUrl(API_BASE, path);
  const form = new FormData();
  form.append("file", file);
  const r = await fetch(full, {
    method: "POST",
    body: form,
    credentials: "include",
  });
  if (!r.ok) throw new Error(await r.text());
  try {
    return await r.json();
  } catch {
    return { ok: true };
  }
}

/* ===================== Page ===================== */
export default function MedicalRecords() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // بيانات خام من الخادم
  const [rows, setRows] = useState<MedRow[]>([]);

  // بحث نصّي
  const [q, setQ] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  // اقتراحات
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

  // فلاتر إضافية
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [fDoctor, setFDoctor] = useState<string>(""); // فلتر الطبيب
  const [fPatient, setFPatient] = useState<string>(""); // فلتر المريض

  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);
  const chartReadyRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  /* ============ Load data ============ */
  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await httpGet<RecordsResponse>(ENDPOINTS.records);
        if (cancel) return;
        const list = (data?.records || []).map((r, i) => ({
          id: r.id ?? i + 1,
          ...r,
        }));
        setRows(list);

        // كيانات للاقتراح
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
        if (!cancel) setErr(e?.message || "تعذّر تحميل البيانات");
      } finally {
        if (!cancel) setLoading(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  // إغلاق الاقتراحات عند الضغط خارجها
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (
        !suggestRef.current?.contains(e.target as Node) &&
        !inputRef.current?.contains(e.target as Node)
      ) {
        setShowSuggest(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  /* ============ Filtering Pipeline ============ */
  const normalizeDate = (d: string) =>
    d ? new Date(d.replace(/-/g, "/")) : null;
  const withinDate = (isoOrText: string) => {
    if (!dateFrom && !dateTo) return true;
    const d = new Date(isoOrText);
    if (isNaN(d.getTime())) return true; // لو التاريخ نصي غير قابل للتحويل نتجاوزه
    const from = normalizeDate(dateFrom);
    const to = normalizeDate(dateTo);
    if (from && d < from) return false;
    if (to) {
      // نهاية اليوم
      const t2 = new Date(to);
      t2.setHours(23, 59, 59, 999);
      if (d > t2) return false;
    }
    return true;
  };

  // فلترة البحث (prefix-first)
  const searchFiltered = useMemo(() => {
    if (!hasSearched || !q.trim()) return rows;
    const key = normalize(q);
    const isPrefixMode = key.length === 1 || /^[a-zA-Z]$/.test(key);
    return rows
      .filter((r) => {
        const fields = [
          r.doctor_name,
          r.patient_name,
          r.ICD10CODE,
          r.chief_complaint,
          r.treatment_date,
          r.claim_type,
          r.contract,
          r.refer_ind,
          r.emer_ind,
        ].map((x) => normalize(String(x || "")));
        if (isPrefixMode && fields.some((f) => f.startsWith(key))) return true;
        return fields.some((f) => f.includes(key));
      })
      .sort((a, b) => {
        const p = (m: MedRow) =>
          [m.doctor_name, m.patient_name, m.ICD10CODE, m.chief_complaint].some(
            (v) => normalize(String(v || "")).startsWith(normalize(q))
          )
            ? 0
            : 1;
        return p(a) - p(b);
      });
  }, [rows, hasSearched, q]);

  // فلترة التاريخ + الطبيب + المريض
  const fullyFiltered = useMemo(() => {
    return searchFiltered.filter((r) => {
      if (!withinDate(String(r.treatment_date || ""))) return false;
      if (fDoctor && toTitle(r.doctor_name) !== fDoctor) return false;
      if (fPatient && toTitle(r.patient_name) !== fPatient) return false;
      return true;
    });
  }, [searchFiltered, dateFrom, dateTo, fDoctor, fPatient]);

  /* ============ Suggestions ============ */
  type Sug = { label: string; kind: "doctor" | "patient" | "icd" | "text" };
  const suggestItems = useMemo<Sug[]>(() => {
    const key = normalize(q);
    const pool: Sug[] = [];
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
  }, [q, doctors, patients, icds]);

  const didYouMean = useMemo(() => {
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
  }, [q, doctors, patients, icds]);

  /* ============ KPIs ============ */
  const kpis = useMemo(() => {
    const list = fullyFiltered;
    const byDoc: Record<string, number> = {};
    const patSet = new Set<string>();
    list.forEach((r) => {
      const name = firstNameOf(r.doctor_name || "");
      if (name && name.toLowerCase() !== "nan")
        byDoc[name] = (byDoc[name] ?? 0) + 1;
      const pn = toTitle(r.patient_name);
      if (pn && pn.toLowerCase() !== "nan") patSet.add(pn);
    });
    const alerts = list.filter(
      (r) =>
        String(r.emer_ind || "").toUpperCase() === "Y" ||
        String(r.refer_ind || "").toUpperCase() === "Y"
    ).length;

    return {
      total: list.length,
      doctors: Object.keys(byDoc).length,
      patients: patSet.size,
      alerts,
    };
  }, [fullyFiltered]);

  /* ============ Chart ============ */
  const chartData = useMemo(() => {
    if (!hasSearched) return [];
    const by: Record<string, number> = {};
    fullyFiltered.forEach((r) => {
      const fn = firstNameOf(r.doctor_name || "");
      if (!fn || fn.toLowerCase() === "nan") return;
      by[fn] = (by[fn] ?? 0) + 1;
    });
    return Object.entries(by).map(([doctor, count]) => ({ doctor, count }));
  }, [fullyFiltered, hasSearched]);

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
          {/* Back to Home */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            title="العودة للصفحة الرئيسية"
            aria-label="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: theme.deep2 }} />
          </button>

          {/* Header */}
          <div
            className="rounded-2xl p-5 text-white shadow-soft"
            style={{ background: gradientHeader }}
          >
            <div className="text-2xl md:text-3xl font-semibold">
              السجلات الطبية
            </div>
            <div className="text-white/90 text-sm mt-1">
              اكتبي حرفًا أو كلمة؛ مثل <b>M</b> لعرض كل ما يبدأ بـ <b>M</b>.
              اضغطي Enter للبحث.
            </div>

            {/* Search + Actions */}
            <div className="mt-4">
              <div className="flex flex-col gap-3">
                {/* Row 1: Search + Buttons */}
                <div
                  className="flex flex-col md:flex-row items-stretch md:items-center gap-2"
                  ref={suggestRef}
                >
                  {/* Search */}
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
                            setActiveIdx((i) =>
                              Math.min(i + 1, suggestItems.length - 1)
                            );
                            return;
                          }
                          if (e.key === "ArrowUp") {
                            e.preventDefault();
                            setActiveIdx((i) => Math.max(i - 1, 0));
                            return;
                          }
                          if (
                            (e.key === "Enter" || e.key === "Tab") &&
                            suggestItems[activeIdx]
                          ) {
                            e.preventDefault();
                            applySuggestion(suggestItems[activeIdx]);
                            return;
                          }
                        }
                        if (e.key === "Enter") runSearch();
                      }}
                      className="w-full h-12 rounded-2xl border text-neutral-900 pl-10 pr-4 outline-none placeholder:text-black/70 focus:ring-4"
                      style={{
                        background: theme.mintSoft,
                        borderColor: theme.accent,
                        boxShadow: "0 6px 18px rgba(11,59,60,0.06)",
                      }}
                      placeholder="ابحثي باسم طبيب/مريض/ICD/نص حر… ثم Enter"
                      aria-label="بحث موحّد"
                    />
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/60" />
                    {/* Suggestions */}
                    {showSuggest && (
                      <div className="absolute z-50 mt-2 w-full bg-white border rounded-xl shadow-xl">
                        {/* Did you mean */}
                        {didYouMean && (
                          <div className="px-3 py-2 text-[12px] text-[#9A4A07] bg-[#FFF6E3] rounded-t-xl">
                            هل تقصدين:{" "}
                            <button
                              className="underline font-semibold"
                              onClick={() => {
                                setQ(didYouMean);
                                setShowSuggest(false);
                                setTimeout(runSearch, 0);
                              }}
                            >
                              {didYouMean}
                            </button>{" "}
                            ؟
                          </div>
                        )}

                        {/* List */}
                        <ul className="max-h-[260px] overflow-auto">
                          {suggestItems.length > 0 ? (
                            suggestItems.map((s, i) => (
                              <li key={`${s.kind}-${s.label}`}>
                                <button
                                  className={clsx(
                                    "w-full text-right px-4 py-2 text-[13px] leading-6 hover:bg-emerald-50 flex items-center justify-between",
                                    i === activeIdx && "bg-emerald-50"
                                  )}
                                  style={{ color: theme.ink }} // نص أسود واضح
                                  onMouseEnter={() => setActiveIdx(i)}
                                  onClick={() => applySuggestion(s)}
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

                        {/* Recent */}
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
                                    setTimeout(runSearch, 0);
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

                  {/* Buttons */}
                  <div className="flex items-center gap-2">
                    {/* Date Range */}
                    <div className="flex items-center gap-1 bg-white/15 rounded-2xl px-2 py-1">
                      <div className="flex items-center gap-1 bg-white rounded-xl px-2 py-1 border border-white/20">
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

                    {/* Upload Excel */}
                    <input
                      ref={fileRef}
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={onPickExcel}
                    />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="h-12 px-4 rounded-2xl text-sm font-semibold shadow-md transition border border-white/30 bg-white text-[#{theme.deep2}] hover:brightness-95 flex items-center gap-2"
                      title="تحميل جدول Excel"
                    >
                      <Upload className="size-4" />
                      تحميل Excel
                    </button>

                    {/* Chatbot */}
                    <button
                      onClick={() =>
                        navigate("/chat", {
                          state: {
                            query: q,
                            dateFrom,
                            dateTo,
                            doctor: fDoctor,
                            patient: fPatient,
                          },
                        })
                      }
                      className="h-12 px-4 rounded-2xl text-sm font-semibold shadow-md transition bg-[color:#97FC4A] text-[color:#0B3B3C] hover:brightness-105 flex items-center gap-2"
                      title="المساعد الذكي"
                    >
                      <Bot className="size-4" />
                      المساعد الذكي
                    </button>

                    {/* Search CTA */}
                    <button
                      onClick={runSearch}
                      disabled={!q.trim()}
                      className={clsx(
                        "h-12 px-6 rounded-2xl text-sm font-semibold shadow-md transition",
                        q.trim()
                          ? "bg-white text-[color:#0B3B3C] border border-white/40 hover:bg-white/90"
                          : "bg-white/20 text-white/60 cursor-not-allowed border border-white/30"
                      )}
                      title="بحث"
                    >
                      بحث
                    </button>
                  </div>
                </div>

                {/* Row 2: Filters (Doctor/Patient) */}
                <div className="flex items-center gap-2">
                  <div
                    className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border"
                    style={{ borderColor: theme.border }}
                  >
                    <Filter className="size-4 text-black/60" />
                    <span className="text-sm text-black/70">فلترة:</span>

                    {/* Doctor */}
                    <select
                      value={fDoctor}
                      onChange={(e) => setFDoctor(e.target.value)}
                      className="h-9 rounded-lg border px-2 text-sm"
                      style={{
                        borderColor: theme.border,
                        background: theme.surfaceAlt,
                      }}
                      title="فلترة حسب الطبيب"
                    >
                      <option value="">كل الأطباء</option>
                      {doctors.map((d) => (
                        <option key={d} value={d}>
                          {d}
                        </option>
                      ))}
                    </select>

                    {/* Patient */}
                    <select
                      value={fPatient}
                      onChange={(e) => setFPatient(e.target.value)}
                      className="h-9 rounded-lg border px-2 text-sm"
                      style={{
                        borderColor: theme.border,
                        background: theme.surfaceAlt,
                      }}
                      title="فلترة حسب المريض"
                    >
                      <option value="">كل المرضى</option>
                      {patients.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                    </select>

                    {/* Reset quick */}
                    {(fDoctor || fPatient || dateFrom || dateTo) && (
                      <button
                        onClick={() => {
                          setFDoctor("");
                          setFPatient("");
                          setDateFrom("");
                          setDateTo("");
                        }}
                        className="h-9 px-3 rounded-lg text-sm border hover:bg-black/5"
                        style={{
                          borderColor: theme.border,
                          color: theme.deep2,
                        }}
                        title="إزالة جميع الفلاتر"
                      >
                        إعادة التعيين
                      </button>
                    )}
                  </div>
                </div>
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

          {/* KPIs */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Kpi
              title="عدد السجلات"
              value={kpis.total}
              bg="#FFFFFF"
              fg={theme.deep2}
              accent={theme.deep}
            />
            <Kpi
              title="عدد الأطباء"
              value={kpis.doctors}
              bg="#FFFFFF"
              fg={theme.deep2}
              accent={theme.deep}
            />
            <Kpi
              title="عدد المرضى"
              value={kpis.patients}
              bg="#FFFFFF"
              fg={theme.deep2}
              accent={theme.deep}
            />
            <Kpi
              title="عدد التنبيهات"
              value={kpis.alerts}
              bg="#FFFFFF"
              fg={theme.blue}
              accent={theme.blue}
            />
          </div>

          {/* Chart + Cards (بعد أول بحث أو وجود فلاتر) */}
          {(hasSearched || q || fDoctor || fPatient || dateFrom || dateTo) && (
            <>
              {/* Chart */}
              <div
                className="mt-6 rounded-2xl bg-white shadow-soft p-5 border"
                style={{ borderColor: theme.border }}
              >
                <div className="mb-3 font-semibold text-neutral-700">
                  عدد السجلات لكل طبيب
                </div>
                <div
                  ref={chartReadyRef}
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
                          if (name) setFDoctor(name); // فلترة بالنقر على العمود
                        }}
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
                              stopColor={theme.accent}
                              stopOpacity={0.95}
                            />
                            <stop
                              offset="100%"
                              stopColor={theme.deep}
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
                          formatter={(v: any) => [String(v), "عدد السجلات"]}
                          labelFormatter={(l: any) => `الطبيب: ${l}`}
                        />
                        <Bar
                          dataKey="count"
                          barSize={44}
                          radius={[12, 12, 8, 8]}
                          fill="url(#barGrad)"
                        >
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
                      {fullyFiltered.length === 0
                        ? "لا توجد بيانات"
                        : "جارٍ التجهيز…"}
                    </div>
                  )}
                </div>
              </div>

              {/* Cards */}
              <div className="mt-6 grid grid-cols-1 gap-4 print:gap-2">
                {fullyFiltered.length === 0 ? (
                  <div
                    className="h-[160px] grid place-items-center text-neutral-500 text-sm border rounded-2xl bg-white"
                    style={{ borderColor: theme.border }}
                  >
                    لا توجد بيانات مطابقة — عدّلي مفتاح البحث أو الفلاتر
                  </div>
                ) : (
                  fullyFiltered.map((r) => (
                    <RecordCard
                      key={String(r.id ?? r.patient_name + r.treatment_date)}
                      r={r}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );

  /* ======== Actions ======== */
  function runSearch() {
    if (!q.trim()) return;
    setHasSearched(true);
    const newRecent = [q.trim(), ...recent.filter((x) => x !== q.trim())].slice(
      0,
      10
    );
    setRecent(newRecent);
    localStorage.setItem("medical_recent", JSON.stringify(newRecent));
    setShowSuggest(false);
  }

  function applySuggestion(s: { label: string }) {
    setQ(s.label);
    setShowSuggest(false);
    setHasSearched(true);
  }

  async function onPickExcel(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setLoading(true);
      setErr(null);
      const res = await httpUpload(ENDPOINTS.upload, f);
      // إعادة تحميل البيانات بعد نجاح الرفع
      const data = await httpGet<RecordsResponse>(ENDPOINTS.records);
      const list = (data?.records || []).map((r, i) => ({
        id: r.id ?? i + 1,
        ...r,
      }));
      setRows(list);

      // إعادة بناء الاقتراحات
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

      alert("تم تحميل ملف Excel وتحديث السجلات بنجاح ✅");
    } catch (e: any) {
      alert(`تعذّر تحميل الملف أو تحديث السجلات:\n${e?.message || e}`);
    } finally {
      setLoading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
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
      style={active ? { backgroundColor: theme.mint } : {}}
      aria-current={active ? "page" : undefined}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

function Kpi({
  title,
  value,
  bg,
  fg,
  accent,
}: {
  title: string;
  value: number | string;
  bg: string;
  fg: string;
  accent: string;
}) {
  return (
    <div
      className="rounded-2xl px-5 py-3 shadow-soft border text-left relative overflow-hidden"
      style={{ backgroundColor: bg, color: fg, borderColor: theme.border }}
    >
      <div
        className="absolute left-0 top-0 h-full w-1.5"
        style={{ background: accent }}
        aria-hidden
      />
      <div className="text-sm opacity-80 mb-1">{title}</div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function RecordCard({ r }: { r: MedRow }) {
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
      className="rounded-2xl border bg-white p-4 shadow-sm print:shadow-none print:p-3"
      style={{ borderColor: theme.border }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {r.claim_type && badge(`نوع المطالبة: ${r.claim_type}`, theme.deep2)}
        {String(r.emer_ind || "").toUpperCase() === "Y" &&
          badge(`عاجل`, "#B45309")}
        {String(r.refer_ind || "").toUpperCase() === "Y" &&
          badge(`تحويل`, "#2563EB")}
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
          value={brief(r.chief_complaint, 160)}
          full
          multiline
        />
        {r.contract && <Field label="العقد" value={r.contract} full />}
        {r.ai_analysis && (
          <Field label="تحليل AI" value={r.ai_analysis} full multiline />
        )}
      </div>

      <div className="mt-3 flex items-center gap-2">
        <button
          className="h-9 px-3 rounded-lg text-sm border hover:bg-black/5"
          style={{ borderColor: theme.border, color: theme.deep2 }}
          title="إرسال هذه البطاقة للمساعد الذكي"
          onClick={() => {
            // يمكن لاحقًا تمرير تفاصيل السجل
            alert("سيتم تمرير هذا السجل إلى المساعد الذكي في التحديث القادم.");
          }}
        >
          إرسال للمساعد الذكي
        </button>
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
