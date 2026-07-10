import { useEffect, useState } from "react";
import { FX_VS_SAR, loadCountry } from "@/lib/currency-fx";
import { formatAmount, formatSAR } from "@/lib/format-price";

/**
 * Auto-displays a SAR amount in the user's local currency, based on their
 * saved country (localStorage). Falls back to SAR on SSR/first paint to
 * avoid hydration mismatch.
 */
export function useUserCurrency() {
  const [country, setCountry] = useState<string>("SAR");
  useEffect(() => {
    setCountry(loadCountry());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "badel:country") setCountry(loadCountry());
    };
    const onCustom = () => setCountry(loadCountry());
    window.addEventListener("storage", onStorage);
    window.addEventListener("badel:country-changed", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("badel:country-changed", onCustom as EventListener);
    };
  }, []);
  const fx = FX_VS_SAR[country] ?? FX_VS_SAR.SAR;
  return { country, fx };
}


export function LocalPrice({
  sar,
  className,
  showOriginal = false,
  fractionDigits,
}: {
  sar: number | string;
  className?: string;
  showOriginal?: boolean;
  fractionDigits?: number;
}) {
  const { country, fx } = useUserCurrency();
  const n = Number(sar) || 0;
  const local = n * fx.perSAR;
  const txt = formatAmount(local, fractionDigits);
  return (
    <span
      className={className}
      title={country !== "SAR" ? `≈ ${formatSAR(n)}` : undefined}
    >
      {txt} <span className="opacity-80 font-extrabold">{fx.symbol}</span>
      {showOriginal && country !== "SAR" && (
        <span className="text-[10px] opacity-60 mr-1">({formatSAR(n)})</span>
      )}
    </span>
  );
}

