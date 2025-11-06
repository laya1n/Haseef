// src/pages/Login.tsx
import { useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Eye,
  EyeOff,
  UserRound,
  Lock,
  ArrowLeft,
  CheckCircle2,
} from "lucide-react";

/* ============================== Types ============================== */
type StoredUser = {
  national_id: string;
  password: string;
  name?: string;
  email?: string;
  phone?: string;
};

/* ============================== Utils ============================== */
// يحوّل ٠١٢٣٤٥٦٧٨٩ و ۰۱۲۳۴۵۶۷۸۹ إلى 0123456789
const normalizeDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);

const isValidSaudiNID = (v: string) => /^\d{10}$/.test(v);

const REDIRECT_PATH = "/home";

/* ============================== Component ============================== */
export default function Login() {
  const navigate = useNavigate();

  const [national_id, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const canSubmit = useMemo(
    () =>
      isValidSaudiNID(national_id) && password.trim().length > 0 && !loading,
    [national_id, password, loading]
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");

    if (!isValidSaudiNID(national_id)) {
      setErr("رقم الهوية يجب أن يتكون من 10 أرقام.");
      return;
    }
    if (!password.trim()) {
      setErr("الرجاء إدخال كلمة المرور.");
      return;
    }

    //const raw = localStorage.getItem("haseef_user");
    //if (!raw) {
    //  setErr("لا يوجد حساب مسجل. الرجاء إنشاء حساب أولاً.");
    //  return;
    //}
    setLoading(true);
    try {
      const res = await fetch("https://haseef.onrender.com/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ national_id, password }),
      });

      const data = await res.json();

      if (res.ok) {
        setOk("تم تسجيل الدخول بنجاح.");
        setTimeout(() => navigate(REDIRECT_PATH), 700);
      } else {
        setErr(data.detail || "رقم الهوية أو كلمة المرور غير صحيحة.");
      }
    } catch (error) {
      setErr("تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }

    //  const user: StoredUser = JSON.parse(raw);
    //  if (user.nationalId !== nationalId || user.password !== password) {
    //    setErr("رقم الهوية أو كلمة المرور غير صحيحة.");
    //    return;
    //  } this is commented because now the backend is doing the actual authentication no need for local checks

    setLoading(true);
    const token = { national_id, at: Date.now() };

    if (remember) localStorage.setItem("haseef_auth", JSON.stringify(token));
    else sessionStorage.setItem("haseef_auth", JSON.stringify(token));

    setTimeout(() => {
      setLoading(false);
      setOk("تم تسجيل الدخول بنجاح.");
      navigate(REDIRECT_PATH);
    }, 350);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      dir="rtl"
      style={{
        background: `
          radial-gradient(circle at 20% 20%, rgba(146, 227, 169, 0.10), transparent 60%),
          linear-gradient(135deg, #251E56 0%, #2B2D6B 30%, #184C4B 70%, #1F5E53 100%)
        `,
      }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-md p-8 text-center">
        {/* Header */}
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-[#112F2A]">مرحباً بعودتك</h1>
          <p className="text-sm text-black/60 mt-1">
            يسعدنا رؤيتك مجدداً! الرجاء تسجيل الدخول للمتابعة.
          </p>
        </header>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="space-y-5 text-right"
          noValidate
        >
          {/* رقم الهوية */}
          <div>
            <label
              htmlFor="national-id"
              className="text-sm font-medium text-black/70"
            >
              رقم الهوية
            </label>
            <div className="relative mt-1">
              <input
                id="national-id"
                name="national-id"
                value={national_id}
                onChange={(e) => {
                  const ascii = normalizeDigits(e.target.value);
                  const only = ascii.replace(/[^0-9]/g, "");
                  setNationalId(only);
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9٠-٩۰-۹]*"
                autoComplete="username"
                placeholder="       10 أرقام"
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-black/10 bg-white text-[15px]
                           focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30 transition-all"
              />
              {!national_id && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]"
                  aria-hidden="true"
                >
                  <UserRound className="size-5" />
                </span>
              )}
            </div>
            {!isValidSaudiNID(national_id) && national_id.length > 0 && (
              <p className="mt-1 text-xs text-red-600">يجب أن يكون 10 أرقام.</p>
            )}
          </div>

          {/* كلمة المرور */}
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-black/70"
            >
              كلمة المرور
            </label>
            <div className="relative mt-1">
              <input
                id="password"
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                placeholder="       ••••••••"
                autoComplete="current-password"
                className="w-full h-12 pr-12 pl-12 rounded-xl border border-black/10 bg-white text-[15px]
                           focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30 transition-all"
              />
              {!password && (
                <span
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]"
                  aria-hidden="true"
                >
                  <Lock className="size-5" />
                </span>
              )}
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

            <div className="mt-2 flex items-center justify-start text-sm">
              <label className="inline-flex items-center gap-2 text-black/70 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="rounded border-black/20"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                تذكرني
              </label>
            </div>
          </div>

          {/* Alerts */}
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {err}
            </div>
          )}
          {ok && (
            <div className="text-sm text-[#1F5E53] bg-[#92E3A9]/15 border border-[#92E3A9]/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <CheckCircle2 className="size-4" /> {ok}
            </div>
          )}

          {/* زر الدخول */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-xl bg-[#92E3A9] text-[#112F2A] font-semibold transition
                       hover:bg-[#7ED8A0] disabled:opacity-60 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2"
          >
            {loading ? (
              "جاري الدخول..."
            ) : (
              <>
                تسجيل الدخول <ArrowLeft className="size-5" />
              </>
            )}
          </button>
        </form>

        {/* رابط التسجيل */}
        <div className="mt-6 text-sm text-black/60">
          لا تملك حساباً؟{" "}
          <Link
            to="/register"
            className="text-[#1F5E53] hover:underline font-medium"
          >
            إنشاء حساب
          </Link>
        </div>
      </div>
    </div>
  );
}
