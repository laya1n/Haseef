// src/routes/Protected.tsx
import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiMe } from "@/lib/api";

/**
 * ✅ مكوّن حماية الصفحات التي تتطلب تسجيل دخول.
 * - يتحقق من صلاحية الكوكي (access_token) عبر استدعاء apiMe().
 * - يعرض شاشة "جاري التحقق..." أثناء الفحص.
 * - إذا لم توجد جلسة صالحة → يعيد المستخدم إلى صفحة تسجيل الدخول.
 */
export default function Protected({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        await apiMe(); // ✅ إذا نجح، يعني الكوكي صالحة
        if (active) setAuthenticated(true);
      } catch {
        if (active) setAuthenticated(false);
      } finally {
        if (active) setLoading(false);
      }
    }

    checkAuth();
    return () => {
      active = false;
    };
  }, []);

  // أثناء التحقق من الجلسة
  if (loading) {
    return (
      <div
        dir="rtl"
        className="min-h-screen flex items-center justify-center text-center text-gray-600 bg-gray-50"
      >
        <div className="p-6 rounded-2xl bg-white shadow-md border border-gray-100">
          <p className="font-medium text-sm">جاري التحقق من الجلسة...</p>
        </div>
      </div>
    );
  }

  // إذا لم يتم التحقق → الرجوع لتسجيل الدخول
  if (!authenticated) {
    return <Navigate to="/" replace />;
  }

  // عرض الصفحة الأصلية
  return <>{children}</>;
}
