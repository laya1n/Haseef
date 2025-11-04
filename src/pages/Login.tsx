// src/pages/Login.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, UserRound, Lock, LogIn, Mail } from "lucide-react";

type StoredUser = { nationalId: string; password: string; name?: string };

export default function Login() {
  const navigate = useNavigate();
  const [nationalId, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");

    if (!nationalId.trim() || !password.trim()) {
      setErr("الرجاء إدخال رقم الهوية وكلمة المرور.");
      return;
    }

    const raw = localStorage.getItem("haseef_user");
    if (!raw) {
      setErr("لا يوجد حساب مسجل. الرجاء إنشاء حساب أولاً.");
      return;
    }

    const user: StoredUser = JSON.parse(raw);
    if (user.nationalId !== nationalId || user.password !== password) {
      setErr("رقم الهوية أو كلمة المرور غير صحيحة.");
      return;
    }

    setLoading(true);
    localStorage.setItem(
      "haseef_auth",
      JSON.stringify({ nationalId: user.nationalId, at: Date.now() })
    );
    navigate("/dashboard");
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      dir="rtl"
      style={{
        background:
          "linear-gradient(135deg, #0D16D1 0%, #4C4DE9 35%, #47A241 85%, #97FC4A 100%)",
      }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
        {/* شعار أو عنوان */}
        <div className="mb-6">
          <div className="text-2xl font-bold text-[#0D16D1]">مرحباً بعودتك</div>
          <p className="text-sm text-black/60 mt-1">
            يسعدنا رؤيتك مجدداً! الرجاء تسجيل الدخول للمتابعة.
          </p>
        </div>

        {/* النموذج */}
        <form onSubmit={handleSubmit} className="space-y-5 text-right">
          {/* رقم الهوية */}
          <div>
            <label className="text-sm font-medium text-black/70">
              رقم الهوية
            </label>
            <div className="relative mt-1">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50">
                <UserRound className="size-5" />
              </span>
              <input
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                inputMode="numeric"
                placeholder="مثال: 1234567890"
                className="w-full h-12 pr-10 pl-4 rounded-xl border border-black/10 bg-white text-[15px] focus:outline-none focus:ring-4 focus:ring-[#4C4DE9]/20"
              />
            </div>
          </div>

          {/* كلمة المرور */}
          <div>
            <label className="text-sm font-medium text-black/70">
              كلمة المرور
            </label>
            <div className="relative mt-1">
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-black/50"></span>
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                placeholder="••••••••"
                className="w-full h-12 pr-10 pl-10 rounded-xl border border-black/10 bg-white text-[15px] focus:outline-none focus:ring-4 focus:ring-[#4C4DE9]/20"
              />
              <button
                type="button"
                onClick={() => setShowPass((s) => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60 hover:text-black/80"
                aria-label={
                  showPass ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                }
              >
                {showPass ? (
                  <EyeOff className="size-5" />
                ) : (
                  <Eye className="size-5" />
                )}
              </button>
            </div>
          </div>

          {/* خطأ */}
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {err}
            </div>
          )}

          {/* تسجيل الدخول */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 rounded-xl bg-[#0D16D1] text-white font-semibold hover:bg-[#4C4DE9] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "جاري الدخول..." : "تسجيل الدخول"}
          </button>

          {/* تسجيل الدخول بجوجل */}
          <button
            type="button"
            className="w-full h-12 mt-2 rounded-xl border border-black/10 bg-white flex items-center justify-center gap-2 text-sm text-black/70 hover:bg-black/5 transition"
          >
            الدخول بواسطة نفاذ
          </button>
        </form>

        {/* رابط التسجيل */}
        <div className="mt-6 text-sm text-black/60">
          لا تملك حساباً؟{" "}
          <Link
            to="/register"
            className="text-[#0D16D1] hover:underline font-medium"
          >
            إنشاء حساب
          </Link>
        </div>
      </div>
    </div>
  );
}
