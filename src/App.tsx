import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Toaster, toast } from "sonner";

export default function App() {
  return (
    <div className="min-h-screen px-4 py-10">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="text-white">
          <h1 className="text-3xl font-semibold">
            مرحبًا بك في نظام حصيف الذكي
          </h1>
          <p className="text-white/90 mt-2">
            واجهة أمامية جاهزة للتكامل مع الـ Backend و الـ AI و البيانات.
          </p>
          <div className="mt-4 flex gap-3">
            <Button onClick={() => toast.success("كل شيء جاهز!")}>
              ابدأ الآن
            </Button>
            <Button
              variant="secondary"
              className="bg-white text-black hover:bg-white/90"
            >
              توثيق الواجهة
            </Button>
          </div>
        </header>

        <section className="grid sm:grid-cols-3 gap-4">
          <Card className="bg-white/80 backdrop-blur border border-white/40 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>العيادات الطبية</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              تحليل السجلات وعرض الحالات.
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur border border-white/40 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>التأمين الصحي</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              متابعة المطالبات والموافقات.
            </CardContent>
          </Card>
          <Card className="bg-white/80 backdrop-blur border border-white/40 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>الأدوية</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-700">
              تنبيهات الجرعات والتفاعلات.
            </CardContent>
          </Card>
        </section>
      </div>

      <Toaster richColors position="top-center" />
    </div>
  );
}
