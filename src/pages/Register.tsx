// src/pages/Register.tsx
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  UserRound,
  IdCard,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Check,
} from "lucide-react";

type NewUser = {
  name: string;
  nationalId: string;
  email?: string;
  password: string;
};

// يحوّل ٠١٢٣٤٥٦٧٨٩ و ۰۱۲۳۴۵۶۷۸۹ إلى 0123456789
const normalizeDigits = (s: string) =>
  s
    .replace(/[٠-٩]/g, (d) => "0123456789"["٠١٢٣٤٥٦٧٨٩".indexOf(d)])
    .replace(/[۰-۹]/g, (d) => "0123456789"["۰۱۲۳۴۵۶۷۸۹".indexOf(d)]);

export default function Register() {
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConf, setShowConf] = useState(false);
  const [agree, setAgree] = useState(false);

  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");

  const validate = () => {
    setErr("");
    setOk("");

    if (!name.trim()) return "الاسم مطلوب.";
    if (!/^\d{10}$/.test(nationalId))
      return "رقم الهوية يجب أن يتكون من 10 أرقام.";
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return "صيغة البريد غير صحيحة.";
    if (password.length < 6) return "كلمة المرور يجب ألا تقل عن 6 أحرف.";
    if (password !== confirm) return "كلمتا المرور غير متطابقتين.";
    if (!agree) return "الرجاء الموافقة على الشروط.";
    return "";
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = validate();
    if (v) {
      setErr(v);
      return;
    }

    const payload: NewUser = {
      name: name.trim(),
      nationalId,
      email: email.trim(),
      password,
    };
    localStorage.setItem("haseef_user", JSON.stringify(payload));
    setOk("تم إنشاء الحساب بنجاح! سيتم تحويلك لتسجيل الدخول.");
    setTimeout(() => navigate("/login"), 900);
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      dir="rtl"
      style={{
        // نفس تدرّج الهوم/اللوجين الغامق مع لمسة خضراء
        background: `
          radial-gradient(circle at 20% 20%, rgba(146, 227, 169, 0.10), transparent 60%),
          linear-gradient(135deg, #251E56 0%, #2B2D6B 30%, #184C4B 70%, #1F5E53 100%)
        `,
      }}
    >
      <div className="bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl w-full max-w-md p-8">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-[#112F2A]">إنشاء حساب</h1>
          <p className="text-sm text-black/60 mt-1">
            أدخل بياناتك لإتمام عملية التسجيل.
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-5 text-right">
          {/* الاسم */}
          <div>
            <label className="text-sm font-medium text-black/70">
              الاسم الكامل
            </label>
            <div className="relative mt-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: لين السليماني"
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-black/10 bg-white text-[15px] focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
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
                value={nationalId}
                onChange={(e) => {
                  const ascii = normalizeDigits(e.target.value);
                  setNationalId(ascii.replace(/\D/g, "").slice(0, 10));
                }}
                inputMode="numeric"
                pattern="[0-9٠-٩۰-۹]*"
                maxLength={10}
                placeholder="10 أرقام"
                className="w-full h-12 pr-12 pl-4 rounded-xl border border-black/10 bg-white text-[15px] focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
              />
              {!nationalId && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#92E3A9]">
                  <IdCard className="size-5" />
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
                className="w-full h-12 pr-12 pl-12 rounded-xl border border-black/10 bg-white text-[15px] focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
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
                className="w-full h-12 pr-12 pl-12 rounded-xl border border-black/10 bg-white text-[15px] focus:outline-none focus:ring-4 focus:ring-[#92E3A9]/30"
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

          {/* الموافقة على الشروط */}
          <label className="flex items-center gap-2 text-sm text-black/70 select-none">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="size-4 rounded border-black/30"
            />
            أوافق على الشروط وسياسة الخصوصية.
          </label>

          {/* رسائل */}
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

          {/* إنشاء الحساب */}
          <button
            type="submit"
            className="w-full h-12 rounded-xl bg-[#92E3A9] text-[#112F2A] font-semibold hover:bg-[#7ED8A0] transition"
          >
            إنشاء الحساب
          </button>

          {/* رجوع لتسجيل الدخول */}
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
