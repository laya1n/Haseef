// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Stethoscope,
  Shield,
  Pill,
  BellRing,
  Bot,
  ArrowLeft,
  LogIn,
  UserPlus,
} from "lucide-react";
import clsx from "clsx";

const brand = {
  primary: "#0D16D1",
  primaryLight: "#4C4DE9",
  accent: "#47A241",
  accentLight: "#97FC4A",
};

export default function Home() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("haseef_auth");
      setIsAuthed(!!raw);
    } catch {
      setIsAuthed(false);
    }
  }, []);

  const goStart = () => navigate(isAuthed ? "/dashboard" : "/register");

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col"
      style={{
        background:
          "radial-gradient(1200px 700px at 80% -10%, rgba(151,252,74,0.28) 0%, rgba(151,252,74,0.0) 62%), radial-gradient(1200px 700px at 20% 110%, rgba(76,77,233,0.35) 0%, rgba(76,77,233,0.0) 62%), linear-gradient(135deg, #0D16D1 0%, #4C4DE9 40%, #47A241 90%, #97FC4A 100%)",
      }}
    >
      {/* Top Nav */}
      <header className="sticky top-0 z-10 bg-white/50 backdrop-blur-md border-b border-black/10">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-[#0D16D1] flex items-center justify-center">
              <span className="text-white font-bold">ح</span>
            </div>
            <span className="text-lg font-semibold text-[#0D16D1]">حصيف</span>
          </div>

          <nav className="hidden md:flex items-center gap-5 text-sm text-black/70">
            <a className="hover:text-black" href="#features">
              المميزات
            </a>
            <a className="hover:text-black" href="#modules">
              الوحدات
            </a>
            <a className="hover:text-black" href="#about">
              لماذا حصيف؟
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              to="/login"
              className="h-10 px-4 rounded-xl border border-black/10 bg-white text-sm flex items-center gap-2 hover:bg-black/5"
            >
              <LogIn className="size-4" />
              دخول
            </Link>
            <Link
              to="/register"
              className="h-10 px-4 rounded-xl bg-[#0D16D1] text-white text-sm flex items-center gap-2 hover:bg-[#4C4DE9]"
            >
              <UserPlus className="size-4" />
              إنشاء حساب
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative">
        <div className="mx-auto max-w-6xl px-4 py-16 md:py-20">
          <div className="grid md:grid-cols-2 gap-10 items-center">
            <div className="text-white">
              <h1 className="text-3xl md:text-4xl font-bold leading-relaxed">
                منصة ذكية لإدارة السجلات الطبية والتأمينية و صرف الأدوية
              </h1>
              <p className="mt-3 text-white/90 text-lg">
                تتبع الأنماط، اكتشف التكرارات والمخاطر، وتلقَّى التنبيهات في
                الوقت المناسب—كل ذلك بواجهة عربية بسيطة وسريعة.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <button
                  onClick={goStart}
                  className="h-11 px-5 rounded-2xl bg-white text-[#0D16D1] font-semibold flex items-center gap-2 hover:bg-white/90 shadow"
                >
                  ابدأ الآن
                  <ArrowLeft className="size-4" />
                </button>
                <Link
                  to="/dashboard"
                  className={clsx(
                    "h-11 px-5 rounded-2xl border border-white/40 text-white hover:bg-white/10",
                    isAuthed && "bg-white/10"
                  )}
                >
                  مشاهدة لوحة التحكم
                </Link>
              </div>

              {/* mini stats */}
              <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
                <MiniStat
                  title="الأطباء"
                  value="7"
                  bg="#EAF2FF"
                  text={brand.primary}
                />
                <MiniStat
                  title="السجلات"
                  value="120"
                  bg="#D9DBFF"
                  text={brand.primaryLight}
                />
                <MiniStat
                  title="التنبيهات"
                  value="14"
                  bg="#E0F6CF"
                  text="#1B4D3B"
                />
              </div>
            </div>

            {/* hero card */}
            <div className="bg-white/90 rounded-3xl shadow-2xl p-6 md:p-8 backdrop-blur-sm">
              <h3 className="text-lg font-semibold text-[#0D16D1] mb-4">
                نظرة عامة سريعة
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <HeroTile
                  icon={<Stethoscope className="size-5" />}
                  title="السجلات الطبية"
                  to="/dashboard"
                />
                <HeroTile
                  icon={<Shield className="size-5" />}
                  title="السجلات التأمينية"
                  to="/insurance"
                />
                <HeroTile
                  icon={<Pill className="size-5" />}
                  title="صرف الأدوية"
                  to="/drugs"
                />
                <HeroTile
                  icon={<BellRing className="size-5" />}
                  title="الإشعارات"
                  to="/notifications"
                />
                <HeroTile
                  icon={<Bot className="size-5" />}
                  title="مساعد ذكي"
                  to="/chat"
                />
              </div>

              <div className="mt-6 rounded-2xl p-4 text-sm text-black/70 border border-black/10 bg-white">
                يدعم حصيف التحليلات الذكية (AI) لاكتشاف الأنماط مثل تكرار
                التشخيص أو الرفض غير المبرر في مطالبات التأمين، مع اقتراحات
                عملية قابلة للتنفيذ.
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section id="modules" className="py-14 bg-white/60 backdrop-blur-[2px]">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-[#0D16D1] mb-6">الوحدات</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ModuleCard
              title="طب"
              desc="عرض السجلات الطبية، الإحصاءات، والأنماط المتكررة."
              icon={<Stethoscope className="size-5" />}
              to="/dashboard"
              tone="blue"
            />
            <ModuleCard
              title="التأمين"
              desc="إدارة مطالبات التأمين وتحليل نسب الرفض والقبول."
              icon={<Shield className="size-5" />}
              to="/insurance"
              tone="indigo"
            />
            <ModuleCard
              title="دواء"
              desc="مراقبة صرف الأدوية وتوازن الاستهلاك."
              icon={<Pill className="size-5" />}
              to="/drugs"
              tone="emerald"
            />
            <ModuleCard
              title="الإشعارات"
              desc="تنبيهات متقدمة حسب النوع والأولوية."
              icon={<BellRing className="size-5" />}
              to="/notifications"
              tone="slate"
            />
            <ModuleCard
              title="مساعد ذكي"
              desc="دردشة ذكاء اصطناعي لتلخيص وتحليل السجلات."
              icon={<Bot className="size-5" />}
              to="/chat"
              tone="violet"
            />
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-14">
        <div className="mx-auto max-w-6xl px-4">
          <h2 className="text-2xl font-bold text-white mb-6">
            المميزات الرئيسية
          </h2>
          <ul className="grid md:grid-cols-3 gap-4">
            <Feat
              title="واجهة عربية سلسة"
              text="تصميم RTL نظيف ومتوافق مع الشاشات المختلفة."
            />
            <Feat
              title="تحليلات ذكية"
              text="نماذج تكتشف الأنماط وتقدم توصيات عملية."
            />
            <Feat
              title="تكامل وحدات"
              text="طب، تأمين، دواء، إشعارات — في مكان واحد."
            />
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto bg-white/70 border-t border-black/10">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-black/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <span>© {new Date().getFullYear()} حصيف — جميع الحقوق محفوظة</span>
          <div className="flex items-center gap-4">
            <a className="hover:text-black" href="#about">
              عن حصيف
            </a>
            <a className="hover:text-black" href="#features">
              المميزات
            </a>
            <Link className="hover:text-black" to="/login">
              تسجيل الدخول
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* ---------- small pieces ---------- */
function MiniStat({
  title,
  value,
  bg,
  text,
}: {
  title: string;
  value: string | number;
  bg: string;
  text: string;
}) {
  return (
    <div
      className="rounded-2xl px-4 py-3 shadow-soft"
      style={{ backgroundColor: bg, color: text }}
    >
      <div className="text-xs opacity-80">{title}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function HeroTile({
  icon,
  title,
  to,
}: {
  icon: React.ReactNode;
  title: string;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl p-4 border border-black/10 hover:shadow-md transition bg-white flex items-center justify-between"
    >
      <div className="flex items-center gap-3">
        <span className="size-9 rounded-xl bg-[#EAF2FF] text-[#0D16D1] flex items-center justify-center">
          {icon}
        </span>
        <span className="font-medium">{title}</span>
      </div>
      <ArrowLeft className="size-4 text-black/40" />
    </Link>
  );
}

function ModuleCard({
  title,
  desc,
  icon,
  to,
  tone = "blue",
}: {
  title: string;
  desc: string;
  icon: React.ReactNode;
  to: string;
  tone?: "blue" | "indigo" | "emerald" | "slate" | "violet";
}) {
  const tones: Record<string, { chip: string; text: string }> = {
    blue: { chip: "bg-blue-50 text-blue-700", text: "text-blue-700" },
    indigo: { chip: "bg-indigo-50 text-indigo-700", text: "text-indigo-700" },
    emerald: {
      chip: "bg-emerald-50 text-emerald-700",
      text: "text-emerald-700",
    },
    slate: { chip: "bg-slate-50 text-slate-700", text: "text-slate-700" },
    violet: { chip: "bg-violet-50 text-violet-700", text: "text-violet-700" },
  };
  return (
    <Link
      to={to}
      className="rounded-2xl bg-white p-5 border border-black/10 hover:shadow-lg transition flex flex-col gap-3"
    >
      <div
        className={clsx(
          "inline-flex items-center gap-2 px-3 py-1 rounded-full text-sm",
          tones[tone].chip
        )}
      >
        <span className={tones[tone].text}>{title}</span>
        <span>{icon}</span>
      </div>
      <p className="text-black/70 text-sm leading-6">{desc}</p>
      <div className="mt-auto text-[#0D16D1] font-medium">الانتقال للوحدة</div>
    </Link>
  );
}

function Feat({ title, text }: { title: string; text: string }) {
  return (
    <li className="rounded-2xl bg-white/90 p-5 border border-black/10">
      <div className="text-[#0D16D1] font-semibold">{title}</div>
      <p className="text-black/70 text-sm mt-1 leading-6">{text}</p>
    </li>
  );
}
