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
  BellRing,
  History,
  CalendarDays,
  Filter,
  Bell,
  Users,
  UserPlus,
  ClipboardList,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  CornerDownRight,
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

const stripHonorifics = (s: string) => {
  const tokens = normalize(s).split(" ").filter(Boolean);
  const drop = new Set([
    "dr",
    "doctor",
    "prof",
    "mr",
    "mrs",
    "ms",
    "د",
    "الدكتور",
    "بروف",
    "استاذ",
  ]);
  return tokens
    .filter((t) => !drop.has(t))
    .join(" ")
    .trim();
};

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
  let h = hex.replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((ch) => ch + ch)
      .join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error("Invalid hex color");

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

/* ===================== CSV helper ===================== */
const csvEscape = (value: string) => {
  const v = value ?? "";
  const needsQuotes = /[",\n\r]/.test(v);
  const safe = v.replace(/"/g, '""');
  return needsQuotes ? `"${safe}"` : safe;
};
/* ===== ربط صفحة السجلات الدوائية بالإشعارات ===== */

type NotiKind = "طبي" | "تأمين" | "دواء";
type NotiSeverity = "طارئ" | "تنبيه" | "معلومة";

type Noti = {
  id: string;
  kind: NotiKind;
  severity: NotiSeverity;
  // بقية الحقول غير مهمة للحساب
};

const RAW_BASE_NOTI = (import.meta as any).env?.VITE_API_BASE || "";
const API_BASE_NOTI = String(RAW_BASE_NOTI || "");
const USE_PROXY_NOTI = !API_BASE_NOTI;

const NOTI_LIST_ENDPOINT = USE_PROXY_NOTI
  ? "/api/notifications"
  : "/notifications";

const joinUrlNoti = (b: string, p: string) =>
  b ? `${b.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}` : p;

// يرجع عدد إشعارات الأدوية
async function fetchDrugAlertsCount(): Promise<number> {
  const full = joinUrlNoti(API_BASE_NOTI, NOTI_LIST_ENDPOINT);
  const url = new URL(full, window.location.origin);

  const r = await fetch(url.toString(), { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());

  const list = (await r.json()) as Noti[];

  // 🟢 احسبي فقط الإشعارات التي نوعها "دواء"
  // لو حبيتي الطارئة فقط استخدمي && n.severity === "طارئ"
  const drugAlerts = list.filter((n) => n.kind === "دواء");

  return drugAlerts.length;
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
type PriorityMode = "none" | "urgent" | "latest";

const EXPORT_COLUMNS: { key: keyof MedRow; label: string }[] = [
  { key: "doctor_name", label: "اسم الطبيب" },
  { key: "patient_name", label: "اسم المريض" },
  { key: "treatment_date", label: "تاريخ العلاج" },
  { key: "ICD10CODE", label: "ICD10" },
  { key: "chief_complaint", label: "الشكوى الرئيسية" },
  { key: "claim_type", label: "نوع المطالبة" },
  { key: "contract", label: "العقد" },
  { key: "emer_ind", label: "عاجل؟" },
  { key: "refer_ind", label: "تحويل؟" },
  { key: "ai_analysis", label: "تحليل AI" },
];

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
  // عدد التنبيهات الخاصة بالأدوية من نظام الإشعارات
  const [notifDrugAlerts, setNotifDrugAlerts] = useState(0);

  useEffect(() => {
    (async () => {
      try {
        const c = await fetchDrugAlertsCount();
        setNotifDrugAlerts(c);
      } catch (e) {
        console.error("فشل تحميل عدد تنبيهات الأدوية من صفحة الإشعارات", e);
      }
    })();
  }, []);

  // شريط البطاقات (مثل التأمين)
  const [showCards, setShowCards] = useState(false);

  const cardOptions = [10, 20, 30, 50, 100];

  const [priorityMenuOpen, setPriorityMenuOpen] = useState(false);
  const [cardsMenuOpen, setCardsMenuOpen] = useState(false);

  // data
  const [rows, setRows] = useState<MedRow[]>([]);
  const [chartRows, setChartRows] = useState<MedRow[]>([]);

  // master + suggestions
  const [masterAll, setMasterAll] = useState<MedRow[]>([]);
  const [masterPatientsByDoctor, setMasterPatientsByDoctor] = useState<
    Record<string, string[]>
  >({});
  const [masterDoctorsByPatient, setMasterDoctorsByPatient] = useState<
    Record<string, string[]>
  >({});
  const [allDoctors, setAllDoctors] = useState<string[]>([]);
  const [allPatients, setAllPatients] = useState<string[]>([]);
  const [allIcds, setAllIcds] = useState<string[]>([]);

  // context
  const [ctxMode, setCtxMode] = useState<CtxMode>("");
  const [ctxPatients, setCtxPatients] = useState<string[]>([]);
  const [ctxDoctors, setCtxDoctors] = useState<string[]>([]);

  // search state
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
  const [selIcd, setSelIcd] = useState<string>("");

  // chart focus
  const [selectedName, setSelectedName] = useState<string>("");

  // export state
  const [exporting, setExporting] = useState(false);

  // priority list state
  const [prioOpen, setPrioOpen] = useState(true);
  const [prioLimit, setPrioLimit] = useState(8);

  // control bar state (مثل التأمين)
  const [cardLimit, setCardLimit] = useState(24);
  const [priorityMode, setPriorityMode] = useState<PriorityMode>("none");

  // refs
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestRef = useRef<HTMLDivElement>(null);

  const singleDate = useMemo(
    () => dateFrom || dateTo || "",
    [dateFrom, dateTo]
  );

  /* expose setters for instant UI update from SearchBar.apply */
  useEffect(() => {
    (window as any).setFDoctor = setFDoctor;
    (window as any).setFPatient = setFPatient;
    (window as any).setSelIcd = setSelIcd;
    return () => {
      delete (window as any).setFDoctor;
      delete (window as any).setFPatient;
      delete (window as any).setSelIcd;
    };
  }, [setFDoctor, setFPatient, setSelIcd]);

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
  async function httpFetch(
    params: Record<string, string>
  ): Promise<RecordsResponse> {
    return httpGet<RecordsResponse>(ENDPOINTS.records, params);
  }

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

      let data = await httpFetch(params);

      // ✅ Fallback لو 0 نتائج والطبيب محدد
      if ((data?.records?.length ?? 0) === 0 && (params.doctor || "").trim()) {
        const shortDoctor = toTitle(stripHonorifics(params.doctor));
        if (shortDoctor && shortDoctor !== params.doctor) {
          const altParams = { ...params, doctor: shortDoctor };
          const alt = await httpFetch(altParams);
          if ((alt?.records?.length ?? 0) > 0) data = alt;
        }
      }

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
      if (o?.doctor ?? fDoctor) params.doctor = (o?.doctor ?? fDoctor)!;

      let data = await httpFetch(params);

      // ✅ Fallback مشابه للشارت
      if ((data?.records?.length ?? 0) === 0 && (params.doctor || "").trim()) {
        const shortDoctor = toTitle(stripHonorifics(params.doctor));
        if (shortDoctor && shortDoctor !== params.doctor) {
          const altParams = { ...params, doctor: shortDoctor };
          const alt = await httpFetch(altParams);
          if ((alt?.records?.length ?? 0) > 0) data = alt;
        }
      }

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
      const key = stripHonorifics(text);
      const exact = allDoctors.find(
        (d) => normalize(stripHonorifics(d)) === normalize(key)
      );
      const contains = allDoctors.filter((d) =>
        normalize(stripHonorifics(d)).includes(normalize(key))
      );
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
      hasSearched: true as const,
    };

    // ----- strict priority matching -----
    if (titledDoctor) {
      const key = normalize(stripHonorifics(titledDoctor));
      const exact = allDoctors.find(
        (d) => normalize(stripHonorifics(d)) === key
      );
      const starts = allDoctors.find((d) =>
        normalize(stripHonorifics(d)).startsWith(key)
      );
      const contains = allDoctors.find((d) =>
        normalize(stripHonorifics(d)).includes(key)
      );
      (next as any).doctor = exact || starts || contains || titledDoctor;
    } else {
      (next as any).doctor = resolveFreeDoctor();
    }

    if (titledPatient) {
      const key = normalize(titledPatient);
      const exact = allPatients.find((p) => normalize(p) === key);
      const starts = allPatients.find((p) => normalize(p).startsWith(key));
      const contains = allPatients.find((p) => normalize(p).includes(key));
      (next as any).patient = exact || starts || contains || titledPatient;
    } else if (!(next as any).doctor) {
      (next as any).patient = resolveFreePatient();
    }

    if (pq.from && !pq.to) (next as any).date = pq.from;
    else if (pq.to && !pq.from) (next as any).date = pq.to;
    else if (pq.from && pq.to) (next as any).date = pq.from;

    if (!icdToken) icdToken = resolveFreeIcd();
    if (icdToken) {
      const key = normalize(icdToken);
      const exact = allIcds.find((i) => normalize(i) === key);
      const starts = allIcds.find((i) => normalize(i).startsWith(key));
      const contains = allIcds.find((i) => normalize(i).includes(key));
      (next as any).icd = exact || starts || contains || icdToken;
    } else {
      (next as any).icd = "";
    }

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

  /* ======== Show All (عرض الكل) ======== */
  function resetToAll() {
    setQ("");
    setFDoctor("");
    setFPatient("");
    setSelIcd("");
    setDateFrom("");
    setDateTo("");
    setHasSearched(false);
    setSelectedName("");
    setShowPriorityOnly(false);
    setCardLimit(24);
    fetchData({
      keepLoading: true,
      override: {
        q: "",
        doctor: "",
        patient: "",
        date: "",
        icd: "",
        hasSearched: false,
      },
    });
    fetchChartData({
      override: {
        q: "",
        doctor: "",
        patient: "",
        date: "",
        icd: "",
        hasSearched: false,
      },
    });
    window.dispatchEvent(new CustomEvent("med:cleared"));
  }

  /* ======== Export handler ======== */
  async function handleExport() {
    try {
      setExporting(true);

      const params: Record<string, string> = {};
      if (hasSearched && q.trim()) params.q = q.trim();
      if (fDoctor) params.doctor = fDoctor;
      if (fPatient) params.patient = fPatient;
      if (singleDate) params.date = singleDate;
      if (selIcd) params.icd = selIcd;

      const data = await httpFetch(params);
      const list = data.records || [];

      if (!list.length) {
        alert("لا توجد سجلات لتصديرها بناءً على التصفية أو البحث الحالي.");
        return;
      }

      const headerRow = EXPORT_COLUMNS.map((c) => csvEscape(c.label)).join(",");
      const bodyRows = list.map((row) =>
        EXPORT_COLUMNS.map((c) =>
          csvEscape(
            String(
              (row as any)[c.key] !== undefined && (row as any)[c.key] !== null
                ? (row as any)[c.key]
                : ""
            )
          )
        ).join(",")
      );

      const csvContent = [headerRow, ...bodyRows].join("\r\n");
      const blob = new Blob(["\uFEFF" + csvContent], {
        type: "text/csv;charset=utf-8;",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `medical_records_${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
      alert("حدث خطأ أثناء التصدير. يرجى المحاولة لاحقًا.");
    } finally {
      setExporting(false);
    }
  }

  const suggestItems = useMemo(() => {
    const key = normalize(q);
    const pool: {
      label: string;
      kind: "doctor" | "patient" | "icd" | "text";
    }[] = [];
    allDoctors.forEach((d) => pool.push({ label: d, kind: "doctor" }));
    allPatients.forEach((p) => pool.push({ label: p, kind: "patient" }));
    allIcds.forEach((i) => pool.push({ label: i, kind: "icd" }));

    if (!key) return pool.slice(0, 8);

    const starts = pool.filter((s) => normalize(s.label).startsWith(key));
    const contains = pool.filter(
      (s) =>
        !normalize(s.label).startsWith(key) && normalize(s.label).includes(key)
    );
    const out = [...starts.slice(0, 6), ...contains.slice(0, 4)];
    return out.slice(0, 8);
  }, [q, allDoctors, allPatients, allIcds]);

  const didYouMean = useMemo(() => {
    const key = normalize(q);
    if (!key || key.length < 3) return "";
    const candidates = [...allDoctors, ...allPatients, ...allIcds];
    let best = "";
    let bestDist = Infinity;
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
  }, [q, allDoctors, allPatients, allIcds]);

  /* ===================== Search Bar ===================== */
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
      didYouMean,
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
      kind: "doctor" | "patient" | "icd" | "text";
    }) => {
      const pretty = s.label.replace(/^"|"$/g, "");

      // تحدّيث حقل البحث
      setQ(pretty);
      setHasSearched(true);

      // تحديث الفلاتر مباشرة من الـ window helpers
      if (s.kind === "doctor") {
        (window as any).setFDoctor?.(pretty);
      }
      if (s.kind === "patient") {
        (window as any).setFPatient?.(pretty);
      }
      if (s.kind === "icd") {
        (window as any).setSelIcd?.(pretty);
      }

      // إغلاق قائمة الاقتراحات
      requestAnimationFrame(() => inputRef.current?.blur());
      setShowSuggest(false);

      // 🟢 مهم: استدعاء runSearch بالنص العادي فقط
      // لا نستخدم d:"..." ولا p:"..." ولا icd:"..."
      onRunSearch(pretty, pretty);
    };

    useEffect(() => {
      const handler = () => setShowSuggest(false);
      window.addEventListener("med:cleared", handler);
      return () => window.removeEventListener("med:cleared", handler);
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
              onFocus={() => {
                setShowSuggest(true);
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
              placeholder="ابحث عن اسم طبيب/مريض "
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
                {didYouMean && (
                  <div className="px-3 py-2 text-[12px] text-[#9A4A07] bg-[#FFF6E3]">
                    هل تقصدين:{" "}
                    <button
                      className="underline font-semibold"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        const pretty = didYouMean.replace(/^"|"$/g, "");
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
                            const pretty = r.replace(/^"|"$/g, "");
                            setQ(pretty);
                            setShowSuggest(false);
                            requestAnimationFrame(() =>
                              inputRef.current?.blur()
                            );
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

  // Priority list
  const priorityItems = useMemo(() => {
    const items = rows
      .filter(
        (r) =>
          (r.emer_ind || "").toUpperCase() === "Y" ||
          (r.refer_ind || "").toUpperCase() === "Y"
      )
      .map((r) => ({
        id: String(r.id ?? `${r.patient_name}-${r.treatment_date}`),
        doctor: toTitle(r.doctor_name),
        patient: toTitle(r.patient_name),
        date: r.treatment_date || "",
        kind:
          (r.emer_ind || "").toUpperCase() === "Y"
            ? "عاجل"
            : (r.refer_ind || "").toUpperCase() === "Y"
            ? "تحويل"
            : "",
        complaint: brief(r.chief_complaint, 120),
      }));
    const score = (k: string) => (k === "عاجل" ? 2 : k === "تحويل" ? 1 : 0);
    return items.sort(
      (a, b) =>
        score(b.kind) - score(a.kind) ||
        (b.date || "").localeCompare(a.date || "")
    );
  }, [rows]);

  // KPI rows (مثل صفحة التأمين)
  const kpiRows = useMemo(
    () =>
      fDoctor || fPatient || hasSearched || singleDate || selIcd
        ? rows
        : chartRows,
    [rows, chartRows, fDoctor, fPatient, hasSearched, singleDate, selIcd]
  );

  // rows الخاصة بالبطاقات (تتأثر بالـ control bar)
  const visibleRows = useMemo(() => {
    let base = rows;

    if (priorityMode === "urgent") {
      // فقط السجلات العاجلة / التحويل
      base = rows.filter(
        (r) =>
          (r.emer_ind || "").toUpperCase() === "Y" ||
          (r.refer_ind || "").toUpperCase() === "Y"
      );
    } else if (priorityMode === "latest") {
      // الأحدث أولاً حسب تاريخ العلاج
      base = [...rows].sort((a, b) =>
        (b.treatment_date || "").localeCompare(a.treatment_date || "")
      );
    }

    return base.slice(0, cardLimit);
  }, [rows, priorityMode, cardLimit]);

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
              <SideItem
                icon={<BellRing className="size-4" />}
                label="الإشعارات"
                onClick={() => navigate("/notifications")}
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
            {/* زر الهوم أعلى الهيدر */}
            <button
              onClick={() => navigate("/home")}
              className="absolute top-3 left-3 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              title="العودة للصفحة الرئيسية"
              aria-label="العودة للصفحة الرئيسية"
            >
              <Home className="size-5" style={{ color: theme.brandDark }} />
            </button>

            {/* عنوان + زر التصدير */}
            <div className="text-2xl md:text-3xl font-semibold flex items-center justify-between gap-3">
              <span>السجلات الطبية</span>
              <button
                onClick={handleExport}
                disabled={exporting}
                className="relative -top-2 ml-14 inline-flex items-center gap-3 px-4 py-2 rounded-full text-sm font-semibold bg-white/90 text-emerald-900 border border-white/70 shadow-sm hover:bg-white disabled:opacity-60 disabled:cursor-not-allowed"
                title="تصدير السجلات الحالية إلى ملف Excel"
              >
                {exporting ? (
                  <span>جاري التصدير…</span>
                ) : (
                  <>
                    <span>تصدير إلى Excel</span>
                    <ClipboardList className="size-4 text-emerald-700" />
                  </>
                )}
              </button>
            </div>

            {/* التاريخ دائماً مرئي */}
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SingleDateChip
                value={singleDate}
                onChange={(d) => {
                  setHasSearched(true);
                  setDateFrom(d);
                  setDateTo("");
                }}
                onClear={() => {
                  setDateFrom("");
                  setDateTo("");
                }}
              />
            </div>

            {/* Search داخل الهيدر */}
            <SearchBar
              q={q}
              setQ={(v) => setQ(stripOuterQuotes(v))}
              setHasSearched={setHasSearched}
              suggestRef={suggestRef}
              inputRef={inputRef}
              suggestItems={suggestItems}
              didYouMean={didYouMean}
              recent={recent}
              setRecent={setRecent}
              onRunSearch={(o?: string, p?: string) => runSearch(o, p)}
              onShowAll={resetToAll}
              setShowSuggest={setShowSuggest}
              showSuggest={showSuggest}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
            />

            {/* Filters (after search) */}
            {hasSearched && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(ctxMode === "doctor" ||
                  ctxMode === "icd" ||
                  ctxMode === "patient") && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-[rgba(14,107,67,0.12)] backdrop-blur-sm shadow-sm">
                    {/* شارة فلترة */}
                    <span className="inline-flex items-center gap-2 text-[13px] font-medium text-white bg-white/20 px-2.5 py-1 rounded-full">
                      <span className="w-6 h-6 grid place-items-center rounded-lg bg-white/25">
                        <Filter className="size-4 text-white" />
                      </span>
                      فلترة
                    </span>

                    {/* حسب المريض عندما يكون السياق طبيب */}
                    {ctxMode === "doctor" && (
                      <SoftMenuSelect
                        value={fPatient}
                        onChange={(v) => {
                          setFPatient(v);
                          setSelectedName("");
                        }}
                        placeholder="كل المرضى"
                        options={masterPatientsByDoctor[fDoctor] || []}
                      />
                    )}

                    {/* حسب الطبيب عندما يكون السياق ICD */}
                    {ctxMode === "icd" && (
                      <SoftMenuSelect
                        value={fDoctor}
                        onChange={(v) => {
                          setFDoctor(v);
                          setSelectedName("");
                        }}
                        placeholder="كل الأطباء"
                        options={ctxDoctors}
                      />
                    )}

                    {/* حسب الطبيب عندما يكون السياق مريض */}
                    {ctxMode === "patient" && (
                      <SoftMenuSelect
                        value={fDoctor}
                        onChange={(v) => {
                          setFDoctor(v);
                          setSelectedName("");
                        }}
                        placeholder="كل الأطباء"
                        options={masterDoctorsByPatient[fPatient] || []}
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
              title="عدد السجلات"
              value={kpis(kpiRows).total}
              color="#3B82F6"
              icon={<ClipboardList />}
            />
            <KpiCard
              title="عدد الأطباء"
              value={kpis(kpiRows).doctors}
              color="#D97706"
              icon={<UserPlus />}
            />
            <KpiCard
              title="عدد المرضى"
              value={kpis(kpiRows).patients}
              color="#E05252"
              icon={<Users />}
            />
            <KpiCard
              title="عدد التنبيهات"
              value={notifDrugAlerts}
              color="#0E9F6E"
              icon={<Bell />}
            />
          </div>

          {/* Priority List (Red) */}
          {priorityItems.length > 0 && (
            <div
              className="mt-6 rounded-2xl border shadow-soft p-4"
              style={{ borderColor: "#FECACA", background: "#FEF2F2" }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-red-800">
                  <AlertTriangle className="size-5" />
                  <div className="font-semibold">قائمة الأولويات</div>
                </div>
                <button
                  className="text-red-700 hover:text-red-900 text-sm inline-flex items-center gap-1"
                  onClick={() => setPrioOpen((v) => !v)}
                >
                  {prioOpen ? (
                    <>
                      إخفاء <ChevronUp className="size-4" />
                    </>
                  ) : (
                    <>
                      عرض <ChevronDown className="size-4" />
                    </>
                  )}
                </button>
              </div>

              {prioOpen && (
                <ul className="mt-3 space-y-2">
                  {priorityItems.slice(0, prioLimit).map((p) => (
                    <li
                      key={p.id}
                      className="rounded-xl border px-3 py-2 bg-white flex flex-wrap items-center gap-x-3 gap-y-1"
                      style={{ borderColor: "#FECACA" }}
                      title={`${p.patient} • ${p.doctor}`}
                    >
                      <span
                        className="text-xs font-bold px-2 py-1 rounded-full"
                        style={{
                          background: p.kind === "عاجل" ? "#FEE2E2" : "#FFE4E6",
                          color: p.kind === "عاجل" ? "#B91C1C" : "#BE123C",
                          border: "1px solid #FECACA",
                        }}
                      >
                        {p.kind}
                      </span>
                      <span className="text-sm text-red-900">{p.patient}</span>
                      <CornerDownRight className="size-4 text-red-400" />
                      <span className="text-sm text-red-900">{p.doctor}</span>
                      <span className="text-xs text-red-700/80 ml-auto tabular-nums">
                        {p.date}
                      </span>
                      {p.complaint && (
                        <div className="w-full text-[12px] text-red-700/90 leading-6">
                          {p.complaint}
                        </div>
                      )}
                    </li>
                  ))}
                  {priorityItems.length > prioLimit && (
                    <li className="pt-1">
                      <button
                        className="text-red-700 hover:text-red-900 text-sm"
                        onClick={() => setPrioLimit((n) => n + 8)}
                      >
                        عرض المزيد…
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </div>
          )}

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
                      <linearGradient
                        id="barGradOrange"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#FDBA74"
                          stopOpacity={0.95}
                        />
                        <stop
                          offset="100%"
                          stopColor="#D97706"
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
                      wrapperStyle={{
                        maxWidth: 420,
                      }}
                      contentStyle={{
                        backgroundColor: "white",
                        borderRadius: 12,
                        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                        border: "1px solid #E5E7EB",
                        maxWidth: 420,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
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
                            fill="url(#barGradOrange)"
                            fillOpacity={active ? 1 : 0.25}
                            stroke={active ? "#F59E0B" : "transparent"}
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

          {/* 🔶 شريط التحكم في البطاقات – نفس شكل سجلات الأدوية */}
          <div
            className="mt-4 rounded-3xl border px-4 py-3 bg-[#E6F7EF]"
            style={{ borderColor: "#BFDCD1" }}
          >
            <div className="flex flex-wrap items-center gap-3 justify-between">
              {/* يمين: أولوية + صافي بين من/إلى */}
              <div className="flex flex-wrap items-center gap-3 text-[12px] text-neutral-700">
                {/* الأولوية كمنسدلة */}
                <div className="relative flex items-center gap-2">
                  <span className="text-neutral-700">الأولوية:</span>
                  <button
                    type="button"
                    onClick={() => setPriorityMenuOpen((v) => !v)}
                    className="inline-flex items-center justify-between min-w-[160px] px-3 h-9 rounded-full bg-white border border-emerald-100 text-[12px] text-neutral-800 shadow-sm"
                  >
                    <span>
                      {priorityMode === "none"
                        ? "بدون"
                        : priorityMode === "urgent"
                        ? "عاجل/تحويل أولاً"
                        : "الأحدث أولاً"}
                    </span>
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="text-emerald-700"
                      >
                        <path
                          d="M5.5 7.5L10 12l4.5-4.5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                  </button>

                  {priorityMenuOpen && (
                    <div className="absolute mt-1 right-0 z-20 w-full rounded-2xl bg-white shadow-lg border border-emerald-100 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => {
                          setPriorityMode("none");
                          setPriorityMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-right text-[12px] hover:bg-emerald-50"
                      >
                        بدون
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPriorityMode("urgent");
                          setPriorityMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-right text-[12px] hover:bg-emerald-50"
                      >
                        عاجل/تحويل أولاً
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setPriorityMode("latest");
                          setPriorityMenuOpen(false);
                        }}
                        className="w-full px-3 py-2 text-right text-[12px] hover:bg-emerald-50"
                      >
                        الأحدث أولاً
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* يسار: عدد البطاقات + زر عرض / إخفاء */}
              <div className="flex flex-wrap items-center gap-3 text-[12px]">
                {/* عدد البطاقات */}
                <div className="flex items-center gap-2">
                  <span className="text-neutral-700">عدد البطاقات</span>
                  <div className="relative">
                    <button
                      type="button"
                      className="inline-flex items-center justify-between w-[80px] px-3 h-9 rounded-full bg-white border border-emerald-100 text-[12px] text-neutral-800 shadow-sm"
                      onClick={() => setCardsMenuOpen((v) => !v)}
                    >
                      <span>{cardLimit}</span>
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-emerald-50">
                        <svg
                          width="12"
                          height="12"
                          viewBox="0 0 20 20"
                          fill="none"
                          className="text-emerald-700"
                        >
                          <path
                            d="M5.5 7.5L10 12l4.5-4.5"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    </button>

                    {cardsMenuOpen && (
                      <div className="absolute mt-1 right-0 z-20 w-full rounded-2xl bg-white shadow-lg border border-emerald-100 overflow-hidden">
                        {cardOptions.map((n) => (
                          <button
                            key={n}
                            type="button"
                            onClick={() => {
                              setCardLimit(n);
                              setCardsMenuOpen(false);
                            }}
                            className="w-full px-3 py-2 text-right text-[12px] hover:bg-emerald-50"
                          >
                            {n}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* زر عرض / إخفاء */}
                {!showCards ? (
                  <button
                    type="button"
                    onClick={() => setShowCards(true)}
                    className="inline-flex items-center justify-center px-6 h-9 rounded-full bg-emerald-500 text-white text-[12px] font-semibold shadow-sm hover:bg-emerald-600"
                  >
                    عرض
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowCards(false)}
                    className="inline-flex items-center justify-center px-6 h-9 rounded-full bg-white text-emerald-800 text-[12px] font-semibold border border-emerald-200 hover:bg-emerald-50"
                  >
                    إخفاء البطاقات
                  </button>
                )}
              </div>
            </div>

            {/* نص مساعدة أسفل الشريط */}
            <p className="mt-2 text-[11px] text-emerald-900/70 text-right">
              {showCards
                ? "البطاقات معروضة. يمكنك تغيير عددها أو طريقة ترتيبها (أولوية / الأحدث) من الشريط أعلاه."
                : "اضغطي «عرض» لإظهار البطاقات التفصيلية بحسب الفلاتر الحالية."}
            </p>
          </div>
          {/* بطاقات السجلات التفصيلية */}
          {showCards && (
            <div className="mt-6 grid grid-cols-1 gap-4 print:gap-2">
              {firstLoadDone && !loading && rows.length === 0 ? (
                <div
                  className="h-[140px] grid place-items-center text-neutral-500 text-sm border rounded-2xl bg-white"
                  style={{ borderColor: theme.border }}
                >
                  لا توجد بيانات مطابقة — غيّري التاريخ أو البحث.
                </div>
              ) : visibleRows.length === 0 && rows.length > 0 ? (
                <div
                  className="h-[140px] grid place-items-center text-neutral-500 text-sm border rounded-2xl bg-white"
                  style={{ borderColor: theme.border }}
                >
                  لا توجد بيانات مطابقة لإعدادات شريط التحكم — جرّبي إلغاء
                  "الأولوية" أو زيادة عدد البطاقات.
                </div>
              ) : (
                visibleRows.map((r) => (
                  <RecordCard
                    key={String(r.id ?? r.patient_name + r.treatment_date)}
                    r={r}
                  />
                ))
              )}
            </div>
          )}
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
    if (n && n.toLowerCase() !== "nan") {
      byDoc[n] = (byDoc[n] ?? 0) + 1;
    }

    const pn = toTitle(r.patient_name);
    if (pn && pn.toLowerCase() !== "nan") {
      patSet.add(pn);
    }

    if (
      (r.emer_ind || "").toUpperCase() === "Y" ||
      (r.refer_ind || "").toUpperCase() === "Y"
    ) {
      alerts++;
    }
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

// KPI Card
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

function SoftMenuSelect({
  value,
  onChange,
  title,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  title: string;
  placeholder: string;
  options: string[];
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const uniq = Array.from(new Set(options.filter(Boolean)));
  const allOptions = [placeholder, ...uniq];

  const currentLabel = value || placeholder;

  return (
    <div ref={wrapRef} className="relative min-w-[180px]">
      <div className="mb-1 text-[11px] text-white/80">{title}</div>

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="h-9 w-full rounded-full bg-white text-[13px] flex items-center justify-between px-3 shadow-sm border border-emerald-100 hover:bg-emerald-50/70 transition"
      >
        <span className="truncate text-right text-emerald-900">
          {currentLabel}
        </span>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-[#E0F7F2] border border-[#aee7d8]">
          <svg width="12" height="12" viewBox="0 0 20 20" fill="none">
            <path
              d="M5.5 7.5L10 12l4.5-4.5"
              stroke="#059669"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </button>

      {open && (
        <div className="absolute mt-1 right-0 z-40 w-full rounded-2xl bg-white border border-emerald-100 shadow-lg overflow-hidden">
          <div className="max-h-60 overflow-auto">
            {allOptions.map((opt) => {
              const isAll = opt === placeholder;
              const val = isAll ? "" : opt;
              const active = value === val || (!value && isAll);
              return (
                <button
                  key={opt || "__all"}
                  type="button"
                  onClick={() => {
                    onChange(val);
                    setOpen(false);
                  }}
                  className={clsx(
                    "w-full text-right px-3 py-2 text-[13px] transition",
                    active
                      ? "bg-emerald-50 text-emerald-900 font-semibold"
                      : "hover:bg-emerald-50/70 text-neutral-800"
                  )}
                >
                  {opt}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// كرت السجل الطبي
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
      className="shadow-sm print:shadow-none print:p-3 transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-lg relative overflow-hidden p-4"
      style={{
        background: "#F6FBF8",
        border: "1px solid #D7E7DF",
        borderRadius: "18px",
      }}
    >
      <div
        className="absolute right-0 top-0 h-full w-1.5"
        style={{ background: statusColor }}
      />
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {r.claim_type &&
          badge(`نوع المطالبة: ${toTitle(r.claim_type)}`, theme.brandDark)}
        {(r.emer_ind || "").toUpperCase() === "Y" && badge("عاجل", "#B45309")}
        {(r.refer_ind || "").toUpperCase() === "Y" && badge("تحويل", "#2563EB")}
        {r.contract && badge("يوجد عقد", "#065F46")}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="اسم الطبيب" value={toTitle(r.doctor_name)} />
        <Field label="اسم المريض" value={toTitle(r.patient_name)} />
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
      </div>

      <div
        className="mt-3 rounded-2xl px-3 py-3 flex items-start gap-3"
        style={{
          background: "#E7F8EF",
          border: "1px solid #C6EAD7",
        }}
      >
        <div className="w-8 h-8 rounded-xl bg-[rgba(14,107,67,0.06)] flex items-center justify-center">
          <Bot className="size-4 text-emerald-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify_between gap-2">
            <span className="text-[13px] font-semibold text-neutral-800">
              تحليل AI
            </span>
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-50 text-emerald-800 border border-emerald-100">
              تجريبي
            </span>
          </div>
          <p className="mt-1 text-[12px] leading-5 text-neutral-600">
            {r.ai_analysis
              ? brief(r.ai_analysis, 200)
              : "No analysis yet — will be added by AI Agent."}
          </p>
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
        style={{
          background: "#FBFEFC",
          borderColor: "#DDE8E2",
        }}
        title={typeof value === "string" ? value : undefined}
      >
        {value || "—"}
      </div>
    </div>
  );
}

/* زر التاريخ دائماً مرئي (Gregorian) */ function SingleDateChip({
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
      {" "}
      <input
        ref={ref}
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden
      />{" "}
      <button
        onClick={open}
        className="h-9 pl-3 pr-2 rounded-full flex items-center gap-2 shadow-sm transition bg-[rgba(14,107,67,0.13)] hover:bg-[rgba(14,107,67,0.18)] text-white focus:outline-none focus:ring-2 focus:ring-emerald-300"
        title="التاريخ"
      >
        {" "}
        <span className="w-6 h-6 rounded-full grid place-items-center shadow bg-white/30">
          {" "}
          <CalendarDays className="size-4 text-white" />{" "}
        </span>{" "}
        <span className="text-sm">{nice}</span>{" "}
        {value && (
          <span
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="ml-1 grid place-items-center w-5 h-5 rounded-full bg-black/10 hover:bg-black/20 text-[12px]"
            title="مسح التاريخ"
          >
            {" "}
            ×{" "}
          </span>
        )}{" "}
      </button>{" "}
    </div>
  );
}
