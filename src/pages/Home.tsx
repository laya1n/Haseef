// src/pages/Home.tsx
import { Link, useNavigate } from "react-router-dom";
import { ClipboardList, Shield, Pill, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { apiLogout } from "@/lib/api";

export default function Home() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      // ✅ مصادقة بالكوكيز: نحذف جلسة المستخدم من السيرفر
      await apiLogout();
    } catch {
      // حتى لو فشل الطلب، سنعيد التوجيه لصفحة الدخول
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen flex flex-col items-center justify-center px-6 py-10 text-center text-white relative"
      style={{
        background: `
          radial-gradient(circle at 20% 20%, rgba(60, 255, 180, 0.1), transparent 60%),
          linear-gradient(135deg, #071737ff 0%, #112a60ff 30%, #184C4B 70%, #1F5E53 100%)
        `,
      }}
    >
      {/* ✅ الشعار في الزاوية العلوية اليمنى */}
      <div className="absolute top-6 right-6">
        <img
          src={logo}
          alt="شعار حصيف الذكي"
          className="w-16 md:w-16 drop-shadow-lg select-none"
        />
      </div>

      {/* زر تسجيل الخروج */}
      <div className="absolute top-6 left-6">
        <button
          onClick={handleLogout}
          className="px-5 py-2 rounded-full border border-white/70 text-white/90 hover:bg-white/10 transition font-medium text-sm flex items-center gap-2"
        >
          <LogOut className="size-4" />
          تسجيل خروج
        </button>
      </div>

      {/* العنوان الرئيسي */}
      <div className="max-w-3xl mb-10 mt-10">
        <h1 className="text-3xl md:text-4xl font-bold leading-snug text-white drop-shadow-md">
          مرحباً بك في نظام <span className="text-[#92E3A9]">حصيف</span> لتحليل
          الأنماط الصحية
        </h1>
        <p className="mt-3 text-white/80 text-sm md:text-base">
          منصة تحليل الأنماط الصحية لمتابعة جودة الخدمات الطبية والتأمينية وصرف
          الأدوية باستخدام الذكاء الاصطناعي.
        </p>

        <Link
          to="/dashboard"
          className="inline-block mt-6 px-6 py-3 rounded-xl bg-[#92E3A9] text-[#112F2A] font-semibold hover:bg-[#7ED8A0] transition"
        >
          لوحة المتابعة
        </Link>
      </div>

      {/* البطاقات */}
      <div className="flex flex-col md:flex-row gap-6 justify-center max-w-5xl">
        {/* الأنماط الطبية */}
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 w-full md:w-72 shadow-lg hover:-translate-y-1 hover:shadow-xl transition">
          <div className="flex flex-col items-center">
            <ClipboardList className="size-8 text-[#92E3A9] mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">
              الأنماط الطبية
            </h3>
            <p className="text-white/80 text-sm mb-4">
              تحليل سلوك الأطباء والتشخيصات للكشف عن الأنماط غير الطبيعية.
            </p>
            <Link
              to="/dashboard"
              className="text-sm font-medium bg-[#92E3A9] text-[#112F2A] px-4 py-2 rounded-lg hover:bg-[#7ED8A0] transition"
            >
              اذهب للوحة الأنماط →
            </Link>
          </div>
        </div>

        {/* السجلات التأمينية */}
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 w-full md:w-72 shadow-lg hover:-translate-y-1 hover:shadow-xl transition">
          <div className="flex flex-col items-center">
            <Shield className="size-8 text-[#92E3A9] mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">
              السجلات التأمينية
            </h3>
            <p className="text-white/80 text-sm mb-4">
              متابعة المطالبات واكتشاف الرفض غير المبرر وأنماط شركات التأمين.
            </p>
            <Link
              to="/insurance"
              className="text-sm font-medium bg-[#92E3A9] text-[#112F2A] px-4 py-2 rounded-lg hover:bg-[#7ED8A0] transition"
            >
              سجلات التأمين →
            </Link>
          </div>
        </div>

        {/* صرف الأدوية */}
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl p-6 w-full md:w-72 shadow-lg hover:-translate-y-1 hover:shadow-xl transition">
          <div className="flex flex-col items-center">
            <Pill className="size-8 text-[#92E3A9] mb-3" />
            <h3 className="text-lg font-semibold text-white mb-1">
              صرف الأدوية
            </h3>
            <p className="text-white/80 text-sm mb-4">
              تحليل كميات وأصناف الأدوية ومراقبة الصرف غير المناسب.
            </p>
            <Link
              to="/drugs"
              className="text-sm font-medium bg-[#92E3A9] text-[#112F2A] px-4 py-2 rounded-lg hover:bg-[#7ED8A0] transition"
            >
              لوحة الأدوية →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
