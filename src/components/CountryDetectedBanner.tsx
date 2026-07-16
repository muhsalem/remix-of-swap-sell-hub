import { useEffect, useState } from "react";
import { FX_VS_SAR, loadCountry, saveCountry } from "@/lib/currency-fx";
import { detectCountryServer } from "@/lib/geo.functions";
import { MapPin, Check, X } from "lucide-react";

const DISMISS_KEY = "badel:country-banner-dismissed";
const CONFIRMED_KEY = "badel:country-confirmed";

/**
 * Visible banner that tells the user which country/currency was auto-detected
 * and offers a one-click confirm or a quick switch to the other launch market.
 * Only shows once per browser (until dismissed or confirmed).
 */
export function CountryDetectedBanner() {
  const [visible, setVisible] = useState(false);
  const [country, setCountry] = useState<"SAR" | "EGP">("SAR");
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (localStorage.getItem(CONFIRMED_KEY) === "1") return;
    } catch { /* ignore */ }

    const current = loadCountry() as "SAR" | "EGP";
    setCountry(current);

    // Enrich with edge-header source label if available
    detectCountryServer()
      .then((r) => {
        if (r?.source) setSource(r.source);
        if (r?.country && (r.country === "SAR" || r.country === "EGP")) {
          setCountry(r.country);
        }
      })
      .catch(() => { /* silent */ });

    setVisible(true);
  }, []);

  if (!visible) return null;

  const fx = FX_VS_SAR[country];
  const other: "SAR" | "EGP" = country === "SAR" ? "EGP" : "SAR";
  const otherFx = FX_VS_SAR[other];

  const confirm = () => {
    saveCountry(country);
    try { localStorage.setItem(CONFIRMED_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };
  const switchTo = () => {
    saveCountry(other);
    setCountry(other);
    try { localStorage.setItem(CONFIRMED_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };
  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    setVisible(false);
  };

  return (
    <div
      className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:left-auto md:max-w-md z-40 rounded-2xl border border-border bg-white/95 backdrop-blur shadow-xl p-4 animate-in slide-in-from-bottom-4"
      role="dialog"
      aria-label="تأكيد الدولة والعملة"
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 size-10 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center">
          <MapPin className="size-5" aria-hidden />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-bold text-foreground">
            اكتشفنا موقعك: <span aria-hidden>{fx.flag}</span> {fx.label}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            سنعرض الأسعار بـ <span className="font-bold text-foreground">{fx.symbol}</span>
            {source === "edge-header" ? " (حسب عنوان الاتصال)" : " (حسب إعدادات المتصفح)"}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              type="button"
              onClick={confirm}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition"
            >
              <Check className="size-3.5" aria-hidden /> تأكيد
            </button>
            <button
              type="button"
              onClick={switchTo}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-white text-xs font-bold hover:bg-stone-soft transition"
            >
              <span aria-hidden>{otherFx.flag}</span>
              التبديل إلى {otherFx.label} ({otherFx.symbol})
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label="إغلاق"
          className="shrink-0 p-1 rounded-full hover:bg-stone-soft text-muted-foreground"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
