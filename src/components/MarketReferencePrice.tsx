import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Activity, Database, Loader2, RefreshCw } from "lucide-react";
import { getMarketPrice, type MarketPriceResult } from "@/lib/market-price.functions";
import { LocalPrice } from "@/components/LocalPrice";
import { loadCountry } from "@/lib/currency-fx";

function timeAgo(iso: string) {
  const min = Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 60000));
  if (min < 1) return "الآن";
  if (min < 60) return `منذ ${min} د`;
  const h = Math.floor(min / 60);
  if (h < 24) return `منذ ${h} س`;
  const d = Math.floor(h / 24);
  return `منذ ${d} يوم`;
}

export function MarketReferencePrice({
  category,
  title,
  listingPriceSar,
}: {
  category: string;
  title: string;
  listingPriceSar: number;
}) {
  const [country, setCountry] = useState<"SA" | "EG">(() => {
    try { return loadCountry() === "EGP" ? "EG" : "SA"; } catch { return "SA"; }
  });

  useEffect(() => {
    const onChange = (e: Event) => {
      const c = (e as CustomEvent).detail?.currency;
      setCountry(c === "EGP" ? "EG" : "SA");
    };
    window.addEventListener("badel:country-changed", onChange as EventListener);
    return () => window.removeEventListener("badel:country-changed", onChange as EventListener);
  }, []);

  const q = useQuery<MarketPriceResult>({
    queryKey: ["market-price", category, title, country],
    queryFn: () => getMarketPrice({ data: { category, title, country } }),
    staleTime: 60 * 60 * 1000, // 1h client cache; server cache is 24h
    retry: 1,
  });

  return (
    <div className="mt-3 rounded-xl border border-black/5 bg-white/60 p-3 text-xs">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-muted-foreground font-medium">مرجع السوق الحيّ</span>
        <div className="flex items-center gap-2">
          {q.data && (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[10px] font-bold ${
                q.data.source === "LIVE"
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-100 text-slate-700"
              }`}
              title={`آخر تحديث: ${new Date(q.data.fetched_at).toLocaleString("ar")}`}
            >
              {q.data.source === "LIVE" ? <Activity className="size-3" /> : <Database className="size-3" />}
              {q.data.source}
            </span>
          )}
          <button
            onClick={() => q.refetch()}
            disabled={q.isFetching}
            className="rounded-full p-1 hover:bg-black/5 disabled:opacity-40"
            aria-label="تحديث"
          >
            {q.isFetching ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          </button>
        </div>
      </div>

      {q.isLoading && (
        <div className="text-muted-foreground">جارٍ جلب متوسط السوق…</div>
      )}

      {q.error && (
        <div className="text-destructive">تعذر جلب مرجع السوق</div>
      )}

      {q.data && (
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-muted-foreground">المتوسط</span>
            <span className="font-bold text-sm">
              <LocalPrice sar={q.data.price_sar} />
            </span>
          </div>
          {q.data.price_min_sar && q.data.price_max_sar && (
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-muted-foreground">النطاق</span>
              <span className="font-mono text-[11px] text-muted-foreground">
                <LocalPrice sar={q.data.price_min_sar} /> — <LocalPrice sar={q.data.price_max_sar} />
              </span>
            </div>
          )}
          <div className="flex items-baseline justify-between gap-3 pt-1 border-t border-black/5">
            <span className="text-muted-foreground">الفارق مع سعر الإعلان</span>
            {(() => {
              const diff = listingPriceSar - q.data.price_sar;
              const pct = q.data.price_sar > 0 ? Math.round((diff / q.data.price_sar) * 100) : 0;
              const good = Math.abs(pct) <= 10;
              return (
                <span className={`font-bold ${good ? "text-emerald-600" : diff > 0 ? "text-amber-600" : "text-primary"}`}>
                  {diff > 0 ? "+" : ""}
                  {pct}%
                </span>
              );
            })()}
          </div>
          <div className="text-[10px] text-muted-foreground text-left" dir="ltr">
            {timeAgo(q.data.fetched_at)}
          </div>
        </div>
      )}
    </div>
  );
}
