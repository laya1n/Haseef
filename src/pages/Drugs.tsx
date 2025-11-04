// src/pages/Drugs.tsx
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  UserRound,
  Bot,
  Plus,
  Shield,
  Pill,
  BellRing,
  MessageSquareCode,
  LogOut,
  Search,
  Loader2,
  TriangleAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import clsx from "clsx";

/* ============================== Types ============================== */
type RxRow = {
  id: number;
  doctor: string;
  diagnosis: string;
  drug: string;
  date: string; // ISO أو DD-MM-YYYY
  note: string;
};

type DonutSlice = {
  label: string; // اسم الدواء
  value: number; // نسبة مئوية (يشترط مجموع ~ 100)
  color?: string; // اختياري: إن لم يُرسل سنولّد ألوان افتراضية
};

type ListResponse = {
  items: RxRow[];
  doctors?: string[];
  drugs?: string[];
};

type DonutResponse = {
  distribution: DonutSlice[]; // e.g. [{label:"Amoxicillin",value:65}, ...]
};

type AiInsight = { message: string; sourceTag?: string };

/* ============================== API config ============================== */
// ضعي الدومين في .env إذا كان خارجيًا:  VITE_API_BASE_URL=https://api.example.com
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

const ENDPOINTS = {
  list: "/api/drugs/list",
  donut: "/api/drugs/distribution",
  analyze: "/api/ai/drugs/analyze",
};

async function httpGet<T>(path: string, params?: Record<string, string>) {
  const url = new URL(BASE_URL + path || path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v && v !== "الكل") url.searchParams.set(k, v);
    });
  }
  const res = await fetch(url.toString(), { credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

async function httpPost<T>(path: string, body: unknown) {
  const res = await fetch(BASE_URL + path || path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

/* ============================== Page ============================== */
export default function Drugs() {
  const navigate = useNavigate();

  // بيانات
  const [rows, setRows] = useState<RxRow[]>([]);
  const [donut, setDonut] = useState<DonutSlice[]>([]);
  const [doctors, setDoctors] = useState<string[]>([]);
  const [drugs, setDrugs] = useState<string[]>([]);

  // واجهة
  const [loading, setLoading] = useState(false);
  const [loadingDonut, setLoadingDonut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI
  const [aiMsg, setAiMsg] = useState<string | null>(null);
  const [aiSource, setAiSource] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // فلاتر/بحث
  const [selDate, setSelDate] = useState<string>("الكل");
  const [selDoctor, setSelDoctor] = useState<string>("الكل");
  const [selDrug, setSelDrug] = useState<string>("الكل");
  const [q, setQ] = useState("");

  // تحميل السجلات + القوائم بحسب الفلاتر
  useEffect(() => {
    let cancel = false;
    async function load() {
      try {
        setError(null);
        setLoading(true);
        setAiMsg(null); // توحيد سلوك الرسائل مثل صفحة التأمين
        const data = await httpGet<ListResponse>(ENDPOINTS.list, {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        });
        if (cancel) return;
        setRows(data.items ?? []);
        setDoctors(
          data.doctors?.length
            ? data.doctors
            : Array.from(
                new Set((data.items ?? []).map((r) => r.doctor))
              ).filter(Boolean)
        );
        setDrugs(
          data.drugs?.length
            ? data.drugs
            : Array.from(new Set((data.items ?? []).map((r) => r.drug))).filter(
                Boolean
              )
        );
      } catch (e: any) {
        if (!cancel) setError(e?.message || "فشل تحميل سجلات الصرف.");
      } finally {
        if (!cancel) setLoading(false);
      }
    }
    load();
    return () => {
      cancel = true;
    };
  }, [selDate, selDoctor, selDrug, q]);

  // تحميل توزيع الدونات من السيرفر (متأثر بنفس الفلاتر)
  useEffect(() => {
    let cancel = false;
    async function loadDonut() {
      try {
        setLoadingDonut(true);
        const d = await httpGet<DonutResponse>(ENDPOINTS.donut, {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        });
        if (cancel) return;
        // توليد ألوان افتراضية عند الحاجة — تتناسب مع لوحة الألوان في صفحة التأمين
        const palette = [
          "#3853FF",
          "#6FE38A",
          "#A7F3A8",
          "#E6ECFF",
          "#9AA0FF",
          "#B9E4C9",
        ];
        const cleaned =
          d.distribution?.map((s, i) => ({
            ...s,
            color: s.color ?? palette[i % palette.length],
          })) ?? [];
        setDonut(cleaned);
      } catch {
        // نكتفي بصمت هنا مثل صفحة التأمين
      } finally {
        setLoadingDonut(false);
      }
    }
    loadDonut();
    return () => {
      cancel = true;
    };
  }, [selDate, selDoctor, selDrug, q]);

  // تصفية محلية للبحث (احتياط لو الـAPI لم يطبّق q)
  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.trim();
    return rows.filter(
      (r) =>
        r.doctor?.includes(s) ||
        r.diagnosis?.includes(s) ||
        r.drug?.includes(s) ||
        r.note?.includes(s)
    );
  }, [rows, q]);

  // أعلى دواء صرفًا
  const topDrug = useMemo(() => {
    if (!donut?.length) return "—";
    return donut.reduce((a, b) => (a.value >= b.value ? a : b)).label;
  }, [donut]);

  // بناء conic-gradient من بيانات الدونات
  const donutBg = useMemo(() => {
    if (!donut?.length) return "conic-gradient(#E6ECFF 0deg 360deg)";
    let start = 0;
    const parts = donut.map((s) => {
      const end = start + s.value * 3.6;
      const seg = `${s.color} ${start}deg ${end}deg`;
      start = end;
      return seg;
    });
    return `conic-gradient(${parts.join(",")})`;
  }, [donut]);

  async function runAi() {
    try {
      setAiLoading(true);
      setAiMsg(null);
      setAiSource(null);
      const res = await httpPost<AiInsight>(ENDPOINTS.analyze, {
        filters: {
          dateRange: selDate === "الأسبوع الأخير" ? "last_week" : "all",
          doctor: selDoctor,
          drug: selDrug,
          q: q.trim(),
        },
      });
      setAiMsg(res.message || "تم التحليل.");
      if (res.sourceTag) setAiSource(res.sourceTag);
    } catch {
      setAiMsg("تعذّر تشغيل التحليل الآن. تحقّقي من خدمة الذكاء الاصطناعي.");
    } finally {
      setAiLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#EEF1F8]">
      <div className="grid grid-cols-[300px_1fr]">
        {/* Sidebar — مطابق للتأمين */}
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
              active
              icon={<Pill className="size-4" />}
              label="دواء"
              onClick={() => {}}
            />
            <SideItem
              icon={<BellRing className="size-4" />}
              label="إشعارات"
              onClick={() => navigate("/notifications")}
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

        {/* Main — مطابق للتأمين */}
        <main className="p-6 md:p-8" dir="rtl">
          {/* Header */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="text-xl md:text-2xl font-semibold">
                صرف الأدوية
              </div>
              <UserRound className="size-6 text-black/80" />
              <Bell className="size-5 text-black/70" />
            </div>

            {/* Search */}
            <div className="relative w-[320px] max-w-[45vw]">
              <input
                className="w-full h-10 rounded-full border border-black/10 bg-white pl-10 pr-4 outline-none placeholder:text-black/50"
                placeholder="ابحث..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-black/50" />
            </div>

            {/* Filters — نفس المكوّن ونفس المقاسات */}
            <div className="flex items-end gap-1.5 sm:gap-2 md:gap-2.5">
              <FilterSelect
                label="التاريخ"
                value={selDate}
                onChange={setSelDate}
                options={["الكل", "الأسبوع الأخير"]}
                placeholder="النطاق الزمني"
                minWidth="min-w-[8rem]"
              />
              <FilterSelect
                label="الطبيب"
                value={selDoctor}
                onChange={setSelDoctor}
                options={["الكل", ...doctors]}
                placeholder="اختر طبيب"
                minWidth="min-w-[8rem]"
              />
              <FilterSelect
                label="الدواء"
                value={selDrug}
                onChange={setSelDrug}
                options={["الكل", ...drugs]}
                placeholder="اختر الدواء"
                minWidth="min-w-[8rem]"
              />
            </div>
          </div>

          {/* Alerts */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Stats — نفس الأحجام والألوان */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4 md:max-w-[760px]">
            <StatPill
              title="عدد العمليات"
              value={filtered.length}
              bg="#D9DBFF"
              text="#0D16D1"
            />
            <StatPill
              title="الأدوية الأعلى صرفًا"
              value={topDrug}
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

          {/* AI + Donut (مطابق لتخطيط التأمين) */}
          <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_1fr] gap-5">
            {/* بطاقة الذكاء الاصطناعي — نفس التدرج والأزرار */}
            <div className="rounded-2xl shadow-ai overflow-hidden">
              <div
                className="min-h-[260px] h-full p-6 text-white flex flex-col justify-between"
                style={{
                  background:
                    "linear-gradient(135deg, #2C34D4 0%, #4C4DE9 38%, #0D16D1 100%)",
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">تحليل</span>
                    <Bot className="size-5 text-white" />
                  </div>

                  <button
                    className="h-9 px-4 rounded-full bg-white text-[#0D16D1] text-sm font-semibold hover:bg-white/90 transition disabled:opacity-60 disabled:cursor-not-allowed"
                    type="button"
                    onClick={runAi}
                    disabled={aiLoading || loading}
                  >
                    {aiLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <Loader2 className="size-4 animate-spin" /> جاري التحليل
                      </span>
                    ) : (
                      "تشغيل"
                    )}
                  </button>
                </div>

                <div className="mt-6 flex-1 flex items-center justify-center leading-relaxed">
                  {aiMsg ? (
                    <div className="text-center">
                      <p className="text-white/95">{aiMsg}</p>
                      {aiSource && (
                        <p className="text-white/70 text-sm mt-2">
                          المصدر: {aiSource}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-white/90 text-center">
                      اضغطي «تشغيل» لتحليل أنماط صرف الأدوية وفق الفلاتر
                      الحالية.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Donut — نفس بطاقة الشارت من حيث الهوامش والحدود والظلال */}
            <Card className="shadow-soft">
              <CardHeader className="pb-0">
                <CardTitle className="text-base">نسبة الصرف</CardTitle>
              </CardHeader>
              <CardContent className="pt-3">
                <div className="grid grid-cols-[1fr_1fr] items-center gap-4">
                  {/* legend */}
                  <ul className="space-y-2">
                    {(donut?.slice(0, 4) ?? []).map((s) => (
                      <li
                        key={s.label}
                        className="flex items-center gap-2 text-sm text-black/80"
                      >
                        <span
                          className="inline-block size-2.5 rounded-full"
                          style={{ backgroundColor: s.color }}
                        />
                        {s.label} {s.value}%
                      </li>
                    ))}
                    {loadingDonut && (
                      <li className="text-sm text-black/50">
                        جارِ تحميل التوزيع…
                      </li>
                    )}
                    {!loadingDonut && donut.length === 0 && (
                      <li className="text-sm text-black/50">
                        لا يوجد توزيع متاح.
                      </li>
                    )}
                  </ul>

                  {/* donut */}
                  <div className="flex justify-center">
                    <div
                      className="relative size-44 md:size-52 rounded-full border-8 border-white shadow-sm"
                      style={{ background: donutBg }}
                      title="Drug dispensing distribution"
                    >
                      <div className="absolute inset-6 rounded-full bg-white" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Table — نفس المقاسات والخطوط والحدود */}
          <Card className="mt-6 shadow-soft">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full table-fixed" dir="rtl">
                  <thead>
                    <tr className="text-right text-black/70 text-sm">
                      <Th w="110px">رقم السجل</Th>
                      <Th w="140px">الطبيب</Th>
                      <Th w="160px">التشخيص</Th>
                      <Th w="160px">الدواء</Th>
                      <Th w="140px">التاريخ</Th>
                      <Th>ملاحظة</Th>
                    </tr>
                  </thead>
                  <tbody className="text-sm">
                    {loading ? (
                      Array.from({ length: 6 }).map((_, i) => (
                        <tr key={i} className="border-t border-black/5">
                          {Array.from({ length: 6 }).map((__, j) => (
                            <Td key={j}>
                              <div className="h-4 bg-black/10 rounded animate-pulse" />
                            </Td>
                          ))}
                        </tr>
                      ))
                    ) : filtered.length === 0 ? (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-4 py-8 text-center text-black/60"
                        >
                          لا توجد سجلات مطابقة.
                        </td>
                      </tr>
                    ) : (
                      filtered.map((r, i) => (
                        <tr
                          key={r.id}
                          className={clsx(
                            "border-t border-black/5",
                            i % 2 === 1 && "bg-black/2.5"
                          )}
                        >
                          <Td w="110px">{r.id}</Td>
                          <Td w="140px">{r.doctor}</Td>
                          <Td w="160px">{r.diagnosis}</Td>
                          <Td w="160px">{r.drug}</Td>
                          <Td w="140px">{r.date}</Td>
                          <Td className="truncate">{r.note}</Td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}

/* ============================== Subcomponents (مطابقة لصفحة التأمين) ============================== */
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
  minWidth = "min-w-[8rem]",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
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
      <div className="relative inline-block">
        <select
          id={selectId}
          dir="rtl"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="
            select-green
            pr-9
            rounded-2xl
            border border-black/10
            shadow-md
            h-10
            text-sm
            bg-white
            text-black
            focus:outline-none
            focus:ring-4
            focus:ring-emerald-300/30
          "
          style={{ WebkitAppearance: "none", MozAppearance: "none" }}
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

function Th({ children, w }: { children: React.ReactNode; w?: string }) {
  return (
    <th
      className="px-4 py-3 border-b border-black/10 font-medium bg-white sticky top-0 z-[1]"
      style={{ width: w }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  w,
  className,
}: {
  children: React.ReactNode;
  w?: string;
  className?: string;
}) {
  return (
    <td
      className={clsx("px-4 py-3 align-middle", className)}
      style={{ width: w }}
    >
      {children}
    </td>
  );
}
