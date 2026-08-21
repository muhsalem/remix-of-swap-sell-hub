import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "badel:installDismissed";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
      if (document.readyState === "complete") onLoad();
      else window.addEventListener("load", onLoad, { once: true });
    }

    const handler = (e: Event) => {
      e.preventDefault();
      try {
        if (localStorage.getItem(DISMISS_KEY) === "1") return;
      } catch { /* ignore */ }
      setDeferred(e as BIPEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  if (!visible || !deferred) return null;

  const dismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
  };

  return (
    <div className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:w-80 z-50 rounded-2xl bg-card ring-1 ring-border shadow-lg p-4 flex items-start gap-3">
      <div className="flex-1">
        <p className="text-sm font-bold text-foreground">ثبّت تطبيق بَدِّل</p>
        <p className="text-xs text-muted-foreground mt-1 leading-6">
          وصول أسرع وإشعارات فورية للمقايضات المطابقة لرغباتك.
        </p>
        <button
          onClick={async () => {
            try {
              await deferred.prompt();
              await deferred.userChoice;
            } catch { /* ignore */ }
            dismiss();
          }}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-foreground text-background text-xs font-bold hover:bg-primary transition-colors"
        >
          <Download className="size-3.5" /> تثبيت
        </button>
      </div>
      <button onClick={dismiss} aria-label="إغلاق" className="p-1 rounded-full hover:bg-stone-soft">
        <X className="size-4 text-muted-foreground" />
      </button>
    </div>
  );
}
