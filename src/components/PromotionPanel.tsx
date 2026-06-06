import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Sparkles, Pin, RefreshCw, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  getPricing,
  getMyDiBalance,
  purchaseListingPromotion,
} from "@/lib/promotions.functions";

export function PromotionPanel({ listingId, ownerId, currentUserId }: {
  listingId: string;
  ownerId: string;
  currentUserId: string | null;
}) {
  const qc = useQueryClient();
  const isOwner = currentUserId === ownerId;
  const pricingFn = useServerFn(getPricing);
  const balanceFn = useServerFn(getMyDiBalance);
  const purchaseFn = useServerFn(purchaseListingPromotion);

  const { data: pricingData } = useQuery({ queryKey: ["pricing"], queryFn: () => pricingFn() });
  const { data: balanceData } = useQuery({
    queryKey: ["di-balance", currentUserId],
    queryFn: () => balanceFn(),
    enabled: !!currentUserId,
  });

  const m = useMutation({
    mutationFn: (vars: { kind: "featured" | "pinned" | "boost"; durationDays?: number }) =>
      purchaseFn({ data: { listingId, ...vars } }),
    onSuccess: (res) => {
      toast.success(`تم! خُصم ${res.cost_di} DI`);
      qc.invalidateQueries({ queryKey: ["listing", listingId] });
      qc.invalidateQueries({ queryKey: ["di-balance"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("insufficient") ? "رصيد DI غير كافٍ" : e.message),
  });

  if (!isOwner) return null;
  const p = pricingData?.pricing ?? {};
  const balance = balanceData?.balance ?? 0;

  const items = [
    { key: "featured" as const, icon: Sparkles, title: "إعلان مميز (7 أيام)", cost: p.featured_7d_di, dur: 7 },
    { key: "featured" as const, icon: Sparkles, title: "إعلان مميز (30 يوم)", cost: p.featured_30d_di, dur: 30 },
    { key: "pinned" as const, icon: Pin, title: "تثبيت في الأعلى (7 أيام)", cost: p.pinned_7d_di, dur: 7 },
    { key: "boost" as const, icon: RefreshCw, title: "إعادة نشر فوري", cost: p.boost_di },
  ];

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg">ترقية الإعلان</h3>
        <span className="text-sm text-muted-foreground">رصيدك: {balance.toFixed(0)} DI</span>
      </div>
      <div className="grid gap-2">
        {items.map((it, i) => {
          const Icon = it.icon;
          const cost = Number(it.cost || 0);
          const cant = balance < cost || m.isPending;
          return (
            <button
              key={i}
              disabled={cant}
              onClick={() => m.mutate({ kind: it.key, durationDays: it.dur })}
              className="flex items-center justify-between rounded-xl border border-border p-3 hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed text-right"
            >
              <span className="flex items-center gap-2">
                <Icon className="h-4 w-4 text-primary" />
                <span className="text-sm">{it.title}</span>
              </span>
              <span className="text-sm font-semibold flex items-center gap-1">
                {m.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
                {cost} DI
              </span>
            </button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">يُخصم من رصيدك بالعملة الداخلية DI (1 DI = 5 ر.س).</p>
    </div>
  );
}
