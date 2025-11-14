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
  Eye,
  CalendarDays,
  X,
  ClipboardList,
  Users,
  Bell,
  History,
  Filter,
  ChevronDown,
} from "lucide-react";
import clsx from "clsx";
import { apiGetDrugs, apiLogout } from "@/lib/api";
import SmartDrugChat from "@/components/SmartDrugChat";

/* ====== AG Grid (مطابق للDashboard) ====== */
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GetRowIdParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";

ModuleRegistry.registerModules([AllCommunityModule]);

import {
  PieChart,
  Pie,
  Cell,
  Tooltip as RTooltip,
  ResponsiveContainer,
} from "recharts";

/* ============================== Tokens ============================== */
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

const theme = {
  brandDark: brand.green,
  brandMid: brand.greenHover,
  surfaceAlt: "#F5F7FB",
  ink: "#0B0F14",
  border: "#E6EEF0",
};

const pageBg =
  "linear-gradient(180deg,#F5F9F7 0%,#ECF5F2 100%), radial-gradient(800px 500px at 12% 8%, rgba(169,222,214,0.18) 0%, transparent 60%)";

const headerGrad = `linear-gradient(135deg, ${theme.brandDark} 0%, #0B3B3C 60%, ${theme.brandDark} 100%)`;

/* helpers للألوان (لـ KPI Cards) */
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

/* ============================== Types ============================== */
type DrugRow = {
  id?: number | string;
  doctor_name: string;
  patient_name: string;
  service_code: string;
  service_description: string;
  quantity: number | string | null;
  item_unit_price: number | string | null;
  gross_amount: number | string | null;
  vat_amount: number | string | null;
  discount: number | string | null;
  net_amount: number | string | null;
  date: string;
  ai_analysis?: string;
};

type RecordsResponse = {
  total_operations: number;
  top_drug?: string;
  alerts_count?: number;
  records: DrugRow[];
};

type SuggestItem = {
  label: string;
  kind: "doctor" | "patient" | "drug" | "code" | "text";
};

/* ============================== Helpers ============================== */
const normalize = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u064B-\u065F\u0610-\u061A]/g, "")
    .replace(/[آأإ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[‐-–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
const isLatin = (s: string) => /[A-Za-z]/.test(s);

const nfmt = (v: number | string | undefined | null) => {
  if (v === undefined || v === null || v === "") return "—";
  const num = Number(v);
  if (!isFinite(num)) return String(v);
  return num.toLocaleString("ar-SA", { maximumFractionDigits: 2 });
};

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

/* ============================== CSV Export ============================== */
const csvEscape = (value: string) => {
  const v = value ?? "";
  const needsQuotes = /[",\n\r]/.test(v);
  const safe = v.replace(/"/g, '""');
  return needsQuotes ? `"${safe}"` : safe;
};

const EXPORT_COLUMNS: { key: keyof DrugRow; label: string }[] = [
  { key: "doctor_name", label: "اسم الطبيب" },
  { key: "patient_name", label: "اسم المريض" },
  { key: "service_code", label: "كود الخدمة/الدواء" },
  { key: "service_description", label: "وصف الخدمة/الدواء" },
  { key: "quantity", label: "الكمية" },
  { key: "item_unit_price", label: "سعر الوحدة" },
  { key: "gross_amount", label: "الإجمالي" },
  { key: "vat_amount", label: "الضريبة" },
  { key: "discount", label: "الخصم" },
  { key: "net_amount", label: "الصافي" },
  { key: "date", label: "التاريخ" },
  { key: "ai_analysis", label: "تحليل AI" },
];

/* ============================== Donut Type ============================== */
type DonutSlice = { label: string; value: number; color?: string };

/* ============================== Page ============================== */
export default function Drugs() {
  const navigate = useNavigate();

  // بيانات أساسية
  const [rows, setRows] = useState<DrugRow[]>([]);
  const [totalOps, setTotalOps] = useState<number>(0);
  const [topDrug, setTopDrug] = useState<string>("—");
  const [alertsCount, setAlertsCount] = useState<number>(0);
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
  const totalDrugAlerts = alertsCount + notifDrugAlerts;

  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // قوائم للاقتراحات مثل صفحة السجلات التأمينية
  const [doctors, setDoctors] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);
  const [patients, setPatients] = useState<string[]>([]);
  const [codes, setCodes] = useState<string[]>([]);

  // حالة الواجهة
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [firstLoadDone, setFirstLoadDone] = useState(false);

  // AI (placeholder)
  const [selectedDate, setSelectedDate] = useState<any>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // فلاتر و بحث
  const [selDate, setSelDate] = useState<string>("الكل"); // "الكل" | "الأسبوع الأخير"
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selDrug, setSelDrug] = useState<string>("الكل");
  const [q, setQ] = useState("");
  const [qKey, setQKey] = useState(""); // للـ debounce
  const [exporting, setExporting] = useState(false);

  // شريط التحكم تحت الشارت
  const [rowLimit, setRowLimit] = useState<number>(40);
  const [showTopOnly, setShowTopOnly] = useState<boolean>(false);
  // شريط البطاقات (مثل التأميني)
  const [prioMode, setPrioMode] = useState<
    "none" | "urgency" | "recency" | "amount"
  >("none");
  const [rangePreset, setRangePreset] = useState("");
  const [rangeMin, setRangeMin] = useState("");
  const [rangeMax, setRangeMax] = useState("");
  const [pageSize, setPageSize] = useState(30);
  const [showCards, setShowCards] = useState(false);

  // Viewer
  const [viewRow, setViewRow] = useState<DrugRow | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const openViewer = (r: DrugRow) => {
    setViewRow(r);
    setShowViewer(true);
  };

  // مثال: مع باقي الـ useState الموجودة عندك
  const [viewerRow, setViewerRow] = useState<DrugRow | null>(null);

  const closeViewer = () => {
    setShowViewer(false);
    setViewRow(null);
  };

  // اقتراحات البحث
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("drugs_recent") || "[]");
    } catch {
      return [];
    }
  });

  const inputRef = useRef<HTMLInputElement | null>(null);
  const suggestRef = useRef<HTMLDivElement | null>(null);
  // فلتر رابط بين الطبيب والدواء (مثل فلترة الأنواع في التأميني)
  const [linkFilterOpen, setLinkFilterOpen] = useState(false);
  const [linkFilterValue, setLinkFilterValue] = useState<string>("");

  // نحدد نوع الفلترة الحالية
  const linkFilterMode = useMemo<
    "none" | "drugByDoctor" | "doctorByDrug"
  >(() => {
    if (selDoctor !== "الكل" && selDrug === "الكل") return "drugByDoctor"; // اخترنا طبيب فقط
    if (selDrug !== "الكل" && selDoctor === "الكل") return "doctorByDrug"; // اخترنا دواء فقط
    return "none";
  }, [selDoctor, selDrug]);

  // الخيارات داخل الليستة حسب الوضع
  const linkFilterOptions = useMemo(() => {
    if (linkFilterMode === "drugByDoctor") {
      const set = new Set<string>();
      rows.forEach((r) => {
        if (normalize(r.doctor_name) === normalize(selDoctor)) {
          if (r.service_description) set.add(r.service_description);
        }
      });
      return Array.from(set).sort();
    }
    if (linkFilterMode === "doctorByDrug") {
      const set = new Set<string>();
      rows.forEach((r) => {
        if (normalize(r.service_description) === normalize(selDrug)) {
          if (r.doctor_name) set.add(r.doctor_name);
        }
      });
      return Array.from(set).sort();
    }
    return [];
  }, [linkFilterMode, rows, selDoctor, selDrug]);

  // كل ما تغيّر الطبيب/الدواء الأساسي نعيد ضبط قيمة الفلتر
  useEffect(() => {
    setLinkFilterValue("");
    setLinkFilterOpen(false);
  }, [linkFilterMode, selDoctor, selDrug]);

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

  // بعد useEffect حق تحميل سجلات الأدوية مثلاً
  useEffect(() => {
    (async () => {
      try {
        const list = await fetchNotificationsForDrugs();

        // عدد إشعارات الأدوية فقط
        const count = list.filter(
          (n) => n.kind === "دواء" // نوع السجل دوائي
          // لو تبغي فقط غير المقروءة:
          // && !n.read
          // أو فقط الطارئة والتنبيهات بدون "معلومة":
          // && n.severity !== "معلومة"
        ).length;

        setAlertsCount(count);
      } catch (e) {
        console.error("فشل تحميل إشعارات الأدوية:", e);
        // ممكن تتركين alertsCount كما هو (0) لو صار خطأ
      }
    })();
  }, []);

  // Debounce للبحث النصي
  useEffect(() => {
    const id = setTimeout(() => setQKey(normalize(q.trim())), 220);
    return () => clearTimeout(id);
  }, [q]);

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

        const list = (data?.records ?? []).map((r: any, i: number) => ({
          id: r.id ?? i + 1,
          doctor_name: r.doctor_name || "—",
          patient_name: r.patient_name || "—",
          service_code: r.service_code || "—",
          service_description: r.service_description || "—",
          quantity: r.quantity ?? 0,
          item_unit_price: r.item_unit_price ?? 0,
          gross_amount: r.gross_amount ?? 0,
          vat_amount: r.vat_amount ?? 0,
          discount: r.discount ?? 0,
          net_amount: r.net_amount ?? 0,
          date: r.date || "—",
          ai_analysis: r.ai_analysis || "",
        }));

        setRows(list);
        setTotalOps(data?.total_operations ?? list.length);
        setTopDrug(data?.top_drug || "—");
        setAlertsCount(data?.alerts_count ?? 0);

        // قوائم مخصصة للاقتراحات الذكية
        setDoctors(
          Array.from(
            new Set(list.map((r) => r.doctor_name).filter(Boolean))
          ).sort()
        );
        setDrugs(
          Array.from(
            new Set(list.map((r) => r.service_description).filter(Boolean))
          ).sort()
        );
        setPatients(
          Array.from(
            new Set(list.map((r) => r.patient_name).filter(Boolean))
          ).sort()
        );
        setCodes(
          Array.from(
            new Set(list.map((r) => r.service_code).filter(Boolean))
          ).sort()
        );
      } catch (e: any) {
        if (!cancel) setError(extractErr(e) || "فشل تحميل سجلات الأدوية.");
      } finally {
        if (!cancel) {
          setLoading(false);
          setFirstLoadDone(true);
        }
      }
    })();
    return () => {
      cancel = true;
    };
  }, [selDate]);

  /* ---------- عناصر الاقتراحات بناءً على النص ---------- */
  const suggestItems = useMemo<SuggestItem[]>(() => {
    const key = normalize(q);
    const pool: SuggestItem[] = [];

    doctors.forEach((d) => pool.push({ label: d, kind: "doctor" }));
    drugs.forEach((d) => pool.push({ label: d, kind: "drug" }));
    patients.forEach((p) => pool.push({ label: p, kind: "patient" }));
    codes.forEach((c) => pool.push({ label: c, kind: "code" }));

    if (!key) return pool.slice(0, 8);

    const starts = pool.filter((s) => normalize(s.label).startsWith(key));
    const contains = pool.filter(
      (s) =>
        !normalize(s.label).startsWith(key) && normalize(s.label).includes(key)
    );

    return [...starts.slice(0, 6), ...contains.slice(0, 4)];
  }, [q, doctors, drugs, patients, codes]);
  // نفس منطق زر "بحث" ويمكننا استدعاؤه من الزر أو من الاقتراحات
  const handleRunSearch = (text?: string) => {
    setShowSuggest(false);

    const raw = (text ?? q).trim();
    if (!raw) return;

    const pretty = raw;
    const key = normalize(raw);

    // نحاول نطابق دكتور / دواء
    let matchDoctor = doctors.find((d) => normalize(d) === key) || null;
    let matchDrug = drugs.find((d) => normalize(d) === key) || null;

    // لو ما لقينا تطابق كامل، نجرب تطابق جزئي
    if (!matchDoctor) {
      matchDoctor = doctors.find((d) => normalize(d).includes(key)) || null;
    }
    if (!matchDrug) {
      matchDrug = drugs.find((d) => normalize(d).includes(key)) || null;
    }

    if (matchDoctor && !matchDrug) {
      // بحث باسم طبيب
      setSelDoctor(matchDoctor);
      setSelDrug("الكل");
    } else if (matchDrug && !matchDoctor) {
      // بحث باسم دواء
      setSelDrug(matchDrug);
      setSelDoctor("الكل");
    } else {
      // بحث عام – ما نغير الطبيب/الدواء
    }

    // حفظ في history
    const next = [pretty, ...recent.filter((r) => r !== pretty)].slice(0, 10);
    setRecent(next);
    try {
      localStorage.setItem("drugs_recent", JSON.stringify(next));
    } catch {
      /* ignore */
    }
  };

  const applySuggestion = (s: SuggestItem) => {
    // استخدم نفس منطق زر "بحث"
    handleRunSearch(s.label);
  };

  /* ---------- تصفية الجدول (تشمل كل الفلاتر) ---------- */
  const filtered = useMemo(() => {
    let out = rows;
    if (selDoctor !== "الكل")
      out = out.filter(
        (r) => normalize(r.doctor_name) === normalize(selDoctor)
      );
    if (selDrug !== "الكل")
      out = out.filter(
        (r) => normalize(r.service_description) === normalize(selDrug)
      );
    if (qKey) {
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
          .map((v) => normalize(String(v)))
          .some((v) => v.includes(qKey))
      );
    }
    return out;
  }, [rows, selDoctor, selDrug, qKey]);
  /* ---------- بيانات البطاقات (لواجهة الكروت) ---------- */
  const cardRows = useMemo(() => {
    let out = filtered;

    // فلترة بالصافي بين
    const min = rangeMin ? Number(rangeMin) : null;
    const max = rangeMax ? Number(rangeMax) : null;

    if (min !== null || max !== null) {
      out = out.filter((r) => {
        const val = Number(r.net_amount ?? 0);
        if (!Number.isFinite(val)) return false;
        if (min !== null && val < min) return false;
        if (max !== null && val > max) return false;
        return true;
      });
    }

    // ترتيب حسب الأولوية
    if (prioMode === "amount") {
      out = [...out].sort(
        (a, b) => Number(b.net_amount ?? 0) - Number(a.net_amount ?? 0)
      );
    } else if (prioMode === "recency") {
      out = [...out].sort((a, b) =>
        String(b.date || "").localeCompare(String(a.date || ""))
      );
    }
    // prioMode === "urgency" حالياً بدون تأثير

    return out.slice(0, pageSize);
  }, [filtered, rangeMin, rangeMax, prioMode, pageSize]);

  /* ---------- نسخة للدونات: بدون فلتر الدواء ---------- */
  const filteredNoDrug = useMemo(() => {
    let out = rows;
    if (selDoctor !== "الكل")
      out = out.filter(
        (r) => normalize(r.doctor_name) === normalize(selDoctor)
      );
    if (qKey) {
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
          .map((v) => normalize(String(v)))
          .some((v) => v.includes(qKey))
      );
    }
    return out;
  }, [rows, selDoctor, qKey]);
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { query: string };
      // هنا شبكي الـ query مع منطق البحث الموجود عندك في السجلات الدوائية
      // مثلاً: setQuickQuery(detail.query); أو استدعاء fetch ببارامترات معينة
    };

    window.addEventListener("drug:runQuick", handler);
    return () => window.removeEventListener("drug:runQuick", handler);
  }, []);

  /* ---------- توزيع الدونات (حسب الدواء) ---------- */
  const donut = useMemo<DonutSlice[]>(() => {
    if (!filteredNoDrug.length) return [];
    const counts = new Map<string, number>();
    filteredNoDrug.forEach((r) => {
      const key = r.service_description || "-";
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });
    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    const palette = [
      "#3B82F6",
      "#103062ff",
      "#06D7A0",
      "#FFD167",
      "#E78C6A",
      "#F04770",
    ];
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([label, c], i) => ({
        label,
        value: Math.round((c / total) * 100),
        color: palette[i % palette.length],
      }));
  }, [filteredNoDrug]);

  const topDrugLocal = useMemo(() => {
    if (topDrug && topDrug !== "-") return topDrug;
    if (!donut.length) return "—";
    return donut.reduce((a, b) => (a.value >= b.value ? a : b)).label;
  }, [topDrug, donut]);

  /* ---------- KPIs ---------- */
  const kpiSource = useMemo(
    () =>
      selDoctor !== "الكل" || selDrug !== "الكل" || qKey ? filtered : rows,
    [filtered, rows, selDoctor, selDrug, qKey]
  );

  const doctorCount = useMemo(
    () => new Set(kpiSource.map((r) => r.doctor_name).filter(Boolean)).size,
    [kpiSource]
  );

  const drugCount = useMemo(
    () =>
      new Set(kpiSource.map((r) => r.service_description).filter(Boolean)).size,
    [kpiSource]
  );

  /* ---------- بيانات الجدول المتحكم بها من الـ Control Bar ---------- */
  const gridRows = useMemo(() => {
    let base = filtered;
    if (showTopOnly && donut.length) {
      const allowed = new Set(
        donut.map((d) => normalize(d.label)) // الأدوية الأعلى صرفاً
      );
      base = base.filter((r) =>
        allowed.has(normalize(r.service_description || ""))
      );
    }
    return base.slice(0, rowLimit);
  }, [filtered, showTopOnly, donut, rowLimit]);

  async function doLogout() {
    try {
      await apiLogout();
    } catch {
    } finally {
      navigate("/", { replace: true });
    }
  }

  /* ---------- Export ---------- */
  async function handleExport() {
    try {
      setExporting(true);

      const list = filtered;
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
      link.download = `drug_records_${new Date()
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

  /* ===================== أعمدة الجدول ===================== */
  const colDefs: ColDef<DrugRow>[] = [
    {
      headerName: "#",
      valueGetter: (p) => (p.node ? p.node.rowIndex + 1 : 0),
      width: 80,
      pinned: "right",
      suppressMenu: true,
      resizable: false,
    },
    {
      field: "doctor_name",
      headerName: "اسم الطبيب",
      minWidth: 160,
      maxWidth: 220,
      tooltipValueGetter: (p) => p.data?.doctor_name || "—",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? "—"} />,
    },
    {
      field: "patient_name",
      headerName: "اسم المريض",
      minWidth: 180,
      maxWidth: 240,
      tooltipValueGetter: (p) => p.data?.patient_name || "—",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? "—"} />,
    },
    {
      field: "service_description",
      headerName: "وصف الخدمة/الدواء",
      flex: 1,
      minWidth: 360,
      valueGetter: (p) => p.data?.service_description || "—",
      tooltipValueGetter: (p) => p.data?.service_description || "—",
      cellRenderer: (p: any) => <ClipCell text={p.value ?? "—"} />,
    },
    {
      field: "service_code",
      headerName: "كود",
      width: 110,
      cellRenderer: (p: any) => <ClipCell text={String(p.value ?? "—")} />,
    },
    {
      field: "quantity",
      headerName: "الكمية",
      width: 100,
      cellRenderer: (p: any) => (
        <span className="tabular-nums">{nfmt(p.value)}</span>
      ),
    },
    {
      field: "net_amount",
      headerName: "الصافي",
      width: 130,
      cellRenderer: (p: any) => (
        <span className="tabular-nums">{nfmt(p.value)}</span>
      ),
    },
    {
      field: "date",
      headerName: "التاريخ",
      width: 130,
      cellRenderer: (p: any) => (
        <span title={p.value} className="tabular-nums">
          {p.value || "—"}
        </span>
      ),
    },
    {
      headerName: "عرض",
      width: 150,
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
            title="عرض تفاصيل العملية"
          >
            <Eye className="size-3.5" />
            عرض كامل
          </button>
        </div>
      ),
    },
  ];

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
              {/* نفس ترتيب السايدبار مثل التأميني */}
              <SideItem
                icon={<Pill className="size-4" />}
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
                label="السجلات الدوائية"
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
              onClick={doLogout}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* Header (مطابق لتصميم التأميني) */}
          <div
            className="relative z-50 rounded-2xl p-5 text-white shadow-soft"
            style={{ background: headerGrad }}
          >
            {/* زر Home */}
            <button
              onClick={() => navigate("/home")}
              className="absolute top-3 left-3 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              title="العودة للصفحة الرئيسية"
              aria-label="العودة للصفحة الرئيسية"
            >
              <Home className="size-5" style={{ color: theme.brandDark }} />
            </button>

            {/* عنوان + زر تصدير (نفس ستايل التأميني) */}
            <div className="text-2xl md:text-3xl font-semibold flex items-center justify-between gap-3">
              <span>سجلات الأدوية</span>
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
            {/* زر اختيار التاريخ — نفس تصميم السجلات التأمينية */}
            <div className="mt-4 flex items-center justify-start">
              <button
                onClick={() => setShowDatePicker(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold 
               bg-white/20 text-white border border-white/30 shadow-sm 
               hover:bg-white/30 transition"
                title="اختيار التاريخ"
              >
                اختر التاريخ
                <CalendarDays className="size-4 text-white" />
              </button>

              {showDatePicker && (
                <div className="absolute mt-2 z-[100] bg-white rounded-xl shadow-2xl p-2">
                  <YourDatePickerComponent
                    selected={selectedDate}
                    onChange={(date: any) => {
                      setSelectedDate(date);
                      setShowDatePicker(false);
                    }}
                    onClose={() => setShowDatePicker(false)}
                  />
                </div>
              )}
            </div>

            {/* شريط البحث + الأزرار بنفس تصميم كود1 */}
            <SearchBar
              q={q}
              setQ={setQ}
              suggestRef={suggestRef}
              inputRef={inputRef}
              suggestItems={suggestItems}
              recent={recent}
              setRecent={setRecent}
              onApplySuggestion={applySuggestion}
              onRunSearch={() => handleRunSearch()}
              onShowAll={() => {
                setQ("");
                setSelDoctor("الكل");
                setSelDrug("الكل");
                setSelDate("الكل");
                setShowSuggest(false);
              }}
              showSuggest={showSuggest}
              setShowSuggest={setShowSuggest}
              activeIdx={activeIdx}
              setActiveIdx={setActiveIdx}
            />

            {/* فلتر مرتبط بين الطبيب والدواء داخل نفس الكرت الأخضر */}
            {linkFilterMode !== "none" && (
              <div className="mt-3 flex justify-start md:justify-start">
                <div className="relative">
                  {/* زر فتح الليستة – نفس ستايل "كل الأنواع" */}
                  <button
                    type="button"
                    onClick={() => setLinkFilterOpen((v) => !v)}
                    className="h-10 min-w-[220px] px-3 rounded-full bg-white text-sm font-medium
                   flex flex-row-reverse items-center justify-between
                   shadow-sm border border-emerald-100 hover:bg-emerald-50 transition"
                  >
                    {/* النص على اليمين */}
                    <span className="flex-1 text-right truncate text-emerald-900">
                      {linkFilterMode === "drugByDoctor"
                        ? linkFilterValue || "كل الأدوية التي صرفها الطبيب"
                        : linkFilterValue ||
                          "كل الأطباء الذين صرفوا هذا الدواء"}
                    </span>

                    {/* الدائرة مع السهم على اليسار */}
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full border border-emerald-100 bg-emerald-50/70">
                      <ChevronDown
                        className={clsx(
                          "w-4 h-4 text-emerald-700 transition-transform",
                          linkFilterOpen && "rotate-180"
                        )}
                      />
                    </span>
                  </button>

                  {/* الليستة نفسها تبقى كما هي تحتها */}
                  {linkFilterOpen && (
                    <div
                      className="absolute right-0 mt-2 w-full max-w-xs rounded-xl bg-white shadow-2xl border border-emerald-100 z-[90] overflow-hidden"
                      style={{ maxHeight: 260 }}
                    >
                      {/* ... نفس كود <ul> والـ options اللي عندك الآن ... */}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Error بنفس ستايل كود1 */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <X className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Skeleton (نفس فكرة كود1) */}
          {(!firstLoadDone || loading) && rows.length === 0 && (
            <div className="mt-6 grid gap-4">
              <div className="h-20 bg-white rounded-2xl animate-pulse" />
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
              <div className="h-[460px] bg-white rounded-2xl animate-pulse" />
            </div>
          )}

          {/* محتوى بعد التحميل */}
          {!loading && firstLoadDone && (
            <>
              {/* KPI Cards */}
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative z-0">
                <KpiCard
                  title="عدد عمليات صرف الدواء"
                  value={kpiSource.length || totalOps}
                  color="#3B82F6"
                  icon={<ClipboardList />}
                />
                <KpiCard
                  title="عدد الأطباء"
                  value={doctorCount}
                  color="#0E9F6E"
                  icon={<Users />}
                />
                <KpiCard
                  title="عدد الأدوية المختلفة"
                  value={drugCount}
                  color="#D97706"
                  icon={<Pill />}
                />
                <KpiCard
                  title="عدد التنبيهات"
                  value={notifDrugAlerts}
                  color="#EF4444"
                  icon={<Bell />}
                />
              </div>

              {/* كرت الشارت (دونات) */}
              <div className="mt-6">
                <div
                  className="rounded-2xl bg-white shadow-soft p-5 border"
                  style={{
                    borderColor: theme.border,
                    background:
                      "radial-gradient(circle at 10% 0%, #ECFEFF 0, #FFFFFF 40%, #F1F5F9 120%)",
                  }}
                >
                  <div className="mb-1 font-semibold text-neutral-700 flex items-center justify-between">
                    <span>نسبة الصرف حسب الدواء</span>
                    <span className="text-xs text-neutral-500">
                      الأكثر صرفًا حاليًا:{" "}
                      <span className="font-semibold text-emerald-800">
                        {topDrugLocal}
                      </span>
                    </span>
                  </div>

                  <DonutChartCard
                    data={donut}
                    activeLabel={selDrug !== "الكل" ? selDrug : undefined}
                    onSelect={(label) =>
                      setSelDrug((curr) =>
                        normalize(curr) === normalize(label) ? "الكل" : label
                      )
                    }
                  />
                </div>
              </div>
              {/* دردشة ذكية */}
              <SmartDrugChat side="right" themeColor="#0E6B43" />

              {/* شريط البطاقات (مثل التأميني) */}
              <div
                className="mt-4 rounded-2xl p-4 shadow-soft flex flex-wrap items-center gap-3 border"
                style={{
                  background: "#E6F7EF",
                  borderColor: "#BFDCD1",
                }}
              >
                {/* الأولوية */}
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "#64748B" }}>
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
                  />
                </div>

                {/* صافي بين */}
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "#64748B" }}>
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
                      borderColor: "#D0E2D5",
                      background: "#F5FBF8",
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
                      borderColor: "#D0E2D5",
                      background: "#F5FBF8",
                      boxShadow: "inset 0 1px 0 rgba(0,0,0,0.03)",
                    }}
                    title="حد أعلى"
                  />
                </div>

                {/* عدد البطاقات */}
                <div className="flex items-center gap-2">
                  <span className="text-sm" style={{ color: "#64748B" }}>
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

                {/* زر عرض / إخفاء */}
                <div className="ml-auto flex items-center gap-2">
                  {!showCards ? (
                    <button
                      onClick={() => setShowCards(true)}
                      className="h-10 px-5 rounded-full text-sm font-semibold border text-white shadow-sm"
                      style={{
                        background: "#10B981",
                        borderColor: "transparent",
                      }}
                      title="عرض البطاقات"
                    >
                      عرض
                    </button>
                  ) : (
                    <button
                      onClick={() => setShowCards(false)}
                      className="h-10 px-5 rounded-full text-sm font-semibold border bg-white hover:bg-black/5 transition"
                      style={{ borderColor: "#D0E2D5" }}
                      title="إخفاء البطاقات"
                    >
                      إخفاء البطاقات
                    </button>
                  )}
                </div>
              </div>

              <div className="mt-2 text-[12px]" style={{ color: "#64748B" }}>
                {showCards
                  ? "البطاقات معروضة."
                  : "اضغطي «عرض» لإظهار البطاقات بحسب الفئة."}
              </div>

              {/* بطاقات تفصيلية لسجلات الأدوية */}
              {showCards && (
                <div className="mt-6 grid grid-cols-1 gap-4 print:gap-2">
                  {firstLoadDone && !loading && cardRows.length === 0 ? (
                    <div
                      className="h-[140px] grid place-items-center text-neutral-600 text-sm rounded-2xl"
                      style={{
                        background: "#E7F8EF",
                        border: "1px solid #C6EAD7",
                      }}
                    >
                      لا توجد بيانات مطابقة — غيّري التاريخ أو البحث.
                    </div>
                  ) : (
                    cardRows.map((r, i) => (
                      // عند الضغط على البطاقة سيتم فتح الـ Viewer
                      <DrugCard
                        key={r.id ?? `${r.service_code}-${i}`}
                        row={r}
                        onOpen={() => setViewerRow(r)}
                      />
                    ))
                  )}
                </div>
              )}
            </>
          )}
          {viewerRow && (
            <DrugViewer row={viewerRow} onClose={() => setViewerRow(null)} />
          )}
        </main>
      </div>
    </div>
  );
}

/* ===================== Donut Card (Recharts) ===================== */

type DonutChartCardProps = {
  data: DonutSlice[];
  activeLabel?: string;
  onSelect?: (label: string) => void;
};

function DonutChartCard({ data, activeLabel, onSelect }: DonutChartCardProps) {
  const activeIdx =
    activeLabel != null
      ? data.findIndex((d) => d.label === (activeLabel || ""))
      : -1;

  return (
    <div className="grid grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] items-center gap-4">
      {/* legend */}
      <ul className="space-y-1.5">
        {data.length ? (
          data.slice(0, 6).map((s, i) => {
            const isActive = i === activeIdx;
            return (
              <li
                key={s.label}
                className={clsx(
                  "flex items-center gap-2 text-[13px] cursor-pointer select-none transition",
                  isActive && "scale-[1.02]"
                )}
                onClick={() => onSelect?.(s.label)}
                title={`${s.label} — ${s.value}%`}
              >
                <span
                  className="inline-block size-2.5 rounded-full ring-2"
                  style={{
                    backgroundColor: s.color,
                    boxShadow: isActive
                      ? "0 0 0 2px rgba(0,0,0,0.06)"
                      : undefined,
                  }}
                />
                <span
                  className={clsx(
                    "text-black/80 truncate",
                    isActive && "font-semibold"
                  )}
                >
                  {s.label.length > 28 ? s.label.slice(0, 27) + "…" : s.label}
                </span>
                <span className="ml-auto text-black/60">{s.value}%</span>
              </li>
            );
          })
        ) : (
          <li className="text-[13px] text-black/50">لا يوجد توزيع متاح.</li>
        )}
      </ul>

      {/* donut */}
      <div className="flex justify-center">
        <div style={{ width: 200, height: 200 }}>
          {data.length ? (
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="label"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  onClick={(e: any) => e && onSelect?.(e.label)}
                >
                  {data.map((entry, index) => {
                    const isActive = index === activeIdx;
                    return (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.color || "#22C55E"}
                        stroke="#ffffff"
                        strokeWidth={isActive ? 3 : 1.5}
                        fillOpacity={isActive ? 1 : 0.9}
                      />
                    );
                  })}
                </Pie>
                <RTooltip
                  wrapperStyle={{ zIndex: 50 }}
                  contentStyle={{
                    backgroundColor: "white",
                    borderRadius: 12,
                    boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                    border: "1px solid #E5E7EB",
                    padding: "8px 10px",
                    fontSize: 12,
                  }}
                  formatter={(value: any) => [`${value}%`, "نسبة الصرف"]}
                  labelFormatter={(label: any) => String(label)}
                />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="w-full h-full grid place-items-center text-[12px] text-neutral-500">
              لا توجد بيانات للشارت.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== Sub Components ===================== */

// نص بسطر واحد مع اتجاه مناسب
function ClipCell({ text }: { text: string }) {
  const t = typeof text === "string" ? text : "";
  const dir = /[A-Za-z]/.test(t) ? "ltr" : "rtl";
  return (
    <span
      dir={dir}
      title={t}
      style={{
        display: "inline-block",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        maxWidth: "100%",
        verticalAlign: "bottom",
        unicodeBidi: "plaintext",
      }}
    >
      {t || "—"}
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
      <label className="text-[11px] text-white/80 pr-1 block mb-1">
        {label}
      </label>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-10 w-full rounded-full text-white font-semibold px-4 flex items-center justify-between text-sm shadow-md transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
        style={{ backgroundColor: "rgba(0,0,0,0.18)" }}
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
        <div className="text-3xl leading-none font-extrabold tabular-nums drop-shadow-sm">
          {value}
        </div>
        <div className="mt-1 text-[1.02rem] font-semibold tracking-wide text-white/95">
          {title}
        </div>
      </div>
    </div>
  );
}
type NiceSelectOption = { value: string; label: string };

/* ====================== NiceSelect (محسّن) ====================== */
function NiceSelect({
  value,
  onChange,
  options,
  widthClass = "w-[160px]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // 🔹 نجيب اللابل العربي بناءً على القيمة
  const currentLabel = options.find((o) => o.value === value)?.label ?? value;

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  return (
    <div className={`relative ${widthClass}`} ref={ref}>
      {/* الزر */}
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-10 w-full bg-white border rounded-full px-4 text-sm font-medium flex items-center justify-between transition shadow-sm hover:bg-neutral-50"
        style={{
          borderColor: "#D9E6DF",
          color: "#0B3B3C",
        }}
      >
        {/* النص بالعربي */}
        <span className="truncate">{currentLabel}</span>

        {/* السهم – أضفنا stroke="currentColor" عشان يبان */}
        <svg
          className={`size-4 text-emerald-600 transition-transform ${
            open ? "rotate-180" : ""
          }`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {/* القائمة */}
      {open && (
        <ul
          className="absolute z-50 mt-2 w-full bg-white rounded-xl shadow-xl border overflow-hidden"
          style={{ borderColor: "#D9E6DF" }}
        >
          {options.map((o) => (
            <li key={o.value}>
              <button
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className={`w-full px-4 py-2 text-right text-sm flex items-center justify-between hover:bg-emerald-50 transition ${
                  value === o.value ? "bg-emerald-50 font-semibold" : ""
                }`}
                style={{ color: "#0B3B3C" }}
              >
                {o.label}
                {value === o.value && (
                  <span className="text-emerald-700 text-xs">●</span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* Search bar with suggestions – نفس تصميم التأميني لكن مخصص للأدوية */
function SearchBar(props: {
  q: string;
  setQ: (v: string) => void;
  suggestRef: React.RefObject<HTMLDivElement>;
  inputRef: React.RefObject<HTMLInputElement>;
  suggestItems: SuggestItem[]; // kind: "doctor" | "patient" | "drug" | "code" | "text"
  recent: string[];
  setRecent: (v: string[]) => void;
  onApplySuggestion: (s: SuggestItem) => void;
  onRunSearch: () => void;
  onShowAll: () => void;
  showSuggest: boolean;
  setShowSuggest: (b: boolean) => void;
  activeIdx: number;
  setActiveIdx: (n: number) => void;
}) {
  const {
    q,
    setQ,
    suggestRef,
    inputRef,
    suggestItems,
    recent,
    setRecent,
    onApplySuggestion,
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

  const apply = (s: SuggestItem) => {
    onApplySuggestion(s);
    requestAnimationFrame(() => inputRef.current?.blur());
    setShowSuggest(false);
  };

  return (
    <div className="mt-4 relative z-[70]" ref={suggestRef}>
      <div className="flex items-center gap-2">
        {/* مربع البحث */}
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
              setActiveIdx(0);
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
            placeholder="ابحث باسم الطبيب/المريض/الدواء/الكود/التاريخ…"
            aria-label="بحث موحّد في سجلات الأدوية"
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

          {/* قائمة الاقتراحات */}
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
                        <span className="text-[11px] text.black/60">
                          {s.kind === "doctor"
                            ? "doctor"
                            : s.kind === "patient"
                            ? "patient"
                            : s.kind === "drug"
                            ? "drug"
                            : s.kind === "code"
                            ? "code"
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

              {/* عمليات البحث السابقة */}
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
                          onApplySuggestion({ label: r, kind: "text" });
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

        {/* زر بحث */}
        <button
          onClick={onRunSearch}
          className="h-11 px-4 rounded-xl text-sm font-semibold shadow-md border text-white"
          style={{ background: "#36D399", borderColor: "transparent" }}
          title="بحث"
        >
          بحث
        </button>

        {/* زر عرض الكل */}
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
function DrugCard({ row, onOpen }: { row: DrugRow; onOpen?: () => void }) {
  return (
    // عند الضغط على الكرت يتم فتح الـ Viewer
    <div
      onClick={onOpen}
      className="shadow-sm print:shadow-none print:p-3 transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-lg relative overflow-hidden p-4 cursor-pointer"
      style={{
        background: "#F6FBF8",
        border: "1px solid #D7E7DF",
        borderRadius: 18,
      }}
    >
      {/* Badges أعلى الكرت */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {row.service_code && (
          <span className="px-3 py-1 text-xs rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100">
            الكود: {row.service_code}
          </span>
        )}
        {row.quantity != null && (
          <span className="px-3 py-1 text-xs rounded-full font-semibold bg-blue-50 text-blue-700 border border-blue-100">
            الكمية: {nfmt(row.quantity)}
          </span>
        )}
        {row.date && (
          <span className="px-3 py-1 text-xs rounded-full font-semibold bg-emerald-50 text-emerald-800 border border-emerald-100 flex items-center gap-1">
            <CalendarDays className="size-3.5" />
            {row.date}
          </span>
        )}
      </div>

      {/* تفاصيل أساسية */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <Field label="اسم الطبيب" value={row.doctor_name} />
        <Field label="اسم المريض" value={row.patient_name} />
        <Field
          label="وصف الخدمة/الدواء"
          value={row.service_description}
          full
          multiline
        />
        <Field label="سعر الوحدة" value={nfmt(row.item_unit_price)} />
        <Field label="الإجمالي" value={nfmt(row.gross_amount)} />
        <Field label="الضريبة" value={nfmt(row.vat_amount)} />
        <Field label="الخصم" value={nfmt(row.discount)} />
        <Field label="الصافي" value={nfmt(row.net_amount)} />
      </div>
    </div>
  );
}

/* ============================== Viewer ============================== */

function DrugViewer({ row, onClose }: { row: DrugRow; onClose: () => void }) {
  const badge = (txt: string, color: string) => (
    <span
      className="px-3 py-1 text-xs rounded-full font-semibold"
      style={{ background: `${color}15`, color }}
    >
      {txt}
    </span>
  );

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-[1px] flex items-start justify-center overflow-y-auto"
      onClick={onClose}
      dir="rtl"
    >
      {/* الكرت الرئيسي */}
      <div
        className="relative w-full max-w-5xl mx-auto mt-10 mb-10 bg-[#F5FBF8] border border-emerald-50 rounded-3xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* زر الإغلاق */}
        <button
          onClick={onClose}
          className="absolute top-4 left-4 h-9 w-9 rounded-full bg-white/90 border border-emerald-100 shadow-sm grid place-items-center hover:bg-emerald-50"
        >
          <X className="size-5 text-emerald-700" />
        </button>

        {/* الهيدر */}
        <div className="px-8 pt-7 pb-4 border-b border-emerald-50">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-center md:text-right">
              <div className="text-sm text-emerald-800/80 font-medium mb-1">
                تفاصيل صرف الدواء
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              {row.service_code &&
                badge(`الكود: ${row.service_code}`, "#0D16D1")}
              {row.quantity != null &&
                badge(`الكمية: ${nfmt(row.quantity)}`, "#2563EB")}
              {row.date && badge(row.date, "#065F46")}
            </div>
          </div>
        </div>

        {/* المحتوى – نفس إحساس التأميني */}
        <div className="px-8 py-7 space-y-5">
          {/* صف 1: المريض / الطبيب */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ViewerField label="اسم المريض" value={row.patient_name} />
            <ViewerField label="اسم الطبيب" value={row.doctor_name} />
          </div>

          {/* صف 2: التاريخ / الوصف */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ViewerField
              label="التاريخ"
              value={
                <div className="flex items-center gap-2">
                  <CalendarDays
                    className="size-4"
                    style={{ color: brand.green }}
                  />
                  <span className="tabular-nums">{row.date || "—"}</span>
                </div>
              }
            />

            <ViewerField
              label="وصف الخدمة/الدواء"
              value={row.service_description}
              full
              multiline
            />
          </div>

          {/* صف 3: أسعار أساسية */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ViewerField label="سعر الوحدة" value={nfmt(row.item_unit_price)} />
            <ViewerField label="الإجمالي" value={nfmt(row.gross_amount)} />
            <ViewerField label="الصافي" value={nfmt(row.net_amount)} />
          </div>

          {/* صف 4: ضريبة + خصم */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ViewerField label="الضريبة" value={nfmt(row.vat_amount)} />
            <ViewerField label="الخصم" value={nfmt(row.discount)} />
          </div>

          {/* ✅ خانة تحليل AI (الكرت الأخضر في الصورة) */}
          <div className="mt-4 rounded-[22px] bg-[#EAF9F1] border border-emerald-100 px-6 py-4 flex flex-col gap-2">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-emerald-900">
                  تحليل AI
                </span>
                <span className="px-3 py-0.5 text-[11px] rounded-full bg-emerald-100 text-emerald-800 font-medium">
                  تجريبي
                </span>
              </div>

              <div className="w-8 h-8 rounded-full bg-emerald-200/60 grid place-items-center">
                <Bot className="size-4 text-emerald-800" />
              </div>
            </div>

            <p className="text-[13px] text-emerald-900/80 leading-relaxed">
              {row.ai_analysis && row.ai_analysis.trim().length > 0
                ? row.ai_analysis
                : "No analysis yet — will be added by AI Agent."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* حقول عريضة ناعمة مثل التأميني */
function ViewerField({
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
      <div className="text-[12px] text-emerald-900/70 mb-1 pr-2">{label}</div>
      <div
        className={clsx(
          "w-full rounded-[999px] border px-5 py-3 text-sm flex items-center",
          multiline && "whitespace-pre-wrap leading-7"
        )}
        style={{
          background: "#F5FFFA",
          borderColor: "#D6EDE1",
          minHeight: multiline ? 56 : 48,
        }}
        title={typeof value === "string" ? value : undefined}
      >
        <span className="truncate">{value || "—"}</span>
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
