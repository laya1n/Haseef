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
  Filter,
  Bell,
  Users,
  UserPlus,
  ClipboardList,
  Bot,
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
  brandMid: "#0B5A38",
  surfaceAlt: "#F5F7FB",
  ink: "#0B0F14",
  border: "#E6EEF0",
};

const pageBg =
  "linear-gradient(180deg,#F5F9F7 0%,#ECF5F2 100%), radial-gradient(800px 500px at 12% 8%, rgba(169,222,214,0.18) 0%, transparent 60%)";
const headerGrad = `linear-gradient(135deg, ${theme.brandDark} 0%, #0B3B3C 60%, ${theme.brandDark} 100%)`;

/* ===================== Helpers ===================== */
const stripOuterQuotes = (s: string) =>
  String(s ?? "")
    .replace(/^[\s"“”'‚‹›«»]+/, "")
    .replace(/[\s"“”'‚‹›«»]+$/, "");

const toTitle = (s: string) =>
  (s || "")
    .trim()
    .toLowerCase()
    .replace(/[\\\/|]+/g, " ")
    .replace(/[.,;:_]+/g, " ")
    .replace(/\s+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const dropTitles = new Set([
  "dr",
  "dr.",
  "doctor",
  "prof",
  "prof.",
  "mr",
  "mrs",
  "ms",
  "د",
  "د.",
  "دكتور",
  "الدكتور",
  "أ.",
  "أ.د",
  "بروف",
  "البروف",
  "أستاذ",
]);

const firstNameOf = (name: string) => {
  const cleaned = (name || "")
    .trim()
    .toLowerCase()
    .replace(/[\\\/|]+/g, " ")
    .replace(/[.,;:_]+/g, " ");
  const parts = cleaned.split(/\s+/).filter(Boolean);
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
    .replace(/[‐–—]+/g, "-")
    .replace(/[\\\/|]+/g, " ")
    .replace(/[(),.;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const firstIcd = (s: string) => {
  const m = String(s || "").match(/([A-Za-z]\d{1,2}(?:\.\d+)?)/);
  return m ? m[1].toUpperCase() : "";
};

const brief = (s: string, max = 120) => {
  const t = (String(s || "").split(/[\n،,;()-]/)[0] || "").trim();
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

// lighten/darken for KPI gradients
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
function lighten(hex: string, amt = 0.2) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  const F = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + (255 - v) * amt)));
  const H = (v: number) => v.toString(16).padStart(2, "0");
  return `#${H(F(r))}${H(F(g))}${H(F(b))}`;
}

/* ========= Power Query ========= */
type Pq = {
  doctor?: string;
  patient?: string;
  icd?: string;
  contract?: string;
  claim?: string;
  emer?: "Y" | "N";
  refer?: "Y" | "N";
  from?: string;
  to?: string;
  not?: Record<string, string[]>;
  free?: string[];
};
function parsePowerQuery(raw: string): Pq {
  const out: Pq = { not: {}, free: [] };
  const parts = raw.match(/"[^"]+"|\S+/g) || [];
  const take = (v: string) => v.replace(/^"|"$/g, "");
  for (const tok of parts) {
    const neg = tok.startsWith("-");
    const t = neg ? tok.slice(1) : tok;
    const [k, ...rest] = t.split(":");
    const v = take(rest.join(":") || "").trim();
    const pushNot = (key: string, val: string) => {
      out.not![key] = out.not![key] || [];
      out.not![key].push(val);
    };
    if (!v) {
      if (!neg) out.free!.push(t);
      continue;
    }
    switch (k.toLowerCase()) {
      case "d":
      case "doctor":
        neg ? pushNot("doctor", v) : (out.doctor = v);
        break;
      case "p":
      case "patient":
        neg ? pushNot("patient", v) : (out.patient = v);
        break;
      case "icd":
        neg ? pushNot("icd", v) : (out.icd = v);
        break;
      case "c":
      case "contract":
        neg ? pushNot("contract", v) : (out.contract = v);
        break;
      case "t":
      case "type":
        neg ? pushNot("claim", v) : (out.claim = v);
        break;
      case "emer":
        out.emer = v.toUpperCase() === "Y" ? "Y" : "N";
        break;
      case "ref":
        out.refer = v.toUpperCase() === "Y" ? "Y" : "N";
        break;
      case "date":
      case "on":
        out.from = out.to = v;
        break;
      case "from":
        out.from = v;
        break;
      case "to":
        out.to = v;
        break;
      default:
        neg ? pushNot("free", v) : out.free!.push(t);
    }
  }
  return out;
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
  refer_ind?: string;
  emer_ind?: string;
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
type CtxMode = "" | "doctor" | "icd" | "patient";
type ChartMode = "byDoctorGlobal" | "byPatientForDoctor" | "byDoctorForPatient";

export default function MedicalRecords() {
  const navigate = useNavigate();

  // loading
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // table/cards
  const [rows, setRows] = useState<MedRow[]>([]);
  const [chartRows, setChartRows] = useState<MedRow[]>([]);

  // master
  const [masterAll, setMasterAll] = useState<MedRow[]>([]);
  const [masterPatientsByDoctor, setMasterPatientsByDoctor] = useState<
    Record<string, string[]>
  >({});
  const [masterDoctorsByPatient, setMasterDoctorsByPatient] = useState<
    Record<string, string[]>
  >({});

  // suggestions pools
  const [allDoctors, setAllDoctors] = useState<string[]>([]);
  const [allPatients, setAllPatients] = useState<string[]>([]);
  const [allIcds, setAllIcds] = useState<string[]>([]);

  // context
  const [ctxMode, setCtxMode] = useState<CtxMode>("");
  const [ctxPatients, setCtxPatients] = useState<string[]>([]);
  const [ctxDoctors, setCtxDoctors] = useState<string[]>([]);

  // search
  const [q, setQ] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
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

  // filters
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [fDoctor, setFDoctor] = useState<string>("");
  const [fPatient, setFPatient] = useState<string>("");

  // ICD
  const [selIcd, setSelIcd] = useState<string>("");

  // chart focus
  const [selectedName, setSelectedName] = useState<string>("");

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const singleDate = useMemo(
    () => dateFrom || dateTo || "",
    [dateFrom, dateTo]
  );

  /* ============ Boot ============ */
  useEffect(() => {
    (async () => {
      try {
        const data = await httpGet<RecordsResponse>(ENDPOINTS.records, {});
        const list = (data.records || []).map((r, i) => ({
          id: r.id ?? i + 1,
          ...r,
        }));
        setMasterAll(list);

        const d = new Set<string>(),
          p = new Set<string>(),
          i = new Set<string>();
        list.forEach((r) => {
          const dn = toTitle(r.doctor_name);
          if (dn && dn.toLowerCase() !== "nan") d.add(dn);
          const pn = toTitle(r.patient_name);
          if (pn && pn.toLowerCase() !== "nan") p.add(pn);
          const ic = firstIcd(r.ICD10CODE);
          if (ic) i.add(ic);
        });
        setAllDoctors(Array.from(d).sort());
        setAllPatients(Array.from(p).sort());
        setAllIcds(Array.from(i).sort());

        const mapPatByDoc: Record<string, Set<string>> = {};
        const mapDocByPat: Record<string, Set<string>> = {};
        list.forEach((r) => {
          const doc = toTitle(r.doctor_name);
          const pat = toTitle(r.patient_name);
          if (doc && doc.toLowerCase() !== "nan") {
            mapPatByDoc[doc] = mapPatByDoc[doc] || new Set<string>();
            if (pat && pat.toLowerCase() !== "nan") mapPatByDoc[doc].add(pat);
          }
          if (pat && pat.toLowerCase() !== "nan") {
            mapDocByPat[pat] = mapDocByPat[pat] || new Set<string>();
            if (doc && doc.toLowerCase() !== "nan") mapDocByPat[pat].add(doc);
          }
        });
        const patByDoc: Record<string, string[]> = {};
        const docByPat: Record<string, string[]> = {};
        Object.entries(mapPatByDoc).forEach(
          ([k, v]) => (patByDoc[k] = Array.from(v).sort())
        );
        Object.entries(mapDocByPat).forEach(
          ([k, v]) => (docByPat[k] = Array.from(v).sort())
        );
        setMasterPatientsByDoctor(patByDoc);
        setMasterDoctorsByPatient(docByPat);
      } catch (e: any) {
        console.error(e);
      } finally {
        fetchData();
        fetchChartData();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ============ outside click ============ */
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

  /* ============ Fetchers ============ */
  async function fetchData(opts?: {
    keepLoading?: boolean;
    override?: {
      q?: string;
      doctor?: string;
      patient?: string;
      date?: string;
      icd?: string;
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
      if (o?.doctor ?? fDoctor) params.doctor = (o?.doctor ?? fDoctor)!;
      if (o?.patient ?? fPatient) params.patient = (o?.patient ?? fPatient)!;
      if (o?.date ?? singleDate) params.date = (o?.date ?? singleDate)!;
      if (o?.icd ?? selIcd) params.icd = (o?.icd ?? selIcd)!;

      const data = await httpGet<RecordsResponse>(ENDPOINTS.records, params);
      const list = (data?.records || []).map((r, i) => ({
        id: r.id ?? i + 1,
        ...r,
      }));
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
      doctor?: string;
      patient?: string;
      date?: string;
      icd?: string;
      hasSearched?: boolean;
    };
  }) {
    try {
      const o = opts?.override;
      const _hasSearched = o?.hasSearched ?? hasSearched;

      const params: Record<string, string> = {};
      if (_hasSearched && (o?.q ?? q).trim()) params.q = (o?.q ?? q).trim();
      if (o?.patient ?? fPatient) params.patient = (o?.patient ?? fPatient)!;
      if (o?.date ?? singleDate) params.date = (o?.date ?? singleDate)!;
      if (o?.icd ?? selIcd) params.icd = (o?.icd ?? selIcd)!;

      const data = await httpGet<RecordsResponse>(ENDPOINTS.records, params);
      const list = (data?.records || []).map((r, i) => ({
        id: r.id ?? i + 1,
        ...r,
      }));
      setChartRows(list);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    fetchData();
    fetchChartData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fDoctor, fPatient, singleDate, selIcd, hasSearched, q]);

  /* ============ Build context lists ============ */
  useEffect(() => {
    if (!hasSearched) {
      setCtxMode("");
      setCtxPatients([]);
      setCtxDoctors([]);
      return;
    }
    if (fDoctor) {
      setCtxMode("doctor");
      setCtxPatients(masterPatientsByDoctor[fDoctor] || []);
      setCtxDoctors([]);
      return;
    }
    if (fPatient) {
      setCtxMode("patient");
      setCtxDoctors(masterDoctorsByPatient[fPatient] || []);
      setCtxPatients([]);
      return;
    }
    const qTitle = toTitle(q.trim());
    const icdExact = allIcds.includes(firstIcd(qTitle) || "");
    if (icdExact) {
      const docs = Array.from(
        new Set(
          masterAll
            .filter((r) => firstIcd(r.ICD10CODE) === firstIcd(qTitle))
            .map((r) => toTitle(r.doctor_name))
            .filter(Boolean)
        )
      ).sort();
      setCtxMode("icd");
      setCtxDoctors(docs);
      setCtxPatients([]);
      return;
    }
    setCtxMode("");
    setCtxPatients([]);
    setCtxDoctors([]);
  }, [
    hasSearched,
    fDoctor,
    fPatient,
    q,
    allIcds,
    masterAll,
    masterPatientsByDoctor,
    masterDoctorsByPatient,
  ]);

  /* ============ Search ============ */
  function runSearch(qOverride?: string, prettyText?: string) {
    const text = stripOuterQuotes((qOverride ?? q).trim());
    if (!text) return;

    const pq = parsePowerQuery(text);
    const titledDoctor = pq.doctor ? toTitle(pq.doctor) : "";
    const titledPatient = pq.patient ? toTitle(pq.patient) : "";
    let icdToken = pq.icd ? firstIcd(pq.icd) : "";

    const resolveFreeDoctor = () => {
      const key = normalize(text);
      const exact = allDoctors.find((d) => normalize(d) === key);
      const contains = allDoctors.filter((d) => normalize(d).includes(key));
      if (exact) return exact;
      if (contains.length === 1 && key.length >= 2) return contains[0];
      return "";
    };
    const resolveFreePatient = () => {
      const key = normalize(text);
      const exact = allPatients.find((p) => normalize(p) === key);
      const contains = allPatients.filter((p) => normalize(p).includes(key));
      if (exact) return exact;
      if (contains.length === 1 && key.length >= 2) return contains[0];
      return "";
    };
    const resolveFreeIcd = () => {
      const key = normalize(firstIcd(text));
      const exact = allIcds.find((i) => normalize(i) === key);
      const contains = allIcds.filter((i) => normalize(i).includes(key));
      if (exact) return exact;
      if (contains.length === 1 && key.length >= 2) return contains[0];
      return "";
    };

    const next = {
      q: "",
      doctor: "",
      patient: "",
      date: "",
      icd: "",
      hasSearched: true,
    };

    if (titledDoctor) {
      const full = allDoctors.find((d) =>
        normalize(d).includes(normalize(titledDoctor))
      );
      (next as any).doctor = full || titledDoctor;
    } else (next as any).doctor = resolveFreeDoctor();

    if (titledPatient) (next as any).patient = titledPatient;
    else if (!(next as any).doctor)
      (next as any).patient = resolveFreePatient();

    if (pq.from && !pq.to) (next as any).date = pq.from;
    else if (pq.to && !pq.from) (next as any).date = pq.to;
    else if (pq.from && pq.to) (next as any).date = pq.from;

    if (!icdToken) icdToken = resolveFreeIcd();
    (next as any).icd = icdToken || "";

    const free = [(next as any).icd, pq.contract, pq.claim, ...(pq.free || [])]
      .filter(Boolean)
      .join(" ")
      .trim();
    const shown = stripOuterQuotes(
      qOverride ? prettyText || text : free ? free : text
    );
    (next as any).q = shown;

    setHasSearched(true);
    setFDoctor((next as any).doctor);
    setFPatient((next as any).patient);
    setSelIcd((next as any).icd);
    if (pq.from && !pq.to) {
      setDateFrom(pq.from);
      setDateTo("");
    } else if (pq.to && !pq.from) {
      setDateFrom("");
      setDateTo(pq.to);
    } else if (pq.from && pq.to) {
      setDateFrom(pq.from);
      setDateTo(pq.to);
    }
    setQ(shown);

    if (shown) {
      const newRecent = [shown, ...recent.filter((x) => x !== shown)].slice(
        0,
        10
      );
      setRecent(newRecent);
      localStorage.setItem("medical_recent", JSON.stringify(newRecent));
    }

    fetchData({ override: next as any });
    fetchChartData({ override: next as any });
    setShowSuggest(false);
  }

  /* ============ Chart ============ */
  const chartMode: ChartMode = useMemo(() => {
    if (fDoctor) return "byPatientForDoctor";
    if (fPatient) return "byDoctorForPatient";
    return "byDoctorGlobal";
  }, [fDoctor, fPatient]);

  useEffect(() => {
    if (!hasSearched) setSelectedName("");
  }, [chartMode, hasSearched]);

  const chartData = useMemo(() => {
    const base =
      fPatient || fDoctor || singleDate || selIcd
        ? rows
        : chartRows.length
        ? chartRows
        : rows;

    const by: Record<string, number> = {};
    if (chartMode === "byPatientForDoctor") {
      base.forEach((r) => {
        if (toTitle(r.doctor_name) !== fDoctor) return;
        const key = toTitle(r.patient_name || "").trim();
        if (!key || key.toLowerCase() === "nan") return;
        by[key] = (by[key] ?? 0) + 1;
      });
    } else if (chartMode === "byDoctorForPatient") {
      base.forEach((r) => {
        if (toTitle(r.patient_name) !== fPatient) return;
        const key = toTitle(r.doctor_name || "").trim();
        if (!key || key.toLowerCase() === "nan") return;
        by[key] = (by[key] ?? 0) + 1;
      });
    } else {
      base.forEach((r) => {
        const key = firstNameOf(r.doctor_name || "");
        if (!key || key.toLowerCase() === "nan") return;
        by[key] = (by[key] ?? 0) + 1;
      });
    }

    return Object.entries(by)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);
  }, [rows, chartRows, fPatient, fDoctor, singleDate, selIcd, chartMode]);

  const yMeta = useMemo(() => {
    const max = chartData.reduce((m, c) => Math.max(m, c.count), 0);
    const step = max <= 10 ? 1 : max <= 20 ? 2 : max <= 40 ? 4 : 5;
    const top = Math.max(3, Math.ceil((max + step) / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { ticks, top };
  }, [chartData]);

  const chartTitle = useMemo(() => {
    if (chartMode === "byPatientForDoctor")
      return `عدد سجلات الطبيب (${fDoctor}) لكل مريض`;
    if (chartMode === "byDoctorForPatient")
      return `عدد سجلات المريض (${fPatient}) لكل طبيب`;
    return "عدد السجلات لكل طبيب";
  }, [chartMode, fDoctor, fPatient]);

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
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg:black/5"
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
            className="relative z-50 rounded-2xl p-5 text-white shadow-soft"
            style={{ background: headerGrad }}
          >
            <div className="text-2xl md:text-3xl font-semibold">
              السجلات الطبية
            </div>
            <div className="text-white/90 text-sm mt-1">
              للمختصّين: يمكن استخدام الصياغة المختصرة مثل{" "}
              <b>d:Mohamed p:Yosef icd:E11 from:2025-01-01 to:2025-01-31</b> أو
              استخدموا البحث العادي ثم Enter.
            </div>

            {/* Search */}
            <SearchBar
              q={q}
              setQ={(v) => setQ(stripOuterQuotes(v))}
              setHasSearched={setHasSearched}
              suggestRef={suggestRef}
              inputRef={inputRef}
              suggestItems={useMemo(() => {
                const key = normalize(q);
                const pool: {
                  label: string;
                  kind: "doctor" | "patient" | "icd" | "text";
                }[] = [];
                allDoctors.forEach((d) =>
                  pool.push({ label: d, kind: "doctor" })
                );
                allPatients.forEach((p) =>
                  pool.push({ label: p, kind: "patient" })
                );
                allIcds.forEach((i) => pool.push({ label: i, kind: "icd" }));
                if (!key) return pool.slice(0, 8);
                const starts = pool.filter((s) =>
                  normalize(s.label).startsWith(key)
                );
                const contains = pool.filter(
                  (s) =>
                    !normalize(s.label).startsWith(key) &&
                    normalize(s.label).includes(key)
                );
                const out = [...starts.slice(0, 6), ...contains.slice(0, 4)];
                return out.slice(0, 8);
              }, [q, allDoctors, allPatients, allIcds])}
              didYouMean={useMemo(() => {
                const key = normalize(q);
                if (!key || key.length < 3) return "";
                const candidates = [...allDoctors, ...allPatients, ...allIcds];
                let best = "",
                  bestDist = Infinity;
                candidates.forEach((c) => {
                  const d = editDist(normalize(c), key);
                  if (d < bestDist) {
                    best = c;
                    bestDist = d;
                  }
                });
                return bestDist > 0 &&
                  bestDist <= Math.max(3, Math.floor(key.length * 0.5))
                  ? best
                  : "";
              }, [q, allDoctors, allPatients, allIcds])}
              recent={recent}
              setRecent={setRecent}
              onRunSearch={(o?: string, p?: string) => runSearch(o, p)}
              setShowSuggest={setShowSuggest}
              showSuggest={showSuggest}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
            />

            {/* Filters */}
            {hasSearched && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {/* Date chip */}
                <div className="flex items-center gap-2 rounded-2xl px-2 py-1 bg-[rgba(14,107,67,0.12)] backdrop-blur-sm shadow-sm">
                  <SingleDateChip
                    value={singleDate}
                    onChange={(d) => {
                      setDateFrom(d);
                      setDateTo("");
                    }}
                    onClear={() => {
                      setDateFrom("");
                      setDateTo("");
                    }}
                  />
                </div>

                {(ctxMode === "doctor" ||
                  ctxMode === "icd" ||
                  ctxMode === "patient") && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[rgba(14,107,67,0.12)] backdrop-blur-sm shadow-sm">
                    <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-white bg-white/20 px-2.5 py-1 rounded-full">
                      <span className="w-6 h-6 grid place-items-center rounded-lg bg-white/25">
                        <Filter className="size-4 text-white" />
                      </span>
                      فلترة
                    </span>

                    {ctxMode === "doctor" && (
                      <SoftMenuSelect
                        value={fPatient}
                        onChange={(v) => {
                          setFPatient(v);
                          setSelectedName("");
                        }}
                        title="حسب المريض"
                        placeholder="كل المرضى"
                        options={masterPatientsByDoctor[fDoctor] || []}
                      />
                    )}

                    {ctxMode === "icd" && (
                      <SoftMenuSelect
                        value={fDoctor}
                        onChange={(v) => {
                          setFDoctor(v);
                          setSelectedName("");
                        }}
                        title="حسب الطبيب"
                        placeholder="كل الأطباء"
                        options={ctxDoctors}
                      />
                    )}

                    {ctxMode === "patient" && (
                      <SoftMenuSelect
                        value={fDoctor}
                        onChange={(v) => {
                          setFDoctor(v);
                          setSelectedName("");
                        }}
                        title="حسب الطبيب"
                        placeholder="كل الأطباء"
                        options={masterDoctorsByPatient[fPatient] || []}
                      />
                    )}

                    {/* زر المساعد الذكي */}
                    <button
                      onClick={() => navigate("/chat")}
                      className="ml-2 h-9 px-3 rounded-full bg-[#0D16D1] hover:bg-[#101ce8] text-white text-sm font-semibold shadow-md inline-flex items-center gap-2"
                      title="المساعد الذكي"
                    >
                      <Bot className="size-4" />
                      المساعد الذكي
                    </button>
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

          {(!firstLoadDone || loading) && rows.length === 0 ? (
            <div className="mt-6 grid gap-4">
              <div className="h-20 bg-white rounded-2xl animate-pulse" />
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
              <div className="h-[460px] bg-white rounded-2xl animate-pulse" />
            </div>
          ) : null}

          {/* KPI Cards */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-0">
            <KpiCard
              title="عدد السجلات"
              value={kpis(rows).total}
              color="#3B82F6"
              icon={<ClipboardList />}
            />
            <KpiCard
              title="عدد الأطباء"
              value={kpis(rows).doctors}
              color="#D97706"
              icon={<UserPlus />}
            />
            <KpiCard
              title="عدد المرضى"
              value={kpis(rows).patients}
              color="#E05252"
              icon={<Users />}
            />
            <KpiCard
              title="عدد التنبيهات"
              value={kpis(rows).alerts}
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
              {selectedName && (
                <button
                  className="text-xs px-2 py-1 rounded-full border hover:bg-black/5"
                  style={{ borderColor: theme.border }}
                  onClick={() => setSelectedName("")}
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
                      if (name) setSelectedName(name);
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
                      dataKey="label"
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
                        chartMode === "byPatientForDoctor"
                          ? "سجلات المريض"
                          : "عدد السجلات",
                      ]}
                      labelFormatter={(l: any) =>
                        chartMode === "byPatientForDoctor"
                          ? `المريض: ${l}`
                          : `الطبيب: ${l}`
                      }
                    />
                    <Bar dataKey="count" barSize={44} radius={[12, 12, 8, 8]}>
                      {chartData.map((d, i) => {
                        const active =
                          !selectedName || selectedName === d.label;
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
                firstLoadDone &&
                !loading && (
                  <div className="h-full grid place-items-center text-neutral-500 text-sm">
                    لا توجد بيانات
                  </div>
                )
              )}
            </div>
          </div>

          {/* Cards */}
          <div className="mt-6 grid grid-cols-1 gap-4 print:gap-2">
            {firstLoadDone && !loading && rows.length === 0 ? (
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

/* ===================== Derived: KPIs ===================== */
function kpis(list: MedRow[]) {
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

// KPI Card with same-hue gradient (darker -> base -> lighter)
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
      className="relative group rounded-2xl text-white p-4 overflow-hidden shadow-soft
                 transition-transform duration-200 ease-out
                 hover:-translate-y-[3px] hover:shadow-xl focus-within:-translate-y-[3px]"
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

      <div
        className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background:
            "radial-gradient(600px 200px at 130% -30%, rgba(255,255,255,.22), transparent 60%)",
        }}
      />

      <div className="mt-10 text-right">
        <div className="text-4xl leading-none font-extrabold tabular-nums drop-shadow-sm">
          {value}
        </div>
        <div className="mt-1 text-[1.05rem] font-semibold tracking-wide text-white/95">
          {title}
        </div>
      </div>

      <span className="absolute inset-0 rounded-2xl ring-0 group-focus-visible:ring-2 ring-white/60" />
    </div>
  );
}

/* منسدلة خضراء بحواف ناعمة ونص أبيض */
function SoftMenuSelect({
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
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  return (
    <div className="relative z-[60]">
      <button
        ref={btnRef}
        title={title}
        onClick={() => setOpen((o) => !o)}
        className="h-9 px-3 pr-8 rounded-full text-sm font-semibold
                   shadow-sm text-white
                   bg-[rgba(14,107,67,0.30)]
                   hover:bg-[rgba(14,107,67,0.38)] focus:outline-none
                   focus:ring-2 focus:ring-emerald-300"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 20 20'%3E%3Cpath fill='%23FFFFFF' d='M5.5 7.5l4.5 5 4.5-5z'/%3E%3C/svg%3E\")",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "left 10px center",
        }}
      >
        {value || placeholder}
      </button>

      {open && (
        <div
          className="absolute z-[70] mt-2 w-[220px] rounded-xl overflow-hidden
                     shadow-xl bg-white/95 backdrop-blur-md border border-emerald-200/40"
          onMouseLeave={() => setOpen(false)}
        >
          <button
            className="w-full text-right px-3 py-2 text-sm font-medium bg-emerald-50/60 text-emerald-900"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
          >
            {placeholder}
          </button>
          <ul className="max-h-[240px] overflow-auto">
            {options.map((o) => (
              <li key={o}>
                <button
                  className="w-full text-right px-3 py-2 text-[13px] hover:bg-emerald-50 text-[#0B0F14]"
                  onClick={() => {
                    onChange(o);
                    setOpen(false);
                  }}
                  title={o}
                >
                  {o}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
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
      className="rounded-2xl border bg:white p-4 shadow-sm print:shadow-none print:p-3 transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-lg relative overflow-hidden"
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

/* زر التاريخ — شارة دائرية، بدون حدود بيضاء */
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
    ? new Date(value + "T00:00:00").toLocaleDateString("ar-SA", {
        weekday: "short",
        year: "numeric",
        month: "short",
        day: "numeric",
      })
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
        className="h-9 pl-3 pr-2 rounded-full flex items-center gap-2 shadow-sm transition
                   bg-[rgba(14,107,67,0.13)] hover:bg-[rgba(14,107,67,0.18)]
                   text-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
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
  onRunSearch: (override?: string, prettyText?: string) => void;
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

  const apply = (s: {
    label: string;
    kind: "doctor" | "patient" | "icd" | "text";
  }) => {
    const pretty = stripOuterQuotes(s.label);
    setQ(pretty);
    setHasSearched(true);

    let override = s.label;
    if (s.kind === "doctor") override = `d:"${s.label}"`;
    if (s.kind === "patient") override = `p:"${s.label}"`;
    if (s.kind === "icd") override = `icd:"${firstIcd(s.label) || s.label}"`;

    requestAnimationFrame(() => inputRef.current?.blur());
    setShowSuggest(false);
    onRunSearch(override, pretty);
  };

  const clearAll = () => {
    setQ("");
    setHasSearched(false);
    window.dispatchEvent(new CustomEvent("med:clearAll"));
  };

  useEffect(() => {
    const handler = () => setShowSuggest(false);
    window.addEventListener("med:cleared", handler);
    return () => window.removeEventListener("med:cleared", handler);
  }, [setShowSuggest]);

  return (
    <div className="mt-4 relative" ref={suggestRef}>
      <div className="flex items-center gap-2">
        <div className="relative w-full">
          <input
            ref={inputRef}
            dir="auto"
            value={stripOuterQuotes(q)}
            onChange={(e) => {
              setQ(stripOuterQuotes(e.target.value));
              setShowSuggest(true);
              setActiveIdx(0);
            }}
            onMouseDown={() => {
              if (stripOuterQuotes(q)) {
                setQ("");
                setHasSearched(false);
              }
            }}
            onFocus={() => {
              setShowSuggest(true);
              setActiveIdx(0);
            }}
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
              if (e.key === "Escape") clearAll();
            }}
            className="w-full h-10 rounded-2xl pl-10 pr-12 outline-none placeholder:text-black/60 backdrop-blur-md"
            style={{
              background: "rgba(255,255,255,0.65)",
              border: `1px solid ${theme.border}`,
              boxShadow:
                "0 2px 14px rgba(14,107,67,0.08), inset 0 1px 1px rgba(0,0,0,0.04)",
              color: "#111827",
              direction: "auto",
              unicodeBidi: "plaintext",
            }}
            placeholder="اكتب d: أو p: أو icd: … ثم Enter"
            aria-label="بحث موحّد"
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/70" />
          {q && (
            <button
              onClick={() => setQ("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text:black/50 hover:text-black/80"
              title="مسح النص"
            >
              ×
            </button>
          )}

          {showSuggest && (
            <div
              className="absolute z-50 mt-2 w-full bg-white border rounded-xl shadow-xl"
              onMouseDown={(e) => e.preventDefault()}
            >
              {didYouMean && (
                <div className="px-3 py-2 text-[12px] text-[#9A4A07] bg-[#FFF6E3] rounded-t-xl">
                  هل تقصدين:{" "}
                  <button
                    className="underline font-semibold"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const pretty = stripOuterQuotes(didYouMean);
                      setQ(pretty);
                      setShowSuggest(false);
                      requestAnimationFrame(() => inputRef.current?.blur());
                      onRunSearch(didYouMean, pretty);
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
                        onMouseDown={(e) => {
                          e.preventDefault();
                          apply(s);
                        }}
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
                  <div className="px-2 pb-1 text:[11px] text-black/60 flex items-center gap-1">
                    <History className="size-3.5" /> عمليات بحث سابقة
                  </div>
                  <div className="px-2 pb-2 flex flex-wrap gap-2">
                    {recent.slice(0, 8).map((r) => (
                      <button
                        key={r}
                        className="h-7 px-2 rounded-full bg:black/5 text-[12px] hover:bg-black/10"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          const pretty = stripOuterQuotes(r);
                          setQ(pretty);
                          setShowSuggest(false);
                          requestAnimationFrame(() => inputRef.current?.blur());
                          onRunSearch(r, pretty);
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
          className="h-10 px-4 rounded-xl text-sm font-semibold shadow-md border"
          style={{
            background: "#A7F3D0",
            color: "#0E6B43",
            borderColor: "transparent",
          }}
          title="بحث"
        >
          بحث
        </button>
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("med:clearAll"));
          }}
          className="h-10 px-4 rounded-xl text-sm hover:bg-black/5"
          style={{ color: theme.ink, border: `1px solid ${theme.border}` }}
          title="مسح الكل"
        >
          مسح
        </button>
      </div>
    </div>
  );
}
