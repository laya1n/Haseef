// src/pages/Notifications.tsx
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
  BellRing,
  Bell,
  AlertTriangle,
  Info,
  Archive,
  CheckCircle2,
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
  Cell,
} from "recharts";

/* ===================== Theme (نفس التأمينية) ===================== */
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

const ui = {
  selectBg: "#FFFFFF",
  selectBorder: "#fae5d1ff",
  hint: "#6B7280",
  text: "#0B0F14",
  caret: "#14B8A6",
};

const aqua = { light: "#ed8585ff", mid: "#EF4444", dark: "#EF4444" };

/* helpers */
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
const stripOuterQuotes = (s: string) =>
  String(s ?? "")
    .replace(/^[\s"“”'‚‹›«»]+/, "")
    .replace(/[\s"“”'‚‹›«»]+$/, "");

/* ===================== Types ===================== */
type Kind = "طبي" | "تأمين" | "دواء";
type Severity = "طارئ" | "تنبيه" | "معلومة";

export type Noti = {
  id: string;
  title: string;
  body: string;
  kind: Kind;
  severity: Severity;
  time: string; // "YYYY-MM-DD HH:MM"
  read: boolean;
};

/* ===================== API ===================== */
const RAW_BASE = (import.meta as any).env?.VITE_API_BASE || "";
const API_BASE = String(RAW_BASE || "");
const USE_PROXY = !API_BASE;

const ENDPOINTS = {
  list: USE_PROXY ? "/api/notifications" : "/notifications",
  markAllRead: USE_PROXY
    ? "/api/notifications/mark-all-read"
    : "/notifications/mark-all-read",
  markRead: (id: string) =>
    (USE_PROXY ? "/api/notifications/" : "/notifications/") + id + "/mark-read",
  deleteAll: USE_PROXY ? "/api/notifications" : "/notifications",
  deleteOne: (id: string) =>
    (USE_PROXY ? "/api/notifications/" : "/notifications/") + id,
  stream: USE_PROXY ? "/api/notifications/stream" : "/notifications/stream",
};

const joinUrl = (b: string, p: string) =>
  b ? `${b.replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}` : p;

async function httpGet<T>(path: string) {
  const full = joinUrl(API_BASE, path);
  const url = new URL(full, window.location.origin);
  const r = await fetch(url.toString(), { credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  return (await r.json()) as T;
}

async function httpPost<T>(path: string, body?: unknown) {
  const full = joinUrl(API_BASE, path);
  const r = await fetch(full, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(await r.text());
  try {
    return (await r.json()) as T;
  } catch {
    return {} as T;
  }
}

async function httpDelete<T>(path: string) {
  const full = joinUrl(API_BASE, path);
  const r = await fetch(full, { method: "DELETE", credentials: "include" });
  if (!r.ok) throw new Error(await r.text());
  try {
    return (await r.json()) as T;
  } catch {
    return {} as T;
  }
}

/* ===================== Page ===================== */
type ChartMode = "severity" | "kind";

export default function Notifications() {
  const navigate = useNavigate();

  const [items, setItems] = useState<Noti[]>([]);
  const [loading, setLoading] = useState(true);
  const [firstLoadDone, setFirstLoadDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [filterKind, setFilterKind] = useState<"الكل" | Kind>("الكل");
  const [filterSev, setFilterSev] = useState<"الكل" | Severity>("الكل");
  const [showCards, setShowCards] = useState(true);

  const [chartMode, setChartMode] = useState<ChartMode>("severity");
  const [selectedLabel, setSelectedLabel] = useState<string>("");

  const [date, setDate] = useState<string>(""); // لواجهة المستخدم فقط حالياً

  const inputRef = useRef<HTMLInputElement>(null);
  const sseRef = useRef<EventSource | null>(null);

  /* أول تحميل + SSE */
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await httpGet<Noti[]>(ENDPOINTS.list);
        setItems(data || []);
      } catch (e: any) {
        setErr(e?.message || "تعذر تحميل الإشعارات");
      } finally {
        setLoading(false);
        setFirstLoadDone(true);
      }
    })();
  }, []);

  useEffect(() => {
    const url = joinUrl(API_BASE, ENDPOINTS.stream);
    try {
      const es = new EventSource(url);
      sseRef.current = es;
      es.onmessage = (evt) => {
        try {
          const n: Noti = JSON.parse(evt.data);
          setItems((prev) => {
            // لو موجود من قبل لا نكرره
            if (prev.find((p) => p.id === n.id)) return prev;
            return [n, ...prev];
          });
        } catch {
          /* ignore */
        }
      };
      es.onerror = () => {
        // ممكن لاحقاً نعمل retry
      };
    } catch {
      /* ignore */
    }
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, []);

  const unreadCount = items.filter((i) => !i.read).length;
  const totalCount = items.length;
  const criticalCount = items.filter((i) => i.severity === "طارئ").length;

  /* فلترة محلية */
  const filtered = useMemo(() => {
    return items.filter((n) => {
      const okKind = filterKind === "الكل" || n.kind === filterKind;
      const okSev = filterSev === "الكل" || n.severity === filterSev;
      const okQ =
        !q ||
        n.title.toLowerCase().includes(q.toLowerCase()) ||
        n.body.toLowerCase().includes(q.toLowerCase());
      return okKind && okSev && okQ;
    });
  }, [items, filterKind, filterSev, q]);

  /* بيانات الشارت */
  const chartData = useMemo(() => {
    const base = filtered.length ? filtered : items;
    const by: Record<string, number> = {};
    if (chartMode === "severity") {
      base.forEach((n) => {
        by[n.severity] = (by[n.severity] ?? 0) + 1;
      });
    } else {
      base.forEach((n) => {
        by[n.kind] = (by[n.kind] ?? 0) + 1;
      });
    }
    const entries = Object.entries(by).map(([label, count]) => ({
      label,
      count,
    }));
    // ترتيب ثابت جميل
    if (chartMode === "severity") {
      const order: Severity[] = ["طارئ", "تنبيه", "معلومة"];
      return entries.sort(
        (a, b) =>
          order.indexOf(a.label as Severity) -
          order.indexOf(b.label as Severity)
      );
    }
    return entries;
  }, [filtered, items, chartMode]);

  const yMeta = useMemo(() => {
    const max = chartData.reduce((m, c) => Math.max(m, c.count), 0);
    const step = max <= 5 ? 1 : max <= 15 ? 2 : 5;
    const top = Math.max(3, Math.ceil((max + step) / step) * step);
    const ticks: number[] = [];
    for (let v = 0; v <= top; v += step) ticks.push(v);
    return { ticks, top };
  }, [chartData]);

  const chartTitle =
    chartMode === "severity"
      ? "عدد الإشعارات حسب مستوى الأهمية"
      : "عدد الإشعارات حسب نوع السجل";

  /* أفعال */
  const markAllRead = async () => {
    const prev = items;
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    try {
      await httpPost(ENDPOINTS.markAllRead);
    } catch {
      setItems(prev);
    }
  };

  const toggleRead = async (id: string) => {
    const prev = items;
    const target = items.find((n) => n.id === id);
    const nextRead = !target?.read;
    setItems((arr) =>
      arr.map((n) => (n.id === id ? { ...n, read: nextRead } : n))
    );
    try {
      await httpPost(ENDPOINTS.markRead(id), { read: nextRead });
    } catch {
      setItems(prev);
    }
  };

  const deleteOne = async (id: string) => {
    const prev = items;
    setItems((arr) => arr.filter((n) => n.id !== id));
    try {
      await httpDelete(ENDPOINTS.deleteOne(id));
    } catch {
      setItems(prev);
    }
  };

  const deleteAll = async () => {
    const prev = items;
    setItems([]);
    try {
      await httpDelete(ENDPOINTS.deleteAll);
    } catch {
      setItems(prev);
    }
  };

  /* ===================== Render ===================== */
  return (
    <div className="min-h-screen" style={{ background: pageBg }}>
      <div className="grid grid-cols-[280px_1fr]">
        {/* Sidebar (نفس التأمينية مع تفعيل الإشعارات) */}
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
                active
                icon={<BellRing className="size-4" />}
                label="الإشعارات"
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
          {/* Header (نفس vibe التأمينية) */}
          <div
            className="relative z-50 rounded-2xl p-5 text-white shadow-soft"
            style={{ background: headerGrad }}
          >
            <button
              onClick={() => navigate("/home")}
              className="absolute top-3 left-3 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
              title="العودة للصفحة الرئيسية"
            >
              <Home className="size-5" style={{ color: theme.brandDark }} />
            </button>

            <div className="text-2xl md:text-3xl font-semibold">
              الإشعارات الذكية
            </div>
            <p className="mt-2 text-sm md:text-base text-white/80 max-w-xl">
              تنبيهات يتم توليدها تلقائيًا بواسطة{" "}
              <span className="font-semibold">حصيف</span> لمراقبة الأنماط
              الطبية، التأمينية والدوائية قبل وقوع الأخطاء والهدر.
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <SingleDateChip
                value={date}
                onChange={(d) => setDate(d)}
                onClear={() => setDate("")}
              />
            </div>

            {/* فلاتر صغيرة نوع + أهمية */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <NiceSelect
                value={filterKind}
                onChange={(v) => {
                  setFilterKind(v as any);
                  setSelectedLabel("");
                }}
                options={[
                  { value: "الكل", label: "كل الأنواع" },
                  { value: "طبي", label: "طبي" },
                  { value: "تأمين", label: "تأمين" },
                  { value: "دواء", label: "دواء" },
                ]}
                widthClass="w-[160px]"
              />
              <NiceSelect
                value={filterSev}
                onChange={(v) => {
                  setFilterSev(v as any);
                  setSelectedLabel("");
                }}
                options={[
                  { value: "الكل", label: "كل المستويات" },
                  { value: "طارئ", label: "طارئ" },
                  { value: "تنبيه", label: "تنبيه" },
                  { value: "معلومة", label: "معلومة" },
                ]}
                widthClass="w-[170px]"
              />
            </div>
          </div>

          {/* Error & skeleton */}
          {err && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <X className="size-4" /> <span className="text-sm">{err}</span>
            </div>
          )}
          {(!firstLoadDone || loading) && items.length === 0 ? (
            <div className="mt-6 grid gap-4">
              <div className="h-20 bg-white rounded-2xl animate-pulse" />
              <div className="h-80 bg-white rounded-2xl animate-pulse" />
              <div className="h-[320px] bg-white rounded-2xl animate-pulse" />
            </div>
          ) : null}

          {/* KPI Cards (نفس التأمينية لكن بأرقام الإشعارات) */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 relative z-0">
            <KpiCard
              title="إجمالي الإشعارات"
              value={totalCount}
              color="#3B82F6"
              icon={<Bell />}
            />
            <KpiCard
              title="التنبيهات الطارئة"
              value={criticalCount}
              color="#EF4444"
              icon={<AlertTriangle />}
            />
            <KpiCard
              title="الإشعارات غير المقروءة"
              value={unreadCount}
              color="#D97706"
              icon={<BellRing />}
            />
            <KpiCard
              title="الإشعارات المعلوماتية"
              value={items.filter((n) => n.severity === "معلومة").length}
              color="#0E9F6E"
              icon={<Info />}
            />
          </div>

          {/* Chart block */}
          <div
            className="mt-6 rounded-2xl bg-white shadow-soft p-5 border"
            style={{ borderColor: theme.border }}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <span className="font-semibold text-neutral-700">
                {chartTitle}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <button
                  onClick={() => setChartMode("severity")}
                  className={clsx(
                    "px-3 py-1 rounded-full border",
                    chartMode === "severity"
                      ? "bg-[#0E6B43] text-white border-transparent"
                      : "bg-white text-neutral-700 border-gray-300"
                  )}
                >
                  حسب الأهمية
                </button>
                <button
                  onClick={() => setChartMode("kind")}
                  className={clsx(
                    "px-3 py-1 rounded-full border",
                    chartMode === "kind"
                      ? "bg-[#0E6B43] text-white border-transparent"
                      : "bg-white text-neutral-700 border-gray-300"
                  )}
                >
                  حسب النوع
                </button>
                {selectedLabel && (
                  <button
                    className="px-3 py-1 rounded-full border text-xs hover:bg-black/5"
                    style={{ borderColor: theme.border }}
                    onClick={() => setSelectedLabel("")}
                  >
                    إلغاء التمييز
                  </button>
                )}
              </div>
            </div>

            <div style={{ width: "100%", height: 320, minWidth: 320 }}>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    margin={{ top: 10, right: 24, left: 8, bottom: 24 }}
                    barCategoryGap={40}
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
                        id="barGradNotif"
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
                      height={32}
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
                        maxWidth: 260,
                        whiteSpace: "pre-wrap",
                      }}
                      contentStyle={{
                        backgroundColor: "white",
                        borderRadius: 12,
                        boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
                        border: "1px solid #E5E7EB",
                      }}
                      formatter={(v: any) => [String(v), "عدد الإشعارات"]}
                      labelFormatter={(l: any) => `الفئة: ${String(l)}`}
                    />
                    <Bar dataKey="count" barSize={52} radius={[12, 12, 8, 8]}>
                      {chartData.map((d, i) => {
                        const active =
                          !selectedLabel || selectedLabel === d.label;
                        return (
                          <Cell
                            key={`cell-${i}`}
                            fill="url(#barGradNotif)"
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
                    لا توجد بيانات لعرضها.
                  </div>
                )
              )}
            </div>
          </div>

          {/* شريط التحكم في البطاقات */}
          <div
            className="mt-4 rounded-2xl p-4 shadow-soft flex flex-wrap items-center gap-3 border"
            style={{
              background: "#E6F7EF",
              borderColor: "#BFDCD1",
            }}
          >
            <span className="text-sm" style={{ color: ui.hint }}>
              عرض البطاقات التفصيلية
            </span>
            <button
              onClick={() => setShowCards((v) => !v)}
              className="h-10 px-5 rounded-full text-sm font-semibold border bg-white hover:bg-black/5 transition"
              style={{ borderColor: ui.selectBorder }}
            >
              {showCards ? "إخفاء البطاقات" : "عرض البطاقات"}
            </button>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={markAllRead}
                className="h-10 px-4 rounded-full bg-white border border-black/10 text-sm hover:bg-black/5"
              >
                تعليم الكل كمقروء
              </button>
              <button
                onClick={deleteAll}
                className="h-10 px-4 rounded-full bg-white border border-black/10 text-sm hover:bg-red-50"
              >
                مسح الكل
              </button>
            </div>
          </div>

          {/* Cards list */}
          {showCards && (
            <div className="mt-6 grid grid-cols-1 gap-4">
              {filtered.length === 0 && !loading ? (
                <div
                  className="h-[120px] grid place-items-center text-neutral-600 text-sm rounded-2xl"
                  style={{
                    background: "#E7F8EF",
                    border: "1px solid #C6EAD7",
                  }}
                >
                  لا توجد إشعارات مطابقة للمرشِّحات الحالية.
                </div>
              ) : (
                filtered.map((n) => (
                  <NotificationCard
                    key={n.id}
                    n={n}
                    onToggleRead={() => toggleRead(n.id)}
                    onDelete={() => deleteOne(n.id)}
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

/* Cute select (نفس ستايل التأمينية لكن أبسط قليلاً) */
function NiceSelect({
  value,
  onChange,
  options,
  widthClass = "w-[200px]",
}: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  widthClass?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

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
        className="h-9 w-full rounded-full border text-xs bg-white flex items-center justify-between px-3 hover:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-300 transition"
        style={{
          borderColor: ui.selectBorder,
          boxShadow: "inset 0 1px 0 rgba(0,0,0,0.03)",
          color: ui.text,
        }}
      >
        <span className="truncate text-right">
          {current?.label || "— الكل —"}
        </span>
        <span
          className="ml-2 w-5 h-5 rounded-full grid place-items-center text-[11px]"
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
          <div className="max-h-56 overflow-auto">
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

/* بطاقة إشعار واحدة */
function NotificationCard({
  n,
  onToggleRead,
  onDelete,
}: {
  n: Noti;
  onToggleRead: () => void;
  onDelete: () => void;
}) {
  const sevCfg: Record<Severity, { color: string; label: string }> = {
    طارئ: { color: "#EF4444", label: "طارئ" },
    تنبيه: { color: "#F59E0B", label: "تنبيه" },
    معلومة: { color: "#3B82F6", label: "معلومة" },
  };

  const kindLabel: Record<Kind, string> = {
    طبي: "سجل طبي",
    تأمين: "سجل تأميني",
    دواء: "صرف دواء",
  };

  const sev = sevCfg[n.severity];

  return (
    <div
      className={clsx(
        "shadow-sm transition-transform duration-150 hover:-translate-y-[2px] hover:shadow-lg relative overflow-hidden p-4 rounded-2xl bg-[#F6FBF8] border",
        !n.read && "border-[#0D16D1]/40"
      )}
      style={{
        borderColor: n.read ? "#D7E7DF" : "#0D16D1",
      }}
    >
      <div
        className="absolute right-0 top-0 h-full w-1.5"
        style={{ background: sev.color }}
      />

      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-full bg-white grid place-items-center shadow-sm border border-[#DDE8E2]">
          {n.severity === "طارئ" ? (
            <AlertTriangle className="size-4 text-red-500" />
          ) : n.severity === "تنبيه" ? (
            <BellRing className="size-4 text-amber-500" />
          ) : (
            <Info className="size-4 text-sky-500" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={clsx(
                "text-sm md:text-base font-semibold",
                !n.read && "text-[#0D16D1]"
              )}
            >
              {n.title}
            </span>
            <span
              className="px-3 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ background: `${sev.color}22`, color: sev.color }}
            >
              {sev.label}
            </span>
            <span className="px-2 py-0.5 rounded-full text-[11px] bg-emerald-50 text-emerald-800 border border-emerald-100">
              {kindLabel[n.kind]}
            </span>
            {!n.read && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-100">
                جديد
              </span>
            )}
          </div>

          <p className="mt-1 text-[13px] text-neutral-700 leading-6">
            {n.body}
          </p>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-black/50">
            <span>{n.time}</span>
            <span>•</span>
            <span>تم توليدها من حصيف</span>
          </div>
        </div>

        <div className="ms-auto flex flex-col gap-2 items-center">
          <ActionIcon
            icon={<CheckCircle2 className="size-4" />}
            tooltip={n.read ? "تعيين كغير مقروء" : "تعيين كمقروء"}
            color={n.read ? "default" : "blue"}
            onClick={onToggleRead}
          />
          <ActionIcon
            icon={<Archive className="size-4" />}
            tooltip="أرشفة (سلوك واجهة فقط)"
            onClick={onToggleRead}
          />
          <ActionIcon
            icon={<X className="size-4" />}
            tooltip="حذف الإشعار"
            color="red"
            onClick={onDelete}
          />
        </div>
      </div>
    </div>
  );
}

function ActionIcon({
  icon,
  onClick,
  tooltip,
  color = "default",
}: {
  icon: React.ReactNode;
  onClick?: () => void;
  tooltip?: string;
  color?: "default" | "blue" | "red";
}) {
  const base =
    "h-8 w-8 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm";
  const colors = {
    default: "border-black/10 bg-white text-black/70 hover:bg-black/5",
    blue: "border-transparent bg-[#E7E9FF] text-[#0D16D1] hover:bg-[#0D16D1] hover:text-white",
    red: "border-transparent bg-[#FEECEC] text-[#D11A2A] hover:bg-[#D11A2A] hover:text-white",
  };

  return (
    <button
      title={tooltip}
      onClick={onClick}
      className={`${base} ${colors[color]}`}
      style={{ lineHeight: 0 }}
    >
      <div className="flex items-center justify-center">{icon}</div>
    </button>
  );
}

/* نفس SingleDateChip من التأمينية مع إعادة استخدام */
function SingleDateChip({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
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
