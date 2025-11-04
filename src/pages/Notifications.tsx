// src/pages/Notifications.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserRound,
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
} from "lucide-react";
import clsx from "clsx";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/* ======================== Types ======================== */
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

/* ======================== API Helpers ======================== */
/** عدّل هذا المتغير أو استخدم proxy في devServer */
const API_BASE = import.meta.env.VITE_API_BASE ?? "";

// REST endpoints المقترحة:
// GET    /api/notifications?kind=&severity=&q=
// POST   /api/notifications/:id/mark-read {read:boolean}
// DELETE /api/notifications/:id
// POST   /api/notifications/mark-all-read
// DELETE /api/notifications           (clear all)
// SSE    /api/notifications/stream

async function apiGet(path: string) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
async function apiPost(path: string, body?: any) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => ({}));
}
async function apiDelete(path: string) {
  const res = await fetch(`${API_BASE}${path}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return res.json().catch(() => ({}));
}

/* ======================== Page ======================== */
export default function Notifications() {
  const navigate = useNavigate();

  // بيانات حقيقية من API (بدون seed)
  const [items, setItems] = useState<Noti[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [q, setQ] = useState("");
  const [filterKind, setFilterKind] = useState<"الكل" | Kind>("الكل");
  const [filterSev, setFilterSev] = useState<"الكل" | Severity>("الكل");
  const [tab, setTab] = useState<"كل الإشعارات" | "غير المقروءة" | "المحفوظة">(
    "كل الإشعارات"
  );

  // تحميل أولي
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const data: Noti[] = await apiGet(
          `/api/notifications?kind=${encodeURIComponent(
            filterKind === "الكل" ? "" : filterKind
          )}&severity=${encodeURIComponent(
            filterSev === "الكل" ? "" : filterSev
          )}&q=${encodeURIComponent(q)}`
        );
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
    // مبدئيًا نجلب عند فتح الصفحة فقط. لو رغبت: أضف [q, filterKind, filterSev]
    // لعمل فلترة على الخادم.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE للاشعارات الفورية من الـAI
  const sseRef = useRef<EventSource | null>(null);
  useEffect(() => {
    const url = `${API_BASE}/api/notifications/stream`;
    try {
      const es = new EventSource(url);
      sseRef.current = es;
      es.onmessage = (evt) => {
        try {
          const n: Noti = JSON.parse(evt.data);
          // ادراج تفاؤلي أعلى القائمة
          setItems((prev) => [n, ...prev]);
        } catch {}
      };
      es.onerror = () => {
        // يمكن إعادة المحاولة تلقائيًا حسب حاجتك
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

  /* -------- Actions (Optimistic) -------- */
  const markAllRead = async () => {
    const prev = items;
    setItems((arr) => arr.map((n) => ({ ...n, read: true })));
    try {
      await apiPost("/api/notifications/mark-all-read");
    } catch {
      setItems(prev); // rollback
    }
  };

  const clearAll = async () => {
    const prev = items;
    setItems([]);
    try {
      await apiDelete("/api/notifications");
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
      await apiPost(`/api/notifications/${id}/mark-read`, { read: nextRead });
    } catch {
      setItems(prev);
    }
  };

  const removeOne = async (id: string) => {
    const prev = items;
    setItems((arr) => arr.filter((n) => n.id !== id));
    try {
      await apiDelete(`/api/notifications/${id}`);
    } catch {
      setItems(prev);
    }
  };

  return (
    <div className="min-h-screen bg-[#EEF1F8]">
      <div className="grid grid-cols-[300px_1fr]">
        {/* Sidebar */}
        <aside
          className="min-h-screen border-l bg-white sticky top-0"
          dir="rtl"
        >
          <div className="p-6 pb-4 flex items-center justify-between">
            <div className="text-2xl font-semibold">الشعار</div>
            <UserRound className="size-6 text-black/70" />
          </div>

          <nav className="px-4 space-y-2">
            <SideItem
              icon={<Plus className="size-4" />}
              label="طب"
              onClick={() => navigate("/dashboard")}
            />
            <SideItem
              icon={<Shield className="size-4" />}
              label="التأمين"
              onClick={() => navigate("/insurance")}
            />
            <SideItem
              icon={<Pill className="size-4" />}
              label="دواء"
              onClick={() => navigate("/drugs")}
            />
            <SideItem
              active
              icon={<BellRing className="size-4" />}
              label="إشعارات"
              onClick={() => {}}
            />
            <SideItem
              icon={<MessageSquareCode className="size-4" />}
              label="مساعد ذكي"
              onClick={() => navigate("/chat")}
            />
          </nav>

          <div className="mt-auto px-4 pt-10 pb-6">
            <button
              onClick={() => {
                localStorage.removeItem("haseef_auth");
                navigate("/login");
              }}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl md:text-2xl font-semibold">الإشعارات</h1>
              <span className="inline-flex items-center rounded-full bg-[#E7F3FF] text-[#0D16D1] text-xs px-2 py-0.5">
                غير المقروءة: {unreadCount}
              </span>
            </div>

            {/* Search */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50"
                placeholder="ابحث في الإشعارات…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>
          </div>

          {/* Tabs */}
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

          {/* Filters row */}
          <div className="mt-4 flex items-end gap-2">
            <FilterSelect
              label="النوع"
              value={filterKind}
              onChange={setFilterKind}
              options={["الكل", "طبي", "تأمين", "دواء"]}
              placeholder="نوع الإشعار"
            />
            <FilterSelect
              label="الأهمية"
              value={filterSev}
              onChange={setFilterSev}
              options={["الكل", "طارئ", "تنبيه", "معلومة"]}
              placeholder="مستوى الأهمية"
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

          {/* List */}
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

                        {/* Actions */}
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

/* ======================== Small components ======================== */
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
      style={active ? { backgroundColor: "#97FC4A" } : {}}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options,
  placeholder,
  id,
  minWidth = "min-w-[10rem]",
}: {
  label: string;
  value: string;
  onChange: (v: any) => void;
  options: string[];
  placeholder: string;
  id?: string;
  minWidth?: string;
}) {
  const selectId = id ?? `select-${label}`;
  return (
    <div className={clsx("flex flex-col gap-1", minWidth)}>
      <label htmlFor={selectId} className="text-xs text-black/60 pr-1">
        {label}
      </label>

      <div className="relative inline-block w-full">
        <select
          id={selectId}
          dir="rtl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            pr-9 h-10 w-full
            rounded-2xl border border-black/10 shadow-md
            text-sm
            bg-[#0F6B46] text-white
            hover:brightness-95
            focus:outline-none focus:ring-4 focus:ring-emerald-300/30
            [appearance:none] [-moz-appearance:none] [-webkit-appearance:none]
          "
        >
          <option hidden>{placeholder}</option>
          {options.map((opt) => (
            <option key={opt} value={opt} className="bg-white text-black">
              {opt}
            </option>
          ))}
        </select>
      </div>
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
