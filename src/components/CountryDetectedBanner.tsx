import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FX_VS_SAR, loadCountry, saveCountry } from "@/lib/currency-fx";
import { detectCountryServer } from "@/lib/geo.functions";
import { track } from "@/lib/analytics";
import { MapPin, Check, X, Info, Globe2, Radio } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DISMISS_KEY = "badel:country-banner-dismissed";
const CONFIRMED_KEY = "badel:country-confirmed";

// Launch markets get priority; the rest are available inside the modal.
const LAUNCH: Array<"SAR" | "EGP"> = ["SAR", "EGP"];

type SupportedCode = keyof typeof FX_VS_SAR;

/**
 * Small banner that appears on first visit. Clicking "تأكيد" or "خيارات"
 * opens a modal explaining how detection worked and lets the user pick
 * a different currency from all supported markets before saving.
 */
export function CountryDetectedBanner() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detected, setDetected] = useState<SupportedCode>("SAR");
  const [selected, setSelected] = useState<SupportedCode>("SAR");
  const [source, setSource] = useState<string>("client-fallback");
  const trackedRef = useRef(false);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const sourceId = useId();

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (localStorage.getItem(CONFIRMED_KEY) === "1") return;
    } catch { /* ignore */ }

    const current = loadCountry() as SupportedCode;
    setDetected(current);
    setSelected(current);

    detectCountryServer()
      .then((r) => {
        const detectedCode: SupportedCode =
          r?.country && FX_VS_SAR[r.country] ? (r.country as SupportedCode) : current;
        const src = r?.source || "client-fallback";
        setSource(src);
        setDetected(detectedCode);
        setSelected(detectedCode);
        if (!trackedRef.current) {
          trackedRef.current = true;
          void track("country_detected", {
            detected: detectedCode,
            local: current,
            source: src,
            matches_local: detectedCode === current,
          });
        }
      })
      .catch(() => {
        if (!trackedRef.current) {
          trackedRef.current = true;
          void track("country_detected", {
            detected: current,
            local: current,
            source: "client-fallback",
            matches_local: true,
          });
        }
      });

    setVisible(true);
  }, []);

  const sortedCodes = useMemo<SupportedCode[]>(() => {
    const all = Object.keys(FX_VS_SAR) as SupportedCode[];
    const rest = all.filter((c) => !LAUNCH.includes(c as "SAR" | "EGP"));
    return [...LAUNCH, ...rest];
  }, []);

  // Keyboard: Esc dismisses banner while modal is closed.
  useEffect(() => {
    if (!visible || modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, modalOpen]);

  // Auto-hide after 10s of inactivity: silently accept the detected country
  // and persist so the banner does not re-appear next visit.
  useEffect(() => {
    if (!visible || modalOpen) return;
    const t = window.setTimeout(() => {
      try {
        saveCountry(detected);
        localStorage.setItem(CONFIRMED_KEY, "1");
      } catch { /* ignore */ }
      void track("country_confirmed", {
        action: "auto_timeout",
        country: detected,
        source,
        timeout_ms: 10000,
      });
      setVisible(false);
    }, 10000);
    return () => window.clearTimeout(t);
  }, [visible, modalOpen, detected, source]);

  if (!visible) return null;

  const fx = FX_VS_SAR[detected];
  const selFx = FX_VS_SAR[selected];
  const sourceLabel =
    source === "edge-header"
      ? "من عنوان الاتصال (Edge Header)"
      : "من إعدادات المتصفح واللغة";
  const sourceShort = source === "edge-header" ? "شبكة الاتصال" : "لغة المتصفح";

  const openModal = () => setModalOpen(true);

  const save = () => {
    saveCountry(selected);
    try { localStorage.setItem(CONFIRMED_KEY, "1"); } catch { /* ignore */ }
    void track("country_confirmed", {
      action: selected === detected ? "confirm" : "switch",
      country: selected,
      from: detected,
      source,
    });
    setModalOpen(false);
    setVisible(false);
  };

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    void track("country_confirmed", { action: "dismiss", country: detected, source });
    setModalOpen(false);
    setVisible(false);
  };

  return (
    <>
      <section
        className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:left-auto md:max-w-md z-40 rounded-2xl border border-border bg-white/95 backdrop-blur shadow-xl p-4 animate-in slide-in-from-bottom-4"
        role="region"
        aria-labelledby={titleId}
        aria-describedby={`${descId} ${sourceId}`}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 size-10 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center">
            <MapPin className="size-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-sm font-bold text-foreground">
              اكتشفنا موقعك: <span aria-hidden="true">{fx.flag}</span> {fx.label}
            </h2>
            <p id={descId} className="text-xs text-muted-foreground mt-0.5">
              سنعرض الأسعار بـ <span className="font-bold text-foreground">{fx.symbol}</span>
            </p>
            <p
              id={sourceId}
              className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-stone-soft/70 text-[11px] font-bold text-foreground"
            >
              <Radio className="size-3" aria-hidden="true" />
              <span className="sr-only">مصدر الاكتشاف: </span>
              اكتُشف عبر: {sourceShort}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                ref={primaryBtnRef}
                type="button"
                onClick={openModal}
                aria-haspopup="dialog"
                aria-expanded={modalOpen}
                aria-label={`تأكيد أو تغيير العملة الحالية ${fx.label} ${fx.symbol}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Check className="size-3.5" aria-hidden="true" /> تأكيد أو تغيير
              </button>
              <button
                type="button"
                onClick={openModal}
                aria-haspopup="dialog"
                aria-expanded={modalOpen}
                aria-label="عرض تفاصيل كيف تم اكتشاف الدولة"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-full border border-border bg-white text-xs font-bold hover:bg-stone-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Info className="size-3.5" aria-hidden="true" /> كيف تم الاكتشاف؟
              </button>
            </div>
            <p className="sr-only">اضغط Escape لإغلاق هذه اللافتة.</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="إغلاق لافتة تأكيد الدولة"
            className="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-full hover:bg-stone-soft text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="size-5 text-primary" aria-hidden />
              تأكيد الدولة والعملة
            </DialogTitle>
            <DialogDescription>
              اختر العملة التي تريد عرض الأسعار بها. يمكنك تغييرها لاحقاً من أعلى الصفحة.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-stone-soft/60 p-3 text-xs leading-relaxed">
            <div className="font-bold text-foreground mb-1 flex items-center gap-1.5">
              <Info className="size-3.5" aria-hidden /> كيف اكتشفنا موقعك؟
            </div>
            <div className="text-muted-foreground">
              الاكتشاف الحالي: <span aria-hidden>{fx.flag}</span>{" "}
              <span className="font-bold text-foreground">{fx.label}</span> — المصدر: {sourceLabel}.
              {source === "edge-header"
                ? " نستخدم رأس CDN لتحديد الدولة تقريبياً دون تخزين عنوان IP."
                : " لم نتمكن من قراءة رأس الشبكة، فاعتمدنا على لغة المتصفح."}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xs font-bold text-foreground mb-2">اختر العملة</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pe-1">
              {sortedCodes.map((code) => {
                const c = FX_VS_SAR[code];
                const isSel = selected === code;
                const isDetected = detected === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelected(code)}
                    className={`text-right rounded-xl border p-2.5 transition ${
                      isSel
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border bg-white hover:bg-stone-soft"
                    }`}
                    aria-pressed={isSel}
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="text-lg">{c.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">{code} · {c.symbol}</div>
                      </div>
                      {isSel && <Check className="size-4 text-primary shrink-0" aria-hidden />}
                    </div>
                    {isDetected && (
                      <div className="mt-1 text-[10px] text-primary font-bold">مكتشَف تلقائياً</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-border bg-white text-xs font-bold hover:bg-stone-soft transition"
            >
              ليس الآن
            </button>
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1.5 justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition"
            >
              <Check className="size-3.5" aria-hidden />
              حفظ ({selFx.symbol} {selFx.label})
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
