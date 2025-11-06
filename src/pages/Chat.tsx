// src/pages/Chat.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "@/assets/logo2.png";
import {
  Bell,
  Plus,
  Shield,
  Pill,
  BellRing,
  MessageSquareCode,
  LogOut,
  Send,
  Bot,
  Loader2,
  TriangleAlert,
  Home,
  UserRound,
  Sparkles,
} from "lucide-react";
import clsx from "clsx";

/* ============================== الهوية البصرية (مطابقة للداشبورد) ============================== */
const brand = {
  green: "#0E6B43",
  greenHover: "#0f7d4d",
  accent: "#97FC4A",
  secondary: "#0D16D1",
};

/* ============================== Types ============================== */
type Msg = {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  time?: string;
  sourceTag?: string; // وسم المصدر (اختياري)
};

/* ============================== Utilities ============================== */
const nowTime = () =>
  new Date().toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
  });

const starterSuggestions = [
  "حلّل تكرار التشخيص خلال آخر شهر",
  "اعطني ملخص مطالبات التأمين المرفوضة",
  "هل يوجد صرف دواء غير منطقي؟",
  "اقترح تنبيهات ذكية للأطباء",
];

/* ============================== API config (مطابق للداشبورد) ============================== */
// ضعي قيمة الدومين في .env:  VITE_API_BASE_URL=https://api.example.com
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "";

async function httpPost<T>(path: string, body: unknown) {
  const res = await fetch(BASE_URL + path || path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as T;
}

/** Streaming via fetch ReadableStream (UTF-8 text chunks). */
async function streamPost(
  path: string,
  body: unknown,
  onChunk: (text: string) => void
) {
  const res = await fetch(BASE_URL + path || path, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    throw new Error(await res.text());
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    onChunk(decoder.decode(value, { stream: true }));
  }
}

const ENDPOINTS = {
  chat: "/api/assistant/chat", // استجابة كاملة
  stream: "/api/assistant/stream", // استجابة متدفقة (اختياري)
  upload: "/api/files/upload", // اختياري للمرفقات
};

/* ============================== Component ============================== */
export default function Chat() {
  const navigate = useNavigate();

  /* --------------- State --------------- */
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: crypto.randomUUID(),
      role: "assistant",
      content:
        "مرحبًا! أنا مساعدك الذكي لتحليل السجلات الطبية والتأمينية وصرف الأدوية. كيف أستطيع مساعدتك اليوم؟",
      time: nowTime(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useStreaming, setUseStreaming] = useState(true); // يمكنكِ إطفاءه إذا كان الـbackend لا يدعم البثّ

  const scrollRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  /* --------------- Auto scroll --------------- */
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, isTyping, error]);

  /* --------------- Autosize textarea --------------- */
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "0px";
    taRef.current.style.height =
      Math.min(160, taRef.current.scrollHeight) + "px";
  }, [input]);

  /* --------------- Send handlers --------------- */
  const handleSend = async () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    setError(null);

    const userMsg: Msg = {
      id: crypto.randomUUID(),
      role: "user",
      content: trimmed,
      time: nowTime(),
    };

    setMessages((m) => [...m, userMsg]);
    setInput("");

    try {
      setIsTyping(true);

      if (useStreaming) {
        // 1) بثّ تدريجي
        const draftId = crypto.randomUUID();
        setMessages((m) => [
          ...m,
          { id: draftId, role: "assistant", content: "", time: nowTime() },
        ]);

        let buffer = "";
        await streamPost(
          ENDPOINTS.stream,
          { messages: [...messages, userMsg] },
          (chunk) => {
            buffer += chunk;
            setMessages((m) =>
              m.map((msg) =>
                msg.id === draftId ? { ...msg, content: buffer } : msg
              )
            );
          }
        );
      } else {
        // 2) استجابة كاملة
        const res = await httpPost<{ content: string; sourceTag?: string }>(
          ENDPOINTS.chat,
          { messages: [...messages, userMsg] }
        );
        setMessages((m) => [
          ...m,
          {
            id: crypto.randomUUID(),
            role: "assistant",
            content: res.content,
            time: nowTime(),
            sourceTag: res.sourceTag,
          },
        ]);
      }
    } catch (e: any) {
      setError(e?.message || "تعذر الحصول على استجابة من المساعد.");
    } finally {
      setIsTyping(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const onPickSuggestion = (text: string) => {
    setInput(text);
    setTimeout(handleSend, 0);
  };

  const headerTitle = useMemo(() => "مساعد ذكي", []);

  return (
    <div
      className="min-h-screen"
      style={{
        background:
          "linear-gradient(180deg, #F5F7FB 0%, #E9EDF5 100%), radial-gradient(800px 500px at 15% 8%, rgba(146,227,169,0.15), transparent 60%)",
      }}
    >
      <div className="grid grid-cols-[280px_1fr]">
        {/* Sidebar — مطابق للداشبورد */}
        <aside className="min-h-screen border-l bg-white sticky top-0 relative flex flex-col justify-between">
          {/* الشعار في الزاوية العلوية اليمنى */}
          <div className="absolute top-4 right-4">
            <img
              src={logo}
              alt="شعار حصيف الذكي"
              className="w-10 md:w-12 drop-shadow-sm select-none"
            />
          </div>

          {/* محتوى القائمة */}
          <div className="p-6 pt-20 space-y-4 flex-1">
            <nav className="px-4 space-y-2">
              <SideItem
                icon={<Plus className="size-4" />}
                label="السجلات الطبية"
                onClick={() => navigate("/dashboard")}
              />
              <SideItem
                icon={<Shield className="size-4" />}
                label="السجلات التأمينية"
                onClick={() => navigate("/insurance")}
              />
              <SideItem
                icon={<Pill className="size-4" />}
                label="سجلات الأدوية"
                onClick={() => navigate("/drugs")}
              />
              <SideItem
                icon={<BellRing className="size-4" />}
                label="الاشعارات"
                onClick={() => navigate("/notifications")}
              />
              <SideItem
                active
                icon={<MessageSquareCode className="size-4" />}
                label="المساعد ذكي"
              />
            </nav>
          </div>

          <div className="mt-auto px-4 pt-10 pb-6">
            <button
              onClick={() => {
                localStorage.removeItem("haseef_auth");
                sessionStorage.removeItem("haseef_auth");
                navigate("/");
              }}
              className="w-full flex items-center gap-2 justify-between rounded-xl border px-4 py-3 text-right hover:bg-black/5"
            >
              <span className="text-black/80">تسجيل الخروج</span>
              <LogOut className="size-4" />
            </button>
          </div>
        </aside>

        {/* Main */}
        <main className="p-6 md:p-8 relative" dir="rtl">
          {/* زر الرجوع للهوم — نفس النمط */}
          <button
            onClick={() => navigate("/home")}
            className="absolute top-4 right-4 p-2 bg-white border border-black/10 rounded-full shadow-md hover:bg-emerald-50 transition"
            title="العودة للصفحة الرئيسية"
          >
            <Home className="size-5" style={{ color: brand.green }} />
          </button>

          {/* Header */}
          <div className="flex items-center justify-between gap-4 mt-3">
            <div className="flex items-center gap-3">
              <h1
                className="text-xl md:text-2xl font-semibold"
                style={{ color: brand.green }}
              >
                {headerTitle}
              </h1>
              <Sparkles className="size-5 text-[#4C4DE9]" />
            </div>
            <div className="flex items-center gap-3"></div>
          </div>

          {/* Status */}
          {error && (
            <div className="mt-4 flex items-center gap-2 text-red-700 bg-red-50 border border-red-200 px-4 py-3 rounded-xl">
              <TriangleAlert className="size-4" />
              <span className="text-sm">{error}</span>
            </div>
          )}

          {/* Suggestions */}
          <div className="mt-4 flex flex-wrap gap-2">
            {starterSuggestions.map((s) => (
              <button
                key={s}
                onClick={() => onPickSuggestion(s)}
                className="h-9 px-3 rounded-full bg-white border border-black/10 shadow-sm text-sm hover:bg-black/5"
              >
                {s}
              </button>
            ))}

            {/* زر تبديل البثّ */}
            <button
              onClick={() => setUseStreaming((v) => !v)}
              className={clsx(
                "h-9 px-3 rounded-full border text-sm",
                useStreaming
                  ? "bg-[#E8EDFF] border-[#C9D2FF] text-[#0D16D1]"
                  : "bg-white border-black/10 text-black/70"
              )}
              title="التبديل بين استجابة كاملة وبثّ تدريجي"
            >
              {useStreaming ? "وضع البثّ مفعّل" : "وضع البثّ متوقف"}
            </button>
          </div>

          {/* Chat area */}
          <div
            ref={scrollRef}
            className="mt-4 rounded-2xl bg-white border border-black/10 shadow-soft h-[62vh] md:h-[66vh] overflow-y-auto p-4"
          >
            <div className="mx-auto max-w-3xl space-y-3">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}

              {isTyping && (
                <div className="pt-2">
                  <TypingBubble />
                </div>
              )}
            </div>
          </div>

          {/* Composer — بدون مرفقات/مايك/إيموجي */}
          <div className="mt-4 mx-auto max-w-3xl">
            <div className="rounded-2xl bg-white border border-black/10 shadow-soft p-3">
              <div className="flex items-end gap-2">
                <textarea
                  ref={taRef}
                  dir="rtl"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKeyDown}
                  rows={1}
                  placeholder="اكتب رسالتك… (Enter للإرسال • Shift+Enter لسطر جديد)"
                  className="
                    flex-1 resize-none leading-6
                    rounded-xl border border-black/10 bg-white
                    px-3 py-2 text-sm outline-none
                    focus:ring-4 focus:ring-indigo-300/30
                  "
                  style={{ maxHeight: 160 }}
                />

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  className={clsx(
                    "h-10 px-4 rounded-full text-sm font-semibold transition",
                    input.trim() && !isTyping
                      ? "bg-[#4C4DE9] text-white hover:brightness-110"
                      : "bg-black/10 text-black/50 cursor-not-allowed"
                  )}
                  title="إرسال"
                >
                  <div className="flex items-center gap-2">
                    {isTyping && <Loader2 className="size-4 animate-spin" />}
                    <span>إرسال</span>
                    <Send className="size-4" />
                  </div>
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

/* ============================== Sub components (مطابقة للنمط) ============================== */
function SideItem({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        "w-full flex items-center justify-between gap-3 rounded-xl px-4 py-3 transition-colors",
        active ? "text-[#0D16D1] border border-black/10" : "hover:bg-black/5"
      )}
      style={active ? { backgroundColor: brand.accent } : {}}
    >
      <span className="font-medium">{label}</span>
      <span className="opacity-80">{icon}</span>
    </button>
  );
}

function MessageBubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <div
      className={clsx("flex gap-3", isUser ? "flex-row-reverse" : "flex-row")}
      dir="rtl"
    >
      <div
        className={clsx(
          "size-9 rounded-full grid place-items-center shrink-0",
          isUser ? "bg-[#E7E9FF] text-[#0D16D1]" : "bg-[#EAF6FF] text-[#145C8C]"
        )}
        title={isUser ? "أنت" : "المساعد"}
      >
        {isUser ? <UserRound className="size-5" /> : <Bot className="size-5" />}
      </div>

      <div className="max-w-[78%]">
        <div
          className={clsx(
            "rounded-2xl px-4 py-2 leading-7 text-[15px] shadow-sm",
            isUser
              ? "bg-[#F8F9FF] text-white rounded-tr-sm" // خلفية المستخدمض
              : "bg-white text-neutral-900 border border-black/10 rounded-tl-sm"
          )}
        >
          <p className="whitespace-pre-wrap">{msg.content}</p>
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-black/50 px-1">
          <span>{msg.time ?? ""}</span>
          {msg.sourceTag && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/5 px-2 py-[2px]">
              <Sparkles className="size-3" /> {msg.sourceTag}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex gap-3" dir="rtl">
      <div className="size-9 rounded-full grid place-items-center shrink-0 bg-[#EAF6FF] text-[#145C8C]">
        <Bot className="size-5" />
      </div>
      <div className="max-w-[78%]">
        <div className="rounded-2xl px-4 py-2 bg-white border border-black/10 shadow-sm">
          <span className="inline-flex items-center gap-2 text-sm text-black/70">
            المساعد يكتب
            <Dots />
          </span>
        </div>
      </div>
    </div>
  );
}

function Dots() {
  return (
    <span className="inline-flex gap-1">
      <i className="inline-block w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce [animation-delay:-0.2s]" />
      <i className="inline-block w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce [animation-delay:-0.1s]" />
      <i className="inline-block w-1.5 h-1.5 rounded-full bg-black/40 animate-bounce" />
    </span>
  );
}
