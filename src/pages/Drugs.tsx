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
} from "lucide-react";
import clsx from "clsx";
import { apiGetDrugs, apiLogout } from "@/lib/api";

/* ====== AG Grid (مطابق للDashboard) ====== */
import { AgGridReact } from "ag-grid-react";
import type { ColDef, GetRowIdParams } from "ag-grid-community";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-quartz.css";
import { ModuleRegistry, AllCommunityModule } from "ag-grid-community";
ModuleRegistry.registerModules([AllCommunityModule]);

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
  top_drug: string;
  alerts_count: number;
  records: DrugRow[];
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

/* ============================== SVG Donut Utils ============================== */
type DonutSlice = { label: string; value: number; color?: string };
const polar = (cx: number, cy: number, r: number, angle: number) => ({
  x: cx + r * Math.cos(angle),
  y: cy + r * Math.sin(angle),
});
const arcPath = (
  cx: number,
  cy: number,
  rOuter: number,
  rInner: number,
  startAngle: number,
  endAngle: number
) => {
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  const p1 = polar(cx, cy, rOuter, startAngle);
  const p2 = polar(cx, cy, rOuter, endAngle);
  const p3 = polar(cx, cy, rInner, endAngle);
  const p4 = polar(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
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
  const [selDate, setSelDate] = useState<string>("الكل"); // "الكل" | "الأسبوع الأخير"
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selDrug, setSelDrug] = useState<string>("الكل");
  const [q, setQ] = useState("");
  const [qKey, setQKey] = useState(""); // Debounce

  // Viewer
  const [viewRow, setViewRow] = useState<DrugRow | null>(null);
  const [showViewer, setShowViewer] = useState(false);
  const openViewer = (r: DrugRow) => {
    setViewRow(r);
    setShowViewer(true);
  };
  const closeViewer = () => {
    setShowViewer(false);
    setViewRow(null);
  };

  // Debounce للبحث
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
      "#4C4DE9",
      "#0D16D1",
      "#9AA0FF",
      "#CDEFE3",
      "#6FE38A",
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
  }, [filteredNoDrug]);

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

  const pageBg =
    "linear-gradient(180deg,#F5F7FB 0%,#E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,.15), transparent 60%)";

  /* ===================== أعمدة الجدول (مبسّطة وواضحة) ===================== */
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
          {/* زر العودة */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
            title="العودة للصفحة الرئيسية"
            aria-label="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          {/* Header + أدوات */}
          <div className="flex items-center justify-between gap-4 mt-2">
            <div
              className="text-xl md:text-2xl font-semibold"
              style={{ color: brand.green }}
            >
              سجلات الأدوية
            </div>

            <div className="flex items-end gap-3 flex-wrap">
              {/* search */}
              <div className="relative w-[320px] max-w-[45vw]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                  placeholder="ابحث باسم الطبيب/المريض/الدواء/الكود/التاريخ…"
                  aria-label="بحث في سجلات الأدوية"
                />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
              </div>

              {/* filters */}
              <Dropdown
                label="الدواء"
                value={selDrug}
                onChange={setSelDrug}
                options={["الكل", ...drugs]}
              />
              {selDrug !== "الكل" && (
                <button
                  onClick={() => setSelDrug("الكل")}
                  className="h-10 px-3 rounded-full bg-white border text-sm flex items-center gap-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <X className="size-4" /> مسح
                </button>
              )}

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

              <Dropdown
                label="التاريخ"
                value={selDate}
                onChange={setSelDate}
                options={["الكل", "الأسبوع الأخير"]}
              />
              {selDate !== "الكل" && (
                <button
                  onClick={() => setSelDate("الكل")}
                  className="h-10 px-3 rounded-full bg-white border text-sm flex items-center gap-1 hover:bg-black/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
                >
                  <X className="size-4" /> مسح التاريخ
                </button>
              )}
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Skeleton */}
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
              <div className="mt-6 grid grid-cols-1 xl:grid-cols-[0.9fr_1.1fr] gap-5">
                {/* AI */}
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
                        "اضغطي «تشغيل» لتحليل أنماط صرف الأدوية وفق الفلاتر الحالية."}
                    </p>
                  </div>
                </div>

                {/* Donut تفاعلية — بدون نص علوي */}
                <div className="rounded-2xl bg-white shadow-soft p-5">
                  <div className="mb-3 font-semibold text-neutral-700">
                    نسبة الصرف حسب الدواء
                  </div>
                  <InteractiveDonut
                    data={donut}
                    onSliceClick={(label) =>
                      setSelDrug((curr) =>
                        normalize(curr) === normalize(label) ? "الكل" : label
                      )
                    }
                    activeLabel={selDrug !== "الكل" ? selDrug : undefined}
                  />
                </div>
              </div>

              {/* جدول */}
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
                    <AgGridReact<DrugRow>
                      rowData={filtered ?? []}
                      columnDefs={colDefs}
                      getRowId={(p: GetRowIdParams<DrugRow>) =>
                        String(
                          p.data?.id ?? `${p.data?.service_code}-${p.rowIndex}`
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
                <DrugViewer row={viewRow} onClose={closeViewer} />
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}

/* ===================== Donut Component (SVG تفاعلية) ===================== */
function InteractiveDonut({
  data,
  onSliceClick,
  activeLabel,
  size = 200,
  thickness = 34,
}: {
  data: DonutSlice[];
  onSliceClick?: (label: string) => void;
  activeLabel?: string;
  size?: number;
  thickness?: number;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const [centerHover, setCenterHover] = useState<{ value: number } | null>(
    null
  );

  const total = Math.max(
    1,
    data.reduce((s, d) => s + d.value, 0)
  );
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = size / 2;
  const rInner = rOuter - thickness;

  let acc = -Math.PI / 2; // من الأعلى
  const segments = data.map((d, i) => {
    const angle = (d.value / total) * Math.PI * 2;
    const start = acc;
    const end = acc + angle;
    acc = end;
    return { ...d, start, end, idx: i };
  });

  const activeIdx = activeLabel
    ? segments.find((s) => normalize(s.label) === normalize(activeLabel))
        ?.idx ?? null
    : null;

  const show =
    hoverIdx != null
      ? segments[hoverIdx]
      : activeIdx != null
      ? segments[activeIdx]
      : null;

  useEffect(() => {
    if (show) setCenterHover({ value: Math.round(show.value) });
    else if (data[0]) setCenterHover({ value: Math.round(data[0].value) });
    else setCenterHover(null);
  }, [hoverIdx, activeIdx, data]); // eslint-disable-line

  const single = data.length <= 1;

  return (
    <div className="grid grid-cols-[1fr_1fr] items-center gap-4">
      {/* legend (قابل للنقر والهوفر) */}
      <ul className={clsx("space-y-1.5", single && "hidden")}>
        {(data.slice(0, 6) ?? []).map((s, i) => {
          const isActive = activeIdx === i;
          const isHover = hoverIdx === i;
          return (
            <li
              key={s.label}
              className={clsx(
                "flex items-center gap-2 text-[13px] cursor-pointer select-none transition",
                isActive || isHover ? "scale-[1.02]" : ""
              )}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}
              onClick={() => onSliceClick?.(s.label)}
              title={`${s.label} — ${s.value}%`}
            >
              <span
                className="inline-block size-2.5 rounded-full ring-2"
                style={{
                  backgroundColor: s.color,
                  boxShadow:
                    isActive || isHover
                      ? "0 0 0 2px rgba(0,0,0,0.06)"
                      : undefined,
                }}
              />
              <span
                className="text-black/80"
                dir={isLatin(s.label) ? "ltr" : "rtl"}
                style={{ unicodeBidi: "plaintext" }}
              >
                {s.label.length > 28 ? s.label.slice(0, 27) + "…" : s.label}
              </span>
              <span className="ml-auto text-black/60">{s.value}%</span>
            </li>
          );
        })}
        {!data.length && (
          <li className="text-[13px] text-black/50">لا يوجد توزيع متاح.</li>
        )}
      </ul>

      {/* donut SVG */}
      <div className="flex justify-center">
        <div className="relative" style={{ width: size, height: size }}>
          <svg width={size} height={size} role="img" aria-label="Donut chart">
            {segments.map((s, i) => {
              const hover = hoverIdx === i;
              const active = activeIdx === i;
              const grow = hover || active ? 4 : 0;
              const path = arcPath(
                cx,
                cy,
                rOuter + grow,
                rInner,
                s.start,
                s.end
              );
              return (
                <path
                  key={s.label}
                  d={path}
                  fill={s.color}
                  opacity={hover ? 1 : active ? 0.95 : 0.9}
                  stroke="white"
                  strokeWidth={2}
                  style={{ cursor: "pointer", transition: "all .18s ease" }}
                  onMouseEnter={() => setHoverIdx(i)}
                  onMouseLeave={() => setHoverIdx((h) => (h === i ? null : h))}
                  onClick={() => onSliceClick?.(s.label)}
                />
              );
            })}
            {/* حلقة داخلية */}
            <circle cx={cx} cy={cy} r={rInner - 1} fill="white" />
          </svg>

          {/* مركز الدونات — نسبة فقط */}
          {centerHover && (
            <div className="absolute inset-0 grid place-items-center text-center px-4 pointer-events-none">
              <div
                className="text-[22px] font-semibold tabular-nums"
                style={{ color: brand.secondary }}
              >
                {centerHover.value}%
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ===================== Sub Components ===================== */

// نص بسطـر واحد مع اتجاه مناسب
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

/* ============================== Viewer ============================== */
function DrugViewer({ row, onClose }: { row: DrugRow; onClose: () => void }) {
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
            تفاصيل صرف الدواء
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
          <div className="flex flex-wrap items-center gap-2">
            {row.service_code && badge(`الكود: ${row.service_code}`, "#0D16D1")}
            {row.quantity != null &&
              badge(`الكمية: ${nfmt(row.quantity)}`, "#2563EB")}
            {row.date && badge(`${row.date}`, "#065F46")}
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
                  <span className="tabular-nums">{row.date || "—"}</span>
                </div>
              }
            />

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
