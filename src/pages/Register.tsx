// src/pages/Register.tsx
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound,
  Contact,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

/* ============================== Types ============================== */
type NewUser = {
  name: string;
  national_id: string;
  password: string;
};

/* ============================== Utils ============================== */
// يحوّل ٠١٢٣٤٥٦٧٨٩ و ۰۱۲۳۴۵۶۷۸۹ إلى 0123456789
const normalizeDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);

const isValidNID = (v: string) => /^\d{10}$/.test(v);

// قابل للتغيير من .env (Vite)
const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

/* ============================== Component ============================== */
export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [national_id, setNationalId] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const canSubmit = useMemo(
    () =>
      name.trim().length > 0 &&
      isValidNID(national_id) &&
      password.length >= 6 &&
      !password.includes(" ") &&
      password === confirm &&
      !loading,
    [name, national_id, password, confirm, loading]
  );

  const validate = () => {
    if (!name.trim()) return "الاسم مطلوب.";
    if (!isValidNID(national_id)) return "رقم الهوية يجب أن يتكون من 10 أرقام.";
    if (password.length < 6) return "كلمة المرور يجب ألا تقل عن 6 أحرف.";
    if (password.includes(" "))
      return "كلمة المرور لا يجب أن تحتوي على فراغات.";
    if (password !== confirm) return "كلمتا المرور غير متطابقتين.";
    return "";
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setOk("");

    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    setLoading(true);
    const payload: NewUser = {
      name: name.trim(),
      national_id,
      password,
    };

    try {
      const res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // detail قد تكون string أو array من أخطاء التحقق من Pydantic
        const msg =
          typeof data?.detail === "string"
            ? data.detail
            : Array.isArray(data?.detail)
            ? data.detail[0]?.msg || "بيانات غير صالحة."
            : data?.error || "حدث خطأ أثناء التسجيل.";
        setErr(msg);
        return;
      }

      setOk("تم إنشاء الحساب بنجاح! سيتم تحويلك لتسجيل الدخول.");
      setTimeout(() => navigate("/"), 900);
    } catch {
      setErr("تعذر الاتصال بالخادم. تأكدي من تشغيل الباك-إند.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      dir="rtl"
      style={{
        background: `
          radial-gradient(circle at 20% 20%, rgba(146, 227, 169, 0.10), transparent 60%),
          linear-gradient(135deg,  #071737ff 0%, #112a60ff 30%, #184C4B 70%, #1F5E53 100%)
        `,
      }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-md p-8">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#112F2A]">إنشاء حساب</h1>
          <p className="text-sm text-black/60 mt-1">
            أدخل بياناتك لإتمام عملية التسجيل.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 text-right" noValidate>
          {/* الاسم */}
          <div>
            <label className="text-sm font-medium text-black/70">
              الاسم الكامل
            </label>
            <div className="relative mt-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="الاسم الثلاثي"
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-black/10 bg-white text-[15px]
                           focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
              />
              {!name && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]">
                  <UserRound className="size-5" />
                </span>
              )}
            </div>
          </div>

          {/* رقم الهوية */}
          <div>
            <label className="text-sm font-medium text-black/70">
              رقم الهوية
            </label>
            <div className="relative mt-1">
              <input
                value={national_id}
                onChange={(e) => {
                  const ascii = normalizeDigits(e.target.value);
                  setNationalId(ascii.replace(/\D/g, "").slice(0, 10));
                }}
                inputMode="numeric"
                pattern="[0-9٠-٩۰-۹]*"
                maxLength={10}
                placeholder="10 أرقام"
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-black/10 bg-white text-[15px]
                           focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
              />
              {!national_id && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]">
                  <Contact className="size-5" />
                </span>
              )}
            </div>
          </div>

          {/* كلمة المرور */}
          <div>
            <label className="text-sm font-medium text-black/70">
              كلمة المرور
            </label>
            <div className="relative mt-1">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPass ? "text" : "password"}
                placeholder="         ••••••••"
                className="w-full h-12 pr-12 pl-12 rounded-xl border border-black/10 bg-white text-[15px]
                           focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
              />
              {!password && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]">
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
          </div>

          {/* تأكيد كلمة المرور */}
          <div>
            <label className="text-sm font-medium text-black/70">
              تأكيد كلمة المرور
            </label>
            <div className="relative mt-1">
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type={showConf ? "text" : "password"}
                placeholder="        أعد إدخال كلمة المرور"
                className="w-full h-12 pr-12 pl-12 rounded-xl border border-black/10 bg-white text-[15px]
                           focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
              />
              {!confirm && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]">
                  <Lock className="size-5" />
                </span>
              )}
              <button
                type="button"
                onClick={() => setShowConf((s) => !s)}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-black/60 hover:text-black/80"
                aria-label={showConf ? "إخفاء" : "إظهار"}
              >
                {showConf ? (
                  <EyeOff className="size-5" />
                ) : (
                  <Eye className="size-5" />
                )}
              </button>
            </div>
          </div>

          {/* رسائل التنبيه */}
          {err && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2">
              {err}
            </div>
          )}
          {ok && (
            <div className="text-sm text-[#1F5E53] bg-[#92E3A9]/15 border border-[#92E3A9]/30 rounded-xl px-3 py-2 flex items-center gap-2">
              <Check className="size-4" /> {ok}
            </div>
          )}

          {/* زر الإنشاء */}
          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full h-12 rounded-xl bg-[#92E3A9] text-[#112F2A] font-semibold
                       hover:bg-[#7ED8A0] transition disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? "جاري الإنشاء..." : "إنشاء الحساب"}
          </button>

          {/* العودة لتسجيل الدخول */}
          <div className="text-center text-sm text-black/60">
            لديك حساب بالفعل؟{" "}
            <Link to="/" className="text-[#1F5E53] hover:underline font-medium">
              تسجيل الدخول
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
