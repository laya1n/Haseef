// src/pages/Home.tsx
import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ActivitySquare, Shield, Pill, ArrowRight, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Home() {
  const navigate = useNavigate();
  const [isAuthed, setIsAuthed] = useState(false);

  useEffect(() => {
    setIsAuthed(!!localStorage.getItem("haseef_auth"));
  }, []);

  const logout = () => {
    localStorage.removeItem("haseef_auth");
    setIsAuthed(false);
    navigate("/login");
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen text-white"
      style={{
        // خلفية ملوّنة ناعمة (متوافقة مع ألوان البراند)
        background:
          "radial-gradient(1200px 700px at 75% 20%, rgba(151,252,74,0.45), transparent 60%), radial-gradient(1200px 700px at 20% 15%, rgba(76,77,233,0.55), transparent 60%), linear-gradient(135deg, #0D16D1 0%, #4C4DE9 40%, #2F78D6 65%, #59C08B 100%)",
      }}
    >
      {/* شريط علوي */}
      <header className="max-w-6xl mx-auto px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-white/90">
          <Bell className="size-5" />
        </div>

        <div className="flex items-center gap-2">
          {isAuthed ? (
            <button
              onClick={logout}
              className="h-10 px-4 rounded-xl border border-white/35 bg-white/10 hover:bg-white/20 transition"
            >
              تسجيل خروج
            </button>
          ) : (
            <Link
              to="/login"
              className="h-10 px-4 rounded-xl bg-white text-[#0D16D1] hover:bg-white/90 transition"
            >
              تسجيل الدخول
            </Link>
          )}
        </div>
      </header>

      {/* الهيرو */}
      <section className="max-w-6xl mx-auto px-5 pt-10 pb-8 md:pt-16 md:pb-12">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-extrabold leading-snug">
          مرحبًا بك في نظام <span className="text-[#97FC4A]">حصيف</span> الذكي
          <br className="hidden md:block" /> لتحليل الأنماط الصحية
        </h1>

        <p className="mt-4 max-w-2xl text-white/90 leading-relaxed">
          منصة تحليل الأنماط الصحية لمتابعة جودة الخدمات الطبية والتأمينية وصرف
          الأدوية باستخدام الذكاء الاصطناعي.
        </p>

        <div className="mt-6">
          <button
            onClick={() => navigate(isAuthed ? "/dashboard" : "/login")}
            className="h-11 px-5 rounded-2xl bg-white text-[#0D16D1] font-semibold hover:bg-white/90 shadow"
          >
            لوحة المتابعة
          </button>
        </div>
      </section>

      {/* بطاقات الميزات */}
      <section className="max-w-6xl mx-auto px-5 pb-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* الأنماط الطبية */}
          <FeatureCard
            title="الأنماط الطبية"
            icon={<ActivitySquare className="size-5" />}
            description="تحليل سلوك الأطباء والتشخيصات للكشف عن الأنماط غير الطبيعية."
            cta="اذهب للوحة الأنماط"
            onClick={() => navigate(isAuthed ? "/dashboard" : "/login")}
          />

          {/* السجلات التأمينية */}
          <FeatureCard
            title="السجلات التأمينية"
            icon={<Shield className="size-5" />}
            description="متابعة المطالبات واكتشاف الرفض غير المبرر وأنماط شركات التأمين."
            cta="سجلات التأمين"
            onClick={() => navigate(isAuthed ? "/insurance" : "/login")}
          />

          {/* صرف الأدوية */}
          <FeatureCard
            title="صرف الأدوية"
            icon={<Pill className="size-5" />}
            description="تحليل كميات وأصناف الأدوية ومراقبة الصرف غير المناسب."
            cta="لوحة الأدوية"
            onClick={() => navigate(isAuthed ? "/drugs" : "/login")}
          />
        </div>
      </section>
    </div>
  );
}

/* --------- مكوّن بطاقة ميزة --------- */
function FeatureCard({
  title,
  description,
  icon,
  cta,
  onClick,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  cta: string;
  onClick: () => void;
}) {
  return (
    <Card className="bg-white/15 backdrop-blur-md border-white/20 text-white shadow-[0_8px_22px_rgba(0,0,0,0.15)]">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center size-8 rounded-xl bg-white/15">
            {icon}
          </span>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-white/90 leading-relaxed">{description}</p>

        <div className="mt-4">
          <button
            onClick={onClick}
            className="inline-flex items-center gap-1 h-10 px-4 rounded-xl bg-white text-[#0D16D1] hover:bg-white/90 transition"
          >
            {cta}
            <ArrowRight className="size-4" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
