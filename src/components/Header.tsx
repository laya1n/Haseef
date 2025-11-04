import { Link } from "react-router-dom";
import { Bell } from "lucide-react";

export default function Header() {
  return (
    <header className="container mx-auto flex items-center justify-between py-6 px-4 text-white/90">
      {/* أيقونة الإشعارات (يسار) */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="الإشعارات"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 backdrop-blur transition"
        >
          <Bell className="h-5 w-5" />
        </button>
      </div>

      {/* رابط تسجيل/خروج (يمين) */}
      <nav className="text-sm">
        <Link
          to="/login"
          className="rounded-full bg-white/10 px-4 py-1.5 hover:bg-white/20 backdrop-blur transition"
        >
          تسجيل/خروج
        </Link>
      </nav>
    </header>
  );
}
