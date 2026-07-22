import { useEffect, useState } from "react";
import { X, Sparkles, Gift } from "lucide-react";
import { Link } from "@tanstack/react-router";

const KEY = "badel:exit-intent:dismissed";
const SHOW_AFTER_MS = 15_000;

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(KEY)) return;

    let shown = false;
    const show = () => {
      if (shown) return;
      shown = true;
      setOpen(true);
    };

    const onLeave = (e: MouseEvent) => {
      // Desktop: mouse leaves through the top of viewport
      if (e.clientY <= 0) show();
    };

    const timer = window.setTimeout(show, SHOW_AFTER_MS);
    document.addEventListener("mouseleave", onLeave);

    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(KEY, "1");
    setOpen(false);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="exit-intent-title"
      onClick={dismiss}
    >
      <div
        className="relative bg-card rounded-3xl ring-1 ring-black/10 shadow-2xl max-w-md w-full p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={dismiss}
          aria-label="إغلاق"
          className="absolute top-3 left-3 size-8 rounded-full hover:bg-stone-soft flex items-center justify-center text-muted-foreground"
        >
          <X className="size-4" />
        </button>

        <div className="size-14 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
          <Gift className="size-7" />
        </div>

        <h2 id="exit-intent-title" className="font-display text-2xl font-extrabold mb-2">
          قبل ما تمشي...
        </h2>
        <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
          سجّل اهتمامك في قائمة الانتظار واحصل على <strong className="text-foreground">توثيق مجاني لحسابك</strong>
          {" "}عند الإطلاق الرسمي في بلدك.
        </p>

        <div className="flex flex-col gap-2">
          <Link
            to="/waitlist"
            onClick={dismiss}
            className="w-full px-6 py-3 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all inline-flex items-center justify-center gap-2"
          >
            <Sparkles className="size-4" />
            انضم لقائمة الانتظار
          </Link>
          <button
            type="button"
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground py-2"
          >
            لا شكراً، متابعة التصفح
          </button>
        </div>
      </div>
    </div>
  );
}
