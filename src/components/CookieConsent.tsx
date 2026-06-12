import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Cookie, X } from "lucide-react";

const KEY = "badel:cookie-consent";
type Choice = "all" | "essential";

export function CookieConsent() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      if (!localStorage.getItem(KEY)) setOpen(true);
    } catch { /* ignore */ }
  }, []);

  const save = (choice: Choice) => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ choice, at: Date.now() }));
    } catch { /* ignore */ }
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      dir="rtl"
      role="dialog"
      aria-label="إعدادات الكوكيز"
      className="fixed bottom-3 inset-x-3 md:inset-x-auto md:right-4 md:max-w-md z-[60] rounded-2xl bg-card text-foreground shadow-2xl ring-1 ring-border p-4 animate-in fade-in slide-in-from-bottom-2"
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <Cookie className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-extrabold mb-1">نحترم خصوصيتك</div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            نستخدم كوكيز ضرورية لتشغيل المنصة، وكوكيز تحليلية اختيارية لتحسين تجربتك. يمكنك التغيير لاحقاً من{" "}
            <Link to="/legal/$doc" params={{ doc: "privacy" }} className="underline text-primary">سياسة الخصوصية</Link>.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={() => save("all")}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:opacity-90"
            >
              قبول الكل
            </button>
            <button
              onClick={() => save("essential")}
              className="px-3 py-1.5 rounded-lg bg-muted text-foreground text-xs font-bold hover:bg-muted/80"
            >
              الضرورية فقط
            </button>
          </div>
        </div>
        <button
          onClick={() => save("essential")}
          aria-label="إغلاق"
          className="p-1 text-muted-foreground hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
