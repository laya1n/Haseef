// src/pages/Notifications.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
  Bell,
  Plus,
  Shield,
  Pill,
  BellRing,
  MessageSquareCode,
  LogOut,
  Search,
  CheckCircle2,
  AlertTriangle,
  Info,
  X,
  Archive,
  Home,
} from "lucide-react";
import clsx from "clsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ============================== الهوية البصرية (مطابقة للداشبورد) ============================== */
const brand = {
  green: "#0E6B43",
  greenHover: "#0f7d4d",
  accent: "#97FC4A",
  secondary: "#0D16D1",
};

/* ============================== الأنواع ============================== */
type Kind = "طبي" | "تأمين" | "دواء";
type Severity = "طارئ" | "تنبيه" | "معلومة";

export type Noti = {
  id: string;
  title: string;
  body: string;
  kind: Kind;
  severity: Severity;
  time: string; // "HH:mm" أو ISO
  read: boolean;
};

/* ============================== إعدادات API (مطابقة لطريقة Dashboard) ============================== */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

function buildUrl(path: string, params?: Record<string, string | undefined>) {
  const url = new URL(BASE_URL + path || path, window.location.origin);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v && v !== "الكل") url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function httpGet<T>(path: string, params?: Record<string, string>) {
  const res = await fetch(buildUrl(path, params), { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function httpPost<T>(path: string, body?: unknown) {
  const res = await fetch(BASE_URL + path || path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  // قد لا يعيد الخادم JSON دائمًا
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

async function httpDelete<T>(path: string) {
  const res = await fetch(BASE_URL + path || path, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

/* ============================== الصفحة ============================== */
export default function Notifications() {
  const navigate = useNavigate();

  // بيانات
  const [items, setItems] = useState<Noti[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // واجهة
  const [q, setQ] = useState("");
  const [filterKind, setFilterKind] = useState<"الكل" | Kind>("الكل");
  const [filterSev, setFilterSev] = useState<"الكل" | Severity>("الكل");
  const [tab, setTab] = useState<"كل الإشعارات" | "غير المقروءة" | "المحفوظة">(
    "كل الإشعارات"
  );

  // تحميل أولي بنفس الأسلوب
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await httpGet<Noti[]>("/api/notifications", {
          kind: filterKind,
          severity: filterSev,
          q,
        });
        if (mounted) setItems(data);
      } catch (e: any) {
        if (mounted) setError(e?.message ?? "فشل جلب الإشعارات");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
    // نجلب مرة واحدة مبدئيًا (يمكن لاحقًا ربط الفلاتر بالخادم)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE للبث الفوري
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const url = BASE_URL
      ? BASE_URL + "/api/notifications/stream"
      : "/api/notifications/stream";
    try {
      const es = new EventSource(url);
      sseRef.current = es;
      es.onmessage = (evt) => {
        try {
          const n: Noti = JSON.parse(evt.data);
          setItems((prev) => [n, ...prev]);
        } catch {}
      };
      es.onerror = () => {
        // يمكن إضافة إعادة محاولة بعد فترة
      };
    } catch {}
    return () => {
      sseRef.current?.close();
      sseRef.current = null;
    };
  }, []);

  const unreadCount = items.filter((i) => !i.read).length;

  const filtered = useMemo(() => {
    return items.filter((n) => {
      const okQ =
        !q ||
        n.title.toLowerCase().includes(q.toLowerCase()) ||
        n.body.toLowerCase().includes(q.toLowerCase());
      const okKind = filterKind === "الكل" || n.kind === filterKind;
      const okSev = filterSev === "الكل" || n.severity === filterSev;
      const okTab =
        tab === "كل الإشعارات" ||
        (tab === "غير المقروءة" && !n.read) ||
        (tab === "المحفوظة" && n.read); // مؤقتًا: اعتبر المقروءة محفوظة
      return okQ && okKind && okSev && okTab;
    });
  }, [items, q, filterKind, filterSev, tab]);

  /* -------- إجراءات متفائلة (مطابقة أسلوب الداشبورد) -------- */
  const markAllRead = async () => {
    const prev = items;
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    try {
      await httpPost("/api/notifications/mark-all-read");
    } catch {
      setItems(prev);
    }
  };

  const clearAll = async () => {
    const prev = items;
    setItems([]);
    try {
      await httpDelete("/api/notifications");
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
      await httpPost(`/api/notifications/${id}/mark-read`, { read: nextRead });
    } catch {
      setItems(prev);
    }
  };

  const removeOne = async (id: string) => {
    const prev = items;
    setItems((arr) => arr.filter((n) => n.id !== id));
    try {
      await httpDelete(`/api/notifications/${id}`);
    } catch {
      setItems(prev);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, #F5F7FB 0%, #E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,0.15), transparent 60%)",
      }}
    >
      <div className="grid grid-cols-[280px_1fr]">
        {/* Sidebar — مطابق للداشبورد */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
          {/* الشعار في الزاوية العلوية اليمنى */}
          <div className="absolute top-4 right-4">
            <img
              src={logo}
              alt="شعار حصيف الذكي"
              className="w-10 md:w-12 drop-shadow-sm select-none"
            />
          </div>

          {/* محتوى القائمة */}
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
                icon={<Pill className="size-4" />}
                label="سجلات الأدوية"
                onClick={() => navigate("/drugs")}
              />
              <SideItem
                active
                icon={<BellRing className="size-4" />}
                label="الاشعارات"
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
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* زر الرجوع للهوم — نفس الشكل والألوان */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-3 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition"
            title="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 mt-3">
            <div className="flex items-center gap-3">
              <h1
                className="text-xl md:text-2xl font-semibold"
                style={{ color: brand.green }}
              >
                الإشعارات
              </h1>
              <span className="inline-flex items-center rounded-full bg-[#E7F3FF] text-[#0D16D1] text-xs px-2 py-0.5">
                غير المقروءة: {unreadCount}
              </span>
            </div>

            {/* Search — نفس مدخل البحث */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50 focus:ring-4 focus:ring-emerald-300/30"
                placeholder="ابحث في الإشعارات…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>
          </div>

          {/* Tabs — بنفس أسلوب الأزرار الملوّنة */}
          <div className="mt-4 flex flex-wrap gap-2">
            {(["كل الإشعارات", "غير المقروءة", "المحفوظة"] as const).map(
              (t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={clsx(
                    "h-9 px-4 rounded-full text-sm border transition",
                    tab === t
                      ? "bg-[#4C4DE9] text-white border-transparent"
                      : "bg-white text-neutral-800 border-black/10 hover:bg-black/5"
                  )}
                >
                  {t}
                </button>
              )
            )}
          </div>

          {/* فلاتر — أزرار/قوائم خضراء بنفس هوية الداشبورد */}
          <div className="mt-4 flex items-end gap-2">
            <Dropdown
              label="النوع"
              value={filterKind}
              onChange={(v) => setFilterKind(v as any)}
              options={["الكل", "طبي", "تأمين", "دواء"]}
            />
            <Dropdown
              label="الأهمية"
              value={filterSev}
              onChange={(v) => setFilterSev(v as any)}
              options={["الكل", "طارئ", "تنبيه", "معلومة"]}
            />

            <div className="ms-auto flex items-center gap-2">
              <button
                onClick={markAllRead}
                className="h-10 px-4 rounded-full bg-white border border-black/10 text-sm hover:bg-black/5"
              >
                تعليم الكل كمقروء
              </button>
              <button
                onClick={clearAll}
                className="h-10 px-4 rounded-full bg-white border border-black/10 text-sm hover:bg-red-50"
              >
                مسح الكل
              </button>
            </div>
          </div>

          {/* القائمة */}
          <Card className="mt-5 shadow-soft">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">قائمة الإشعارات</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              {loading ? (
                <div className="p-8 text-center text-black/60">
                  جارِ التحميل…
                </div>
              ) : error ? (
                <div className="p-8 text-center text-red-600">
                  حدث خطأ: {error}
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center text-black/60">
                  لا توجد إشعارات مطابقة.
                </div>
              ) : (
                <ul className="divide-y divide-black/5">
                  {filtered.map((n) => (
                    <li
                      key={n.id}
                      className={clsx(
                        "py-3 px-2 md:px-3",
                        !n.read && "bg-[#F7F8FF]"
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <KindIcon kind={n.kind} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={clsx(
                                "text-sm md:text-base font-semibold",
                                !n.read && "text-[#0D16D1]"
                              )}
                            >
                              {n.title}
                            </span>
                            <SeverityBadge s={n.severity} />
                          </div>
                          <p className="mt-1 text-sm text-black/70 line-clamp-2">
                            {n.body}
                          </p>

                          <div className="mt-2 flex items-center gap-2 text-xs text-black/50">
                            <span>{n.time}</span>
                            <span>•</span>
                            <span>{n.kind}</span>
                          </div>
                        </div>

                        {/* إجراءات */}
                        <div className="ms-auto flex items-center gap-2">
                          <ActionIcon
                            icon={<CheckCircle2 className="size-4" />}
                            tooltip={
                              n.read ? "تعيين كغير مقروء" : "تعيين كمقروء"
                            }
                            onClick={() => toggleRead(n.id)}
                            color={n.read ? "default" : "blue"}
                          />
                          <ActionIcon
                            icon={<Archive className="size-4" />}
                            tooltip="أرشفة"
                            onClick={() => toggleRead(n.id)}
                          />
                          <ActionIcon
                            icon={<X className="size-4" />}
                            tooltip="حذف"
                            onClick={() => removeOne(n.id)}
                            color="red"
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

/* ============================== مكوّنات صغيرة (مطابقة لنمط الداشبورد) ============================== */

// عنصر القائمة الجانبية
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
        "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors",
        active ? "text-[#0D16D1] border border-black/10" : "hover:bg-black/5"
      )}
      style={active ? { backgroundColor: brand.accent } : {}}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

// Dropdown الأخضر (نفس شكل الداشبورد)
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
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="relative min-w-[8rem]" ref={ref}>
      <label className="text-xs text-black/60 pr-1 block mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((s) => !s)}
        className="h-10 w-full rounded-full bg-[#0E6B43] text-white font-semibold px-4 flex items-center justify-between text-sm shadow-md hover:bg-[#0f7d4d] transition"
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
        <ul className="absolute mt-2 w-full bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden z-50">
          {options.map((opt) => (
            <li key={opt}>
              <button
                type="button"
                onClick={() => {
                  onChange(opt);
                  setOpen(false);
                }}
                className={clsx(
                  "w-full text-right px-4 py-2 text-sm hover:bg-emerald-50",
                  value === opt && "bg-emerald-50 font-semibold text-[#0E6B43]"
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

function SeverityBadge({ s }: { s: Severity }) {
  const cfg: Record<Severity, { bg: string; text: string; Icon: any }> = {
    طارئ: { bg: "bg-red-100 text-red-700", text: "طارئ", Icon: AlertTriangle },
    تنبيه: { bg: "bg-amber-100 text-amber-700", text: "تنبيه", Icon: Bell },
    معلومة: { bg: "bg-blue-100 text-blue-700", text: "معلومة", Icon: Info },
  };
  const { bg, text, Icon } = cfg[s];
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs",
        bg
      )}
    >
      <Icon className="size-3.5" />
      {text}
    </span>
  );
}

function KindIcon({ kind }: { kind: Kind }) {
  const map: Record<Kind, { bg: string; Icon: any }> = {
    طبي: { bg: "bg-indigo-100 text-indigo-700", Icon: Plus },
    تأمين: { bg: "bg-emerald-100 text-emerald-700", Icon: Shield },
    دواء: { bg: "bg-violet-100 text-violet-700", Icon: Pill },
  };
  const { bg, Icon } = map[kind];
  return (
    <div
      className={clsx(
        "size-9 rounded-full grid place-items-center shrink-0",
        bg
      )}
    >
      <Icon className="size-4" />
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
    "h-9 w-9 flex items-center justify-center rounded-full border transition-all duration-200 shadow-sm";
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
