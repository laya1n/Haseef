// src/pages/Insurance.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
  LogOut,
  Home,
  Search,
  X,
  Shield,
  Pill,
  Bell,
  Users,
  UserPlus,
  ClipboardList,
  CalendarDays,
  Filter,
  History,
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
import SmartChat from "@/components/SmartChat";

/* ===================== Theme ===================== */
const theme = {
  brandDark: "#0E6B43",
  brandMid: "#0B5A38",
  surfaceAlt: "#F5F7FB",
  ink: "#0B0F14",
  border: "#E6EEF0",
};
const pageBg =
  "linear-gradient(180deg,#F5F9F7 0%,#ECF5F2 100%), radial-gradient(800px 500px at 12% 8%, rgba(169,222,214,0.18) 0%, transparent 60%)";
const headerGrad = `linear-gradient(135deg, ${theme.brandDark} 0%, #0B3B3C 60%, ${theme.brandDark} 100%)`;

// UI tokens for the pretty sorting bar
const ui = {
  mintBg: "linear-gradient(180deg,#F0FDF9 0%, #E6FAF4 100%)",
  mintBorder: "#f1e6cfff",
  selectBg: "#FFFFFF",
  selectBorder: "#fae5d1ff",
  caret: "#14B8A6",
  hint: "#6B7280",
  text: "#0B0F14",
};

// chart + card color families
const aqua = { light: "#8eb7fbff", mid: "#3B82F6", dark: "#3B82F6" };
const amber = { dark: "#c68514ff", mid: "#F59E0B" };

/* ===================== Helpers ===================== */
const stripOuterQuotes = (s: string) =>
  String(s ?? "")
    .replace(/^[\s"“”'‚‹›«»]+/, "")
    .replace(/[\s"“”'‚‹›«»]+$/, "");

// Titleize
const toTitle = (s: string) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/[\\\/|]+/g, " ")
    .replace(/[.,;:_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

// Arabic/English robust normalizer
const nrm = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0610-\u061A]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\w\u0600-\u06FF]+/g, " ")
    .replace(/\d{3,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// company fuzzy match (UI label vs contract/company in row)
const coMatches = (rowCompany: string, selected: string) => {
  const a = nrm(rowCompany);
  const b = nrm(selected);
  if (!a || !b) return false;
  return a === b || a.startsWith(b) || b.startsWith(a) || a.includes(b);
};

// abbreviate long company strings for axis/tooltip (more aggressive)
const abbreviateCompany = (s: string, maxWords = 3) => {
  const cleaned = (s || "")
    .replace(/\d{3,}/g, " ")
    .replace(/[^\w\u0600-\u06FF]+/g, " ")
    .replace(/\b(?:Co(?:mpany)?|Co-?Operative|Insurance|Ltd|Limited)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned.split(" ");
  if (parts.length === 0) return "";
  return (
    parts.slice(0, maxWords).join(" ") + (parts.length > maxWords ? " …" : "")
  );
};

const brief = (s: string, max = 120) => {
  const t = (String(s || "").split(/[\n،,;()-]/)[0] || "").trim();
  return t.length > max ? t.slice(0, max) + "…" : t;
};

function darken(hex: string, amt = 0.35) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const f = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v * (1 - amt))));
  const toHex = (v: number) => v.toString(16).padStart(2, "0");
  return `#${toHex(f(r))}${toHex(f(g))}${toHex(f(b))}`;
}
function lighten(hex: string, amt = 0.15) {
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((ch) => ch + ch)
      .join("");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const F = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (255 - v) * amt)));
  const H = (v: number) => v.toString(16).padStart(2, "0");
  return `#${H(F(r))}${H(F(g))}${H(F(b))}`;
}

/* ===================== Types ===================== */
type InsRow = {
  inv_no: string;
  company: string;
  claim_type: string;
  gross_amount_no_vat: string | number;
  vat_amount: string | number;
  discount: string | number;
  deductible: string | number;
  special_discount: string | number;
  net_amount: string | number;
  pay_to: string;
  refer_ind?: string;
  emer_ind?: string;
  treatment_date?: string;
  ai_analysis?: string;
};
type RecordsResponse = {
  total_claims: number;
  total_companies: number;
  alerts_count: number;
  records: InsRow[];
};

/* ===================== API ===================== */
const RAW_BASE = (import.meta as any).env?.VITE_API_BASE || "";
const API_BASE = String(RAW_BASE || "");
const USE_PROXY = !API_BASE;
const ENDPOINTS = {
  records: USE_PROXY ? "/api/insurance/records" : "/insurance/records",
};
const joinUrl = (b: string, p: string) =>
  b ? `${b.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}` : p;

async function httpGet<T>(path: string, params?: Record<string, string>) {
  const full = joinUrl(API_BASE, path);
  const url = new URL(full, window.location.origin);
  if (params)
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        const s = String(v).trim();
        if (s) url.searchParams.set(k, s);
      }
    });
  const r = await fetch(url.toString(), { credentials: "include" });
  const ct = r.headers.get("content-type") || "";
  if (!r.ok) throw new Error(await r.text());
  if (!ct.includes("application/json")) throw new Error("Unexpected response");
  return r.json() as Promise<T>;
}

/* ===================== Page ===================== */
type CtxMode = "" | "company" | "claim";
type ChartMode = "byCompanyGlobal" | "byClaimForCompany" | "byCompanyForClaim";

export default function Insurance() {
  const navigate = useNavigate();

  // loading
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // data
  const [rows, setRows] = useState<InsRow[]>([]);
  const [chartRows, setChartRows] = useState<InsRow[]>([]);

  // master lists (suggestions)
  const [allCompanies, setAllCompanies] = useState<string[]>([]);
  const [allClaims, setAllClaims] = useState<string[]>([]);
  const [allPayees, setAllPayees] = useState<string[]>([]);
  const [claimsByCompany, setClaimsByCompany] = useState<
    Record<string, string[]>
  >({});
  const [companiesByClaim, setCompaniesByClaim] = useState<
    Record<string, string[]>
  >({});

  // context (which filter is active)
  const [ctxMode, setCtxMode] = useState<CtxMode>("");

  // search state
  const [q, setQ] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [recent, setRecent] = useState<string[]>(
    (() => {
      try {
        return JSON.parse(localStorage.getItem("insurance_recent") || "[]");
      } catch {
        return [];
      }
    })()
  );
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  // filters
  const [date, setDate] = useState<string>("");
  const [fCompany, setFCompany] = useState<string>("");
  const [fClaim, setFClaim] = useState<string>("");

  // chart focus
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  // show/hide detailed cards + bar controls
  const [showCards, setShowCards] = useState(false);
  const [prioMode, setPrioMode] = useState<
    "none" | "urgency" | "recency" | "amount"
  >("none");
  const [rangePreset, setRangePreset] = useState<string>("");
  const [rangeMin, setRangeMin] = useState<string>("");
  const [rangeMax, setRangeMax] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(30);

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  /* Boot load once */
  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<RecordsResponse>(ENDPOINTS.records, {});
        const list = (data.records || []).map((r) => ({ ...r }));
        // masters
        const companies = new Set<string>(),
          claims = new Set<string>(),
          payees = new Set<string>();
        list.forEach((r) => {
          const co = toTitle(r.company);
          if (co && co.toLowerCase() !== "nan") companies.add(co);
          const cl = toTitle(r.claim_type);
          if (cl && cl.toLowerCase() !== "nan") claims.add(cl);
          const p = toTitle(r.pay_to);
          if (p && p.toLowerCase() !== "nan") payees.add(p);
        });
        const cc = Array.from(companies).sort();
        const tt = Array.from(claims).sort();
        const pp = Array.from(payees).sort();
        setAllCompanies(cc);
        setAllClaims(tt);
        setAllPayees(pp);

        // mappings
        const byClaimForCo: Record<string, Set<string>> = {};
        const byCoForClaim: Record<string, Set<string>> = {};
        list.forEach((r) => {
          const co = toTitle(r.company);
          const cl = toTitle(r.claim_type);
          if (co) {
            byClaimForCo[co] = byClaimForCo[co] || new Set<string>();
            if (cl) byClaimForCo[co].add(cl);
          }
          if (cl) {
            byCoForClaim[cl] = byCoForClaim[cl] || new Set<string>();
            if (co) byCoForClaim[cl].add(co);
          }
        });
        const map1: Record<string, string[]> = {};
        const map2: Record<string, string[]> = {};
        Object.entries(byClaimForCo).forEach(
          ([k, v]) => (map1[k] = Array.from(v).sort())
        );
        Object.entries(byCoForClaim).forEach(
          ([k, v]) => (map2[k] = Array.from(v).sort())
        );
        setClaimsByCompany(map1);
        setCompaniesByClaim(map2);
      } catch (e) {
        console.error(e);
      } finally {
        fetchData();
        fetchChartData();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* outside click: suggestions */
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

  /* Fetchers */
  async function httpFetch(
    params: Record<string, string>
  ): Promise<RecordsResponse> {
    return httpGet<RecordsResponse>(ENDPOINTS.records, params);
  }

  async function fetchData(opts?: {
    keepLoading?: boolean;
    override?: {
      q?: string;
      company?: string;
      claim_type?: string;
      date?: string;
      hasSearched?: boolean;
    };
  }) {
    try {
      if (!opts?.keepLoading) setLoading(true);
      setErr(null);

      const o = opts?.override;
      const _hasSearched = o?.hasSearched ?? hasSearched;

      const params: Record<string, string> = {};
      if (_hasSearched && (o?.q ?? q).trim()) params.q = (o?.q ?? q).trim();
      if (o?.company ?? fCompany) params.company = (o?.company ?? fCompany)!;
      if (o?.claim_type ?? fClaim)
        params.claim_type = (o?.claim_type ?? fClaim)!;
      if (o?.date ?? date) params.date = (o?.date ?? date)!;

      const data = await httpFetch(params);
      // sorting & range apply on the UI level for cards
      let list = (data.records || []).slice();

      // priority ordering (for cards)
      if (prioMode !== "none") {
        const score = (r: InsRow) => {
          if (prioMode === "urgency")
            return (
              ((r.emer_ind || "").toUpperCase() === "Y" ? 2 : 0) +
              ((r.refer_ind || "").toUpperCase() === "Y" ? 1 : 0)
            );
          if (prioMode === "amount") return Number(r.net_amount || 0);
          // recency
          return (r.treatment_date || "").localeCompare("");
        };
        list.sort((a, b) =>
          prioMode === "recency"
            ? (b.treatment_date || "").localeCompare(a.treatment_date || "")
            : score(b) - score(a)
        );
      }

      // net range filter (when user typed any)
      const min = rangeMin ? Number(rangeMin) : null;
      const max = rangeMax ? Number(rangeMax) : null;
      if (min !== null || max !== null) {
        list = list.filter((r) => {
          const v = Number(r.net_amount || 0);
          if (min !== null && v < min) return false;
          if (max !== null && v > max) return false;
          return true;
        });
      }

      setRows(list);
    } catch (e: any) {
      setErr(e?.message || "تعذّر تحميل البيانات");
    } finally {
      setLoading(false);
      setFirstLoadDone(true);
    }
  }

  async function fetchChartData(opts?: {
    override?: {
      q?: string;
      company?: string;
      claim_type?: string;
      date?: string;
      hasSearched?: boolean;
    };
  }) {
    try {
      const o = opts?.override;
      const _hasSearched = o?.hasSearched ?? hasSearched;

      const params: Record<string, string> = {};
      if (_hasSearched && (o?.q ?? q).trim()) params.q = (o?.q ?? q).trim();
      if (o?.company ?? fCompany) params.company = (o?.company ?? fCompany)!;
      if (o?.claim_type ?? fClaim)
        params.claim_type = (o?.claim_type ?? fClaim)!;
      if (o?.date ?? date) params.date = (o?.date ?? date)!;

      const data = await httpFetch(params);
      setChartRows(data.records || []);
    } catch {
      /* noop */
    }
  }

  // re-fetch when filters change
  useEffect(() => {
    fetchChartData();
    // only fetch cards if currently shown (to avoid initial heavy render)
    if (showCards) fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fCompany,
    fClaim,
    date,
    hasSearched,
    q,
    prioMode,
    rangeMin,
    rangeMax,
    pageSize,
    showCards,
  ]);

  /* Context builder */
  useEffect(() => {
    if (!hasSearched) {
      setCtxMode("");
      return;
    }
    if (fCompany) {
      setCtxMode("company");
      return;
    }
    if (fClaim) {
      setCtxMode("claim");
      return;
    }
    setCtxMode("");
  }, [hasSearched, fCompany, fClaim]);

  /* Search run */
  function runSearch(textIn?: string) {
    const text = stripOuterQuotes((textIn ?? q).trim());
    if (!text) return;

    // try to resolve to known company/claim (starts/contains)
    const resolve = (pool: string[]) => {
      const key = toTitle(text);
      const norm = nrm(key);
      const exact = pool.find((c) => nrm(c) === norm);
      const starts = pool.find((c) => nrm(c).startsWith(norm));
      const contains = pool.find((c) => nrm(c).includes(norm));
      return exact || starts || contains || "";
    };

    const company = resolve(allCompanies);
    const claim = company ? "" : resolve(allClaims);

    setHasSearched(true);
    setFCompany(company);
    setFClaim(claim);
    setQ(text);

    if (text) {
      const newRecent = [text, ...recent.filter((x) => x !== text)].slice(
        0,
        10
      );
      setRecent(newRecent);
      localStorage.setItem("insurance_recent", JSON.stringify(newRecent));
    }

    setShowSuggest(false);
    setSelectedLabel("");
    fetchChartData({
      override: {
        q: text,
        company,
        claim_type: claim,
        date,
        hasSearched: true,
      },
    });
  }

  /* Show All (reset) */
  function resetToAll() {
    setQ("");
    setFCompany("");
    setFClaim("");
    setDate("");
    setHasSearched(false);
    setSelectedLabel("");
    setShowCards(false);
    fetchChartData({
      override: {
        q: "",
        company: "",
        claim_type: "",
        date: "",
        hasSearched: false,
      },
    });
    window.dispatchEvent(new CustomEvent("ins:cleared"));
  }

  /* Suggestions source */
  const suggestItems = useMemo(() => {
    const key = nrm(q);
    const pool: {
      label: string;
      kind: "company" | "claim" | "payee" | "text";
    }[] = [];
    allCompanies.forEach((c) => pool.push({ label: c, kind: "company" }));
    allClaims.forEach((t) => pool.push({ label: t, kind: "claim" }));
    allPayees.forEach((p) => pool.push({ label: p, kind: "payee" }));
    if (!key) return pool.slice(0, 8);
    const starts = pool.filter((s) => nrm(s.label).startsWith(key));
    const contains = pool.filter(
      (s) => !nrm(s.label).startsWith(key) && nrm(s.label).includes(key)
    );
    return [...starts.slice(0, 6), ...contains.slice(0, 4)].slice(0, 8);
  }, [q, allCompanies, allClaims, allPayees]);

  /* Header chart mode */
  const chartMode: ChartMode = useMemo(() => {
    if (fCompany) return "byClaimForCompany";
    if (fClaim) return "byCompanyForClaim";
    return "byCompanyGlobal";
  }, [fCompany, fClaim]);

  useEffect(() => {
    if (!hasSearched) setSelectedLabel("");
  }, [chartMode, hasSearched]);

  const chartData = useMemo(() => {
    const base =
      fCompany || fClaim || date ? rows : chartRows.length ? chartRows : rows;
    const by: Record<string, number> = {};
    if (chartMode === "byClaimForCompany") {
      base.forEach((r) => {
        if (!coMatches(r.company || "", fCompany)) return;
        const key = toTitle(r.claim_type || "").trim();
        if (!key || key.toLowerCase() === "nan") return;
        by[key] = (by[key] ?? 0) + 1;
      });
    } else if (chartMode === "byCompanyForClaim") {
      base.forEach((r) => {
        if (nrm(r.claim_type || "") !== nrm(fClaim)) return;
        const key = toTitle(r.company || "").trim();
        if (!key || key.toLowerCase() === "nan") return;
        by[key] = (by[key] ?? 0) + 1;
      });
    } else {
      base.forEach((r) => {
        const key = toTitle(r.company || "");
        if (!key || key.toLowerCase() === "nan") return;
        by[key] = (by[key] ?? 0) + 1;
      });
    }
    return Object.entries(by)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows, chartRows, fCompany, fClaim, date, chartMode]);

  const yMeta = useMemo(() => {
    const max = chartData.reduce((m, c) => Math.max(m, c.count), 0);
    const step = max <= 10 ? 1 : max <= 20 ? 2 : max <= 40 ? 4 : 5;
    const top = Math.max(3, Math.ceil((max + step) / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { ticks, top };
  }, [chartData]);

  const chartTitle = useMemo(() => {
    if (chartMode === "byClaimForCompany")
      return `عدد المطالبات (${fCompany}) حسب النوع`;
    if (chartMode === "byCompanyForClaim")
      return `عدد المطالبات (${fClaim}) حسب الشركة`;
    return "عدد المطالبات لكل شركة";
  }, [chartMode, fCompany, fClaim]);

  // KPI figures should reflect currently filtered table (or global if nothing selected)
  const kpiRows = useMemo(
    () => (fCompany || fClaim || hasSearched ? rows : chartRows),
    [rows, chartRows, fCompany, fClaim, hasSearched]
  );

  /* ===================== Render ===================== */
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
                icon={<Pill className="size-4" />}
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
          {/* Header */}
          <div
            className="relative z-50 rounded-2xl p-5 text-white shadow-soft"
            style={{ background: headerGrad }}
          >
            <button
              onClick={() => navigate("/home")}
              className="absolute top-3 left-3 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              title="العودة للصفحة الرئيسية"
              aria-label="العودة للصفحة الرئيسية"
            >
              <Home className="size-5" style={{ color: theme.brandDark }} />
            </button>

            <div className="text-2xl md:text-3xl font-semibold">
              السجلات التأمينية
            </div>

            {/* Always-visible Gregorian date */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SingleDateChip
                value={date}
                onChange={(d) => {
                  setHasSearched(true);
                  setDate(d);
                }}
                onClear={() => setDate("")}
              />
            </div>

            {/* Search */}
            <SearchBar
              q={q}
              setQ={(v) => setQ(stripOuterQuotes(v))}
              setHasSearched={setHasSearched}
              suggestRef={suggestRef}
              inputRef={inputRef}
              suggestItems={suggestItems}
              recent={recent}
              setRecent={setRecent}
              onRunSearch={(o?: string) => runSearch(o)}
              onShowAll={resetToAll}
              setShowSuggest={setShowSuggest}
              showSuggest={showSuggest}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
            />

            {/* Filters (after search) */}
            {hasSearched && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(ctxMode === "company" || ctxMode === "claim") && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[rgba(14,107,67,0.12)] backdrop-blur-sm shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-white/20 px-2.5 py-1 rounded-full">
                      <span className="w-6 h-6 grid place-items-center rounded-lg bg-white/25">
                        <Filter className="size-4 text-white" />
                      </span>
                      فلترة
                    </span>

                    {ctxMode === "company" && (
                      <NiceSelect
                        value={fClaim}
                        onChange={(v) => {
                          setFClaim(v);
                          setSelectedLabel("");
                        }}
                        options={(claimsByCompany[fCompany] || []).map((x) => ({
                          value: x,
                          label: x,
                        }))}
                        placeholder="كل الأنواع"
                        widthClass="w-[200px]"
                      />
                    )}

                    {ctxMode === "claim" && (
                      <NiceSelect
                        value={fCompany}
                        onChange={(v) => {
                          setFCompany(v);
                          setSelectedLabel("");
                        }}
                        options={(companiesByClaim[fClaim] || []).map((x) => ({
                          value: x,
                          label: x,
                        }))}
                        placeholder="كل الشركات"
                        widthClass="w-[220px]"
                      />
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Errors / skeleton */}
          {err && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <X className="size-4" /> <span className="text-sm">{err}</span>
            </div>
          )}
          {(!firstLoadDone || loading) && kpiRows.length === 0 ? (
            <div className="mt-6 grid gap-4">
              <div className="h-20 bg-white rounded-2xl animate-pulse" />
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
              <div className="h-[460px] bg-white rounded-2xl animate-pulse" />
            </div>
          ) : null}
          {/* KPI Cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-0">
            <KpiCard
              title="عدد المطالبات"
              value={kpiRows.length}
              color="#3B82F6"
              icon={<ClipboardList />}
            />
            <KpiCard
              title="عدد الشركات"
              value={new Set(kpiRows.map((r) => toTitle(r.company))).size}
              color="#D97706"
              icon={<UserPlus />}
            />
            <KpiCard
              title="عدد المستفيدين"
              value={new Set(kpiRows.map((r) => toTitle(r.pay_to))).size}
              color="#E05252"
              icon={<Users />}
            />
            <KpiCard
              title="عدد التنبيهات"
              value={
                kpiRows.filter(
                  (r) =>
                    (r.emer_ind || "").toUpperCase() === "Y" ||
                    (r.refer_ind || "").toUpperCase() === "Y"
                ).length
              }
              color="#0E9F6E"
              icon={<Bell />}
            />
          </div>

          {/* Chart */}
          <div
            className="mt-6 rounded-2xl bg-white shadow-soft p-5 border"
            style={{ borderColor: theme.border }}
          >
            <div className="mb-3 font-semibold text-neutral-700 flex items-center justify-between">
              <span>{chartTitle}</span>
              {selectedLabel && (
                <button
                  className="text-xs px-2 py-1 rounded-full border hover:bg-black/5"
                  style={{ borderColor: theme.border }}
                  onClick={() => setSelectedLabel("")}
                >
                  إلغاء التمييز
                </button>
              )}
            </div>
            <div style={{ width: "100%", height: 360, minWidth: 320 }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 24, left: 8, bottom: 28 }}
                    barCategoryGap={30}
                    barGap={6}
                    onClick={(e: any) => {
                      const name = e?.activeLabel as string | undefined;
                      if (name) setSelectedLabel(name);
                    }}
                  >
                    <CartesianGrid
                      vertical={false}
                      strokeDasharray="3 3"
                      stroke="#E5E7EB"
                    />
                    <defs>
                      <linearGradient
                        id="barGradTurquoise"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor={aqua.light}
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor={aqua.mid}
                          stopOpacity={0.95}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 12, fill: "#374151" }}
                      angle={-15}
                      interval={0}
                      height={54}
                      tickLine={false}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickFormatter={(v: string) =>
                        chartMode === "byCompanyGlobal" ||
                        chartMode === "byCompanyForClaim"
                          ? abbreviateCompany(v)
                          : v.length > 14
                          ? v.slice(0, 14) + "…"
                          : v
                      }
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
                      formatter={(v: any) => [String(v), "عدد المطالبات"]}
                      labelFormatter={(l: any) =>
                        chartMode === "byClaimForCompany"
                          ? `النوع: ${l}`
                          : `الشركة: ${abbreviateCompany(String(l))}`
                      }
                    />
                    <Bar dataKey="count" barSize={44} radius={[12, 12, 8, 8]}>
                      {chartData.map((d, i) => {
                        const active =
                          !selectedLabel || selectedLabel === d.label;
                        return (
                          <Cell
                            key={`cell-${i}`}
                            fill="url(#barGradTurquoise)"
                            fillOpacity={active ? 1 : 0.25}
                            stroke={active ? aqua.dark : "transparent"}
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
                firstLoadDone &&
                !loading && (
                  <div className="h-full grid place-items-center text-neutral-500 text-sm">
                    لا توجد بيانات
                  </div>
                )
              )}
            </div>
          </div>

          {/* Sorting / show cards bar */}
          <div
            className="mt-4 rounded-2xl p-4 shadow-soft flex flex-wrap items-center gap-3 border"
            style={{ background: ui.mintBg, borderColor: ui.mintBorder }}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: ui.hint }}>
                الأولوية
              </span>
              <NiceSelect
                value={prioMode}
                onChange={(v) => setPrioMode(v as any)}
                options={[
                  { value: "none", label: "بدون" },
                  { value: "urgency", label: "عاجل/تحويل أولاً" },
                  { value: "recency", label: "الأحدث أولاً" },
                  { value: "amount", label: "الصافي الأعلى أولاً" },
                ]}
                widthClass="w-[180px]"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: ui.hint }}>
                صافي بين
              </span>
              <NiceSelect
                value={rangePreset}
                onChange={(v) => {
                  setRangePreset(v);
                  if (v) {
                    const [a, b] = v.split("-").map((x) => x.trim());
                    setRangeMin(a || "");
                    setRangeMax(b || "");
                  } else {
                    setRangeMin("");
                    setRangeMax("");
                  }
                }}
                options={[
                  { value: "", label: "—" },
                  { value: "10-20", label: "20–10" },
                  { value: "20-30", label: "30–20" },
                  { value: "30-40", label: "40–30" },
                  { value: "40-60", label: "60–40" },
                ]}
                widthClass="w-[120px]"
              />
              <input
                dir="ltr"
                inputMode="numeric"
                placeholder="من"
                value={rangeMin}
                onChange={(e) => {
                  setRangeMin(e.target.value);
                  setRangePreset("");
                }}
                className="h-10 px-3 rounded-full border text-sm focus:outline-none focus:ring-2 transition"
                style={{
                  borderColor: ui.selectBorder,
                  background: ui.selectBg,
                  boxShadow: "inset 0 1px 0 rgba(0,0,0,0.03)",
                }}
                title="حد أدنى"
              />
              <span className="text-neutral-400">–</span>
              <input
                dir="ltr"
                inputMode="numeric"
                placeholder="إلى"
                value={rangeMax}
                onChange={(e) => {
                  setRangeMax(e.target.value);
                  setRangePreset("");
                }}
                className="h-10 px-3 rounded-full border text-sm focus:outline-none focus:ring-2 transition"
                style={{
                  borderColor: ui.selectBorder,
                  background: ui.selectBg,
                  boxShadow: "inset 0 1px 0 rgba(0,0,0,0.03)",
                }}
                title="حد أعلى"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm" style={{ color: ui.hint }}>
                عدد البطاقات
              </span>
              <NiceSelect
                value={String(pageSize)}
                onChange={(v) => setPageSize(Number(v))}
                options={[
                  { value: "15", label: "15" },
                  { value: "30", label: "30" },
                  { value: "60", label: "60" },
                ]}
                widthClass="w-[90px]"
              />
            </div>

            <div className="ml-auto flex items-center gap-2">
              {!showCards ? (
                <button
                  onClick={() => {
                    setShowCards(true);
                    fetchData();
                  }}
                  className="h-10 px-5 rounded-full text-sm font-semibold border text-white shadow-sm"
                  style={{ background: "#10B981", borderColor: "transparent" }}
                  title="عرض"
                >
                  عرض
                </button>
              ) : (
                <button
                  onClick={() => setShowCards(false)}
                  className="h-10 px-5 rounded-full text-sm font-semibold border bg-white hover:bg-black/5 transition"
                  style={{ borderColor: ui.selectBorder }}
                  title="إخفاء البطاقات"
                >
                  إخفاء البطاقات
                </button>
              )}
            </div>
          </div>
          <div className="mt-2 text-[12px]" style={{ color: ui.hint }}>
            {showCards
              ? "البطاقات معروضة."
              : "اضغط «عرض» لإظهار البطاقات بحسب الفئة."}
          </div>

          {/* Detailed Cards */}
          {showCards && (
            <div className="mt-6 grid grid-cols-1 gap-4 print:gap-2">
              {firstLoadDone && !loading && rows.length === 0 ? (
                <div
                  className="h-[140px] grid place-items-center text-neutral-500 text-sm border rounded-2xl bg-white"
                  style={{ borderColor: theme.border }}
                >
                  لا توجد بيانات مطابقة — غيّري التاريخ أو البحث.
                </div>
              ) : (
                rows
                  .slice(0, pageSize)
                  .map((r, i) => <RecordCard key={`${r.inv_no}-${i}`} r={r} />)
              )}
            </div>
          )}

          {/* Smart chat button / drawer */}
          <SmartChat
            side="right"
            themeColor={theme.brandDark}
            context="insurance"
          />
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
        active ? "text-[#0B3B3C] border border-black/10" : "hover:bg:black/5"
      )}
      style={active ? { backgroundColor: "#E6FFF4" } : {}}
      aria-current={active ? "page" : undefined}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

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
  const dark = darken(color, 0.35);
  const mid = color;
  const light = lighten(color, 0.15);
  const grad = `linear-gradient(135deg, ${dark} 0%, ${mid} 55%, ${light} 130%)`;
  return (
    <div
      className="relative group rounded-2xl text-white p-4 overflow-hidden shadow-soft transition-transform duration-200 ease-out hover:-translate-y-[3px] hover:shadow-xl"
      style={{ background: grad }}
      role="button"
      tabIndex={0}
    >
      <div className="absolute top-3 left-3">
        <div
          className="w-11 h-11 rounded-xl grid place-items-center border backdrop-blur-sm shadow-lg"
          style={{
            background: "rgba(255,255,255,0.18)",
            borderColor: "rgba(255,255,255,0.28)",
          }}
        >
          <span className="[&>*]:stroke-[2.25] [&>*]:w-5 [&>*]:h-5 drop-shadow-[0_2px_6px_rgba(0,0,0,.25)]">
            {icon}
          </span>
        </div>
      </div>
      <svg
        width="180"
        height="64"
        viewBox="0 0 180 64"
        className="absolute right-6 top-8 opacity-40 group-hover:opacity-60 transition-opacity"
      >
        <path
          d="M0,32 C30,4 60,60 90,32 C120,4 150,60 180,32"
          fill="none"
          stroke="rgba(255,255,255,0.6)"
          strokeWidth="6"
          strokeLinecap="round"
        />
      </svg>
      <div className="mt-10 text-right">
        <div className="text-4xl leading-none font-extrabold tabular-nums drop-shadow-sm">
          {value}
        </div>
        <div className="mt-1 text-[1.05rem] font-semibold tracking-wide text-white/95">
          {title}
        </div>
      </div>
    </div>
  );
}

/* Custom pretty select */
function NiceSelect({
  value,
  onChange,
  options,
  placeholder = "",
  widthClass = "w-[200px]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder?: string;
  widthClass?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const current = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className={clsx("relative", widthClass)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-10 w-full rounded-full border text-sm bg-white flex items-center justify-between px-3 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
        style={{
          borderColor: ui.selectBorder,
          boxShadow: "inset 0 1px 0 rgba(0,0,0,0.03)",
          color: ui.text,
        }}
      >
        <span className="truncate text-right">
          {current?.label || placeholder || "—"}
        </span>
        <span
          className="ml-2 w-6 h-6 rounded-full grid place-items-center text-[11px]"
          style={{
            background: "#ECFEFF",
            border: `1px solid ${ui.selectBorder}`,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <path
              d="M5.5 7.5L10 12l4.5-4.5"
              stroke={ui.caret}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div
          className="absolute mt-2 w-full rounded-2xl border shadow-lg bg-white z-[70] overflow-hidden"
          style={{ borderColor: ui.selectBorder }}
        >
          {placeholder && (
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={clsx(
                "w-full text-right px-3 py-2 text-sm font-medium",
                !value ? "bg-emerald-50 text-emerald-900" : "bg-white"
              )}
            >
              {placeholder}
            </button>
          )}
          <div className="max-h-64 overflow-auto">
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={clsx(
                    "w-full text-right px-3 py-2 text-[13px] transition",
                    active
                      ? "bg-emerald-50 text-emerald-900 font-semibold"
                      : "hover:bg-emerald-50/60 text-black"
                  )}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function RecordCard({ r }: { r: InsRow }) {
  const statusColor =
    (r.emer_ind || "").toUpperCase() === "Y"
      ? amber.mid
      : (r.refer_ind || "").toUpperCase() === "Y"
      ? "#2563EB"
      : amber.dark;

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
      className="rounded-2xl border bg:white p-4 shadow-sm print:shadow-none print:p-3 transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-lg relative overflow-hidden"
      style={{ borderColor: theme.border }}
    >
      <div
        className="absolute right-0 top-0 h-full w-1.5"
        style={{ background: statusColor }}
      />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {r.claim_type &&
          badge(`نوع المطالبة: ${toTitle(r.claim_type)}`, theme.brandDark)}
        {(r.emer_ind || "").toUpperCase() === "Y" && badge("عاجل", amber.dark)}
        {(r.refer_ind || "").toUpperCase() === "Y" && badge("تحويل", "#2563EB")}
        {r.company && badge(toTitle(r.company), amber.dark)}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="رقم المطالبة" value={r.inv_no} />
        <Field label="الشركة" value={toTitle(r.company)} />
        <Field label="نوع المطالبة" value={toTitle(r.claim_type)} />
        <Field
          label="التاريخ"
          value={
            <span className="tabular-nums">{r.treatment_date || "—"}</span>
          }
        />
        <Field label="المستفيد" value={toTitle(r.pay_to)} />
        <Field
          label="إجمالي بدون ضريبة"
          value={String(r.gross_amount_no_vat ?? "—")}
        />
        <Field label="الضريبة" value={String(r.vat_amount ?? "—")} />
        <Field label="الخصم" value={String(r.discount ?? "—")} />
        <Field label="التحمّل" value={String(r.deductible ?? "—")} />
        <Field label="خصم خاص" value={String(r.special_discount ?? "—")} />
        <Field label="الصافي" value={String(r.net_amount ?? "—")} />
        {r.ai_analysis && (
          <Field
            label="تحليل AI"
            value={brief(r.ai_analysis, 180)}
            full
            multiline
          />
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

/* Gregorian date chip */
function SingleDateChip({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const ref = React.useRef<HTMLInputElement>(null);
  const open = () => ref.current?.showPicker?.();

  const nice = value
    ? new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(new Date(value + "T00:00:00"))
    : "اختر التاريخ";

  return (
    <div className="relative">
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden
      />
      <button
        onClick={open}
        className="h-9 pl-3 pr-2 rounded-full flex items-center gap-2 shadow-sm transition bg-[rgba(14,107,67,0.13)] hover:bg-[rgba(14,107,67,0.18)] text-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
        title="التاريخ"
      >
        <span className="w-6 h-6 rounded-full grid place-items-center shadow bg-white/30">
          <CalendarDays className="size-4 text-white" />
        </span>
        <span className="text-sm">{nice}</span>
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-1 grid place-items-center w-5 h-5 rounded-full bg-black/10 hover:bg-black/20 text-[12px]"
            title="مسح التاريخ"
          >
            ×
          </span>
        )}
      </button>
    </div>
  );
}

/* Search bar with suggestions (compact) */
function SearchBar(props: {
  q: string;
  setQ: (v: string) => void;
  setHasSearched: (v: boolean) => void;
  suggestRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  suggestItems: {
    label: string;
    kind: "company" | "claim" | "payee" | "text";
  }[];
  recent: string[];
  setRecent: (v: string[]) => void;
  onRunSearch: (override?: string, prettyText?: string) => void;
  onShowAll: () => void;
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
    recent,
    setRecent,
    onRunSearch,
    onShowAll,
    showSuggest,
    setShowSuggest,
    activeIdx,
    setActiveIdx,
  } = props;

  const listRef = React.useRef<HTMLUListElement>(null);
  const savedScroll = React.useRef(0);
  React.useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = savedScroll.current;
  }, [suggestItems.length, showSuggest]);

  const apply = (s: {
    label: string;
    kind: "company" | "claim" | "payee" | "text";
  }) => {
    const pretty = s.label.replace(/^"|"$/g, "");
    setQ(pretty);
    setHasSearched(true);
    requestAnimationFrame(() => inputRef.current?.blur());
    setShowSuggest(false);
    onRunSearch(pretty, pretty);
  };

  useEffect(() => {
    const handler = () => setShowSuggest(false);
    window.addEventListener("ins:cleared", handler);
    return () => window.removeEventListener("ins:cleared", handler);
  }, [setShowSuggest]);

  return (
    <div className="mt-4 relative z-[70]" ref={suggestRef}>
      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <input
            ref={inputRef}
            dir="auto"
            value={q.replace(/^[\s"“”'‚‹›«»]+|[\s"“”'‚‹›«»]+$/g, "")}
            onChange={(e) => {
              setQ(
                e.target.value.replace(/^[\s"“”'‚‹›«»]+|[\s"“”'‚‹›«»]+$/g, "")
              );
              setShowSuggest(true);
            }}
            onMouseDown={() => {
              if (q.trim()) setQ("");
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
              if (e.key === "Escape") onShowAll();
            }}
            className="w-full h-11 rounded-xl pl-10 pr-12 outline-none placeholder:text-emerald-100 text-white transition focus:ring-2 focus:ring-emerald-300"
            style={{
              background: "rgba(255, 255, 255, 0.12)",
              border: "1px solid rgba(255, 255, 255, 0.25)",
              boxShadow: "inset 0 1px 3px rgba(0,0,0,0.15)",
              backdropFilter: "blur(6px)",
              direction: "auto",
              unicodeBidi: "plaintext",
            }}
            placeholder="ابحث باسم شركة/نوع مطالبة/المستفيد "
            aria-label="بحث موحّد"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-white/90" />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-white/80 hover:text-white"
              title="حذف النص"
            >
              ×
            </button>
          )}

          {showSuggest && (
            <div
              className="absolute z-[80] mt-2 w-full rounded-xl shadow-2xl overflow-hidden"
              onMouseDown={(e) => e.preventDefault()}
              style={{
                background: "rgba(255,255,255,0.96)",
                backdropFilter: "blur(6px)",
                border: "1px solid rgba(14,107,67,0.25)",
              }}
            >
              <ul
                ref={listRef}
                className="max-h-[260px] overflow-auto"
                onScroll={(e) =>
                  (savedScroll.current = (
                    e.target as HTMLUListElement
                  ).scrollTop)
                }
              >
                {suggestItems.length > 0 ? (
                  suggestItems.map((s, i) => (
                    <li key={`${s.kind}-${s.label}`}>
                      <button
                        className={clsx(
                          "w-full text-right px-4 py-2 text-[13px] leading-6 hover:bg-emerald-50 flex items-center justify-between",
                          i === activeIdx && "bg-emerald-50"
                        )}
                        style={{ color: "#0B0F14" }}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply(s);
                        }}
                        title={s.label}
                      >
                        <span className="truncate">{s.label}</span>
                        <span className="text-[11px] text-black/60">
                          {s.kind}
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
                <div
                  className="border-t p-2"
                  style={{ borderColor: "rgba(14,107,67,0.18)" }}
                >
                  <div className="px-2 pb-1 text-[11px] text-black/80 flex items-center gap-1">
                    <History className="size-3.5" /> عمليات بحث سابقة
                  </div>
                  <div className="px-2 pb-2 flex flex-wrap gap-2">
                    {recent.slice(0, 8).map((r) => (
                      <button
                        key={r}
                        className="h-7 px-2 rounded-full bg-black/5 text-[12px] hover:bg-black/10 text-black font-medium"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setQ(r);
                          setShowSuggest(false);
                          requestAnimationFrame(() => inputRef.current?.blur());
                          onRunSearch(r, r);
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

        <button
          onClick={() => onRunSearch()}
          className="h-11 px-4 rounded-xl text-sm font-semibold shadow-md border text-white"
          style={{ background: "#36D399", borderColor: "transparent" }}
          title="بحث"
        >
          بحث
        </button>

        <button
          onClick={onShowAll}
          className="h-11 px-4 rounded-xl text-sm border text-white hover:bg-white/10"
          style={{ borderColor: "rgba(255,255,255,0.28)" }}
          title="عرض الكل"
        >
          عرض الكل
        </button>
      </div>
    </div>
  );
}
