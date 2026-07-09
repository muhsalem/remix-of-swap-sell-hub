import { useEffect, useState } from "react";
import { loadCountry, saveCountry, FX_VS_SAR } from "@/lib/currency-fx";

/**
 * Compact toggle to switch the display currency for the whole site.
 * Launch scope: Saudi Arabia (SAR) + Egypt (EGP).
 * All prices rendered via <LocalPrice /> reflect the choice instantly.
 */
export function CountrySwitcher({ className = "" }: { className?: string }) {
  const [country, setCountry] = useState<string>("SAR");
  useEffect(() => { setCountry(loadCountry()); }, []);

  const options: { code: "SAR" | "EGP"; label: string }[] = [
    { code: "SAR", label: "السعودية" },
    { code: "EGP", label: "مصر" },
  ];

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-white/70 backdrop-blur px-1 py-1 text-xs ${className}`}
      role="group"
      aria-label="عملة العرض"
      title="غيّر عملة عرض الأسعار في السوق"
    >
      <span className="px-2 text-[10px] font-bold text-muted-foreground uppercase">الأسعار</span>
      {options.map((o) => {
        const fx = FX_VS_SAR[o.code];
        const active = country === o.code;
        return (
          <button
            key={o.code}
            type="button"
            onClick={() => { saveCountry(o.code); setCountry(o.code); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-bold transition ${
              active ? "bg-primary text-primary-foreground shadow-sm" : "text-foreground/70 hover:bg-stone-soft"
            }`}
            aria-pressed={active}
          >
            <span aria-hidden>{fx.flag}</span>
            <span>{fx.symbol}</span>
          </button>
        );
      })}
    </div>
  );
}
