// src/components/SmartChat.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Send, Paperclip, X, Maximize2, Minimize2 } from "lucide-react";
import clsx from "clsx";

type ChatMsg = {
  id: string;
  role: "user" | "assistant";
  text: string;
  files?: File[];
};

type SmartChatProps = {
  side?: "right" | "left"; // مكان زر الفتح
  themeColor?: string; // لون التمييز (أخضر حصيف)
  context?: string; // سياق اختياري
};

const SmartChat: React.FC<SmartChatProps> = ({
  side = "right",
  themeColor = "#0E6B43",
}) => {
  const [open, setOpen] = useState(false);
  const [isFull, setIsFull] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([
    { id: "m1", role: "assistant", text: "كيف أساعدك في السجلات الطبية؟" },
  ]);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // حدود الشهر الحالي للأسئلة الجاهزة
  const monthBounds = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
        d.getDate()
      ).padStart(2, "0")}`;
    return { from: fmt(start), to: fmt(end), today: fmt(new Date()) };
  }, []);

  // ✅ 5 أسئلة جاهزة فقط
  const QUICK_ITEMS: { label: string; query: string }[] = [
    {
      label: "أكثر الأطباء تسجيلاً هذا الشهر",
      query: `from:${monthBounds.from} to:${monthBounds.to}`,
    },
    {
      label: "السجلات العاجلة هذا الشهر",
      query: `emer:Y from:${monthBounds.from} to:${monthBounds.to}`,
    },
    { label: "السجلات المحوّلة", query: `ref:Y` },
    { label: "حالات السكري (E11)", query: `icd:E11` },
    { label: "سجلات اليوم", query: `on:${monthBounds.today}` },
  ];

  useEffect(() => {
    if (!open) return;
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [msgs, open]);

  // إرسال يدوي من مربع الإدخال
  const send = () => {
    if (!text.trim() && files.length === 0) return;
    const mine: ChatMsg = {
      id: String(Date.now()),
      role: "user",
      text: text.trim(),
      files,
    };
    setMsgs((m) => [
      ...m,
      mine,
      { id: String(Date.now() + 1), role: "assistant", text: "تم الاستلام 🤝" },
    ]);
    setText("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  // عند اختيار سؤال جاهز: أظهر النص الجميل في الدردشة وشغّل البحث باستعلام خام
  const applyQuick = (item: { label: string; query: string }) => {
    // رسالة المستخدم بالعبارة العربية
    setMsgs((m) => [
      ...m,
      { id: String(Date.now()), role: "user", text: item.label },
    ]);

    // إشعار صفحة السجلات لتشغيل البحث
    try {
      window.dispatchEvent(
        new CustomEvent("med:runQuick", { detail: { query: item.query } })
      );
    } catch {
      // لا شيء
    }

    // رد مختصر اختياري
    setMsgs((m) => [
      ...m,
      {
        id: String(Date.now() + 1),
        role: "assistant",
        text: "تم الاستعلام ✅",
      },
    ]);

    // تفريغ الإدخال
    setText("");
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      {/* زر الفتح */}
      <button
        onClick={() => setOpen(true)}
        className={clsx(
          "fixed z-[80] rounded-full shadow-xl px-4 h-12 flex items-center gap-2 text-white transition-transform hover:scale-105",
          side === "right" ? "bottom-28 right-6" : "bottom-28 left-6"
        )}
        style={{
          background:
            "linear-gradient(135deg, #0D16D1 0%, #2341ff 60%, #5f7bff 120%)",
        }}
        aria-label="المساعد الطبي"
      >
        <Bot className="size-5" />
        <span className="font-semibold hidden sm:inline">المساعد الطبي</span>
      </button>

      {/* نافذة الشات */}
      {open && (
        <div
          className={clsx(
            "fixed z-[90] transition-all duration-500 ease-in-out rounded-2xl overflow-hidden backdrop-blur-md",
            isFull ? "inset-0 m-auto w-[100vw] h-[100vh]" : "bottom-4",
            side === "right" && !isFull ? "right-6" : "",
            side === "left" && !isFull ? "left-6" : ""
          )}
          style={{
            width: isFull ? "100vw" : "min(500px, 94vw)",
            height: isFull ? "100vh" : "72vh",
            background: "rgba(255,255,255,0.85)",
            border: `2px solid ${themeColor}`,
            boxShadow: "0 10px 25px rgba(0,0,0,0.05)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* الهيدر */}
          <div
            className="flex items-center justify-between px-4 py-3 border-b"
            style={{ borderColor: "rgba(0,0,0,0.1)" }}
          >
            <div className="flex items-center gap-2">
              <span
                className="w-9 h-9 rounded-xl grid place-items-center text-white"
                style={{
                  background: "linear-gradient(135deg,#0D16D1 0%,#2341ff 80%)",
                }}
              >
                <Bot className="size-5" />
              </span>
              <div className="font-semibold text-gray-800">المساعد الطبي</div>
            </div>
            <div className="flex items-center gap-2">
              <button
                className="p-2 rounded-lg hover:bg-black/5"
                onClick={() => setIsFull((v) => !v)}
                title={isFull ? "تصغير" : "تكبير"}
              >
                {isFull ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </button>
              <button
                className="p-2 rounded-lg hover:bg_black/5"
                onClick={() => {
                  setOpen(false);
                  setIsFull(false);
                }}
                title="إغلاق"
              >
                <X className="size-5" />
              </button>
            </div>
          </div>

          {/* شريط الأسئلة الجاهزة */}
          <div
            className="border-b px-3 py-2 bg-white/60"
            style={{ borderColor: "rgba(0,0,0,0.08)" }}
          >
            <div className="text-[12px] text-emerald-900/80 mb-1">
              الأسئلة الجاهزة
            </div>
            <div className="flex flex-wrap gap-2">
              {QUICK_ITEMS.map((it) => (
                <button
                  key={it.label}
                  onClick={() => applyQuick(it)}
                  className="h-8 px-3 rounded-full text-[12px] border hover:bg-emerald-50"
                  style={{
                    borderColor: "rgba(14,107,67,0.35)",
                    color: "#0B5A38",
                  }}
                  title={it.query}
                >
                  {it.label}
                </button>
              ))}
            </div>
          </div>

          {/* الرسائل */}
          <div ref={listRef} className="flex-1 overflow-auto p-4 space-y-3">
            {msgs.map((m) => (
              <div
                key={m.id}
                className={clsx(
                  "flex",
                  m.role === "user" ? "justify-start" : "justify-end"
                )}
              >
                <div
                  className={clsx(
                    "max-w-[80%] rounded-2xl px-3 py-2 text-[14px] shadow-sm",
                    m.role === "user"
                      ? "bg-emerald-50 text-emerald-900"
                      : "text-white"
                  )}
                  style={
                    m.role === "assistant"
                      ? { background: themeColor }
                      : { border: `1px solid ${themeColor}` }
                  }
                >
                  <div className="whitespace-pre-wrap leading-6">
                    {m.text || (m.files?.length ? "‹ملف مرفق›" : "")}
                  </div>
                  {m.files?.length ? (
                    <div className="mt-2 text-[12px] opacity-90">
                      {m.files.map((f) => (
                        <div key={f.name}>📎 {f.name}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>

          {/* الإدخال */}
          <div
            className="border-t p-3 flex items-end gap-2"
            style={{
              borderColor: "rgba(0,0,0,0.1)",
              paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
              background: "rgba(255,255,255,0.85)",
            }}
          >
            <button
              onClick={() => fileRef.current?.click()}
              className="h-11 w-11 rounded-xl grid place-items-center border hover:bg-black/5 flex-shrink-0"
              style={{ borderColor: "rgba(0,0,0,0.1)" }}
              title="إرفاق ملف"
            >
              <Paperclip className="size-5" />
            </button>
            <input
              ref={fileRef}
              type="file"
              className="hidden"
              multiple
              onChange={(e) => setFiles(Array.from(e.target.files || []))}
            />

            <textarea
              rows={2}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="اكتب رسالتك..."
              className="flex-1 rounded-2xl border px-3 py-2 outline-none resize-y"
              style={{
                borderColor: "rgba(0,0,0,0.1)",
                background: "rgba(255,255,255,0.7)",
                minHeight: 44,
                maxHeight: 140,
              }}
            />
            <button
              onClick={send}
              className="h-11 px-5 rounded-xl text-white font-semibold shadow flex-shrink-0"
              style={{
                background: `linear-gradient(135deg, ${themeColor} 0%, #13A06E 80%)`,
              }}
            >
              <div className="flex items-center gap-2">
                <Send className="size-4" />
                إرسال
              </div>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default SmartChat;
