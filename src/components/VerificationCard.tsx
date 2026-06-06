import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { getPricing, getMyDiBalance, purchaseVerification, purchaseMerchantSubscription } from "@/lib/promotions.functions";

export function VerificationCard() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const pricingFn = useServerFn(getPricing);
  const balanceFn = useServerFn(getMyDiBalance);
  const verifyFn = useServerFn(purchaseVerification);
  const subFn = useServerFn(purchaseMerchantSubscription);

  const { data: pricing } = useQuery({ queryKey: ["pricing"], queryFn: () => pricingFn() });
  const { data: balance } = useQuery({
    queryKey: ["di-balance", user?.id],
    queryFn: () => balanceFn(),
    enabled: !!user,
  });
  const { data: profile } = useQuery({
    queryKey: ["my-profile-badge", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("verified_badge, verified_until")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const buyVerify = useMutation({
    mutationFn: () => verifyFn(),
    onSuccess: (r) => {
      toast.success(`تم التوثيق! خُصم ${r.cost_di} DI`);
      qc.invalidateQueries({ queryKey: ["my-profile-badge"] });
      qc.invalidateQueries({ queryKey: ["di-balance"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("insufficient") ? "رصيد DI غير كافٍ" : e.message),
  });
  const buySub = useMutation({
    mutationFn: (tier: "merchant" | "store") => subFn({ data: { tier } }),
    onSuccess: (r) => {
      toast.success(`تم الاشتراك! خُصم ${r.cost_di} DI`);
      qc.invalidateQueries({ queryKey: ["di-balance"] });
      qc.invalidateQueries({ queryKey: ["my-subscription"] });
    },
    onError: (e: Error) => toast.error(e.message.includes("insufficient") ? "رصيد DI غير كافٍ" : e.message),
  });

  const p = pricing?.pricing ?? {};
  const bal = balance?.balance ?? 0;
  const isVerified = profile?.verified_badge && profile?.verified_until && new Date(profile.verified_until) > new Date();

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-lg flex items-center gap-2"><BadgeCheck className="size-5 text-primary" /> التوثيق وباقات التجار</h3>
        <span className="text-sm text-muted-foreground">رصيدك: {bal.toFixed(0)} DI</span>
      </div>

      <div className="rounded-xl border border-border p-4 flex items-center justify-between">
        <div>
          <div className="font-bold">توثيق الحساب (سنوي)</div>
          <div className="text-xs text-muted-foreground">
            {isVerified
              ? `موثّق حتى ${new Date(profile!.verified_until!).toLocaleDateString("ar")}`
              : "شارة موثّق + ثقة أعلى من المقايضين"}
          </div>
        </div>
        <button
          onClick={() => buyVerify.mutate()}
          disabled={buyVerify.isPending || bal < Number(p.verify_individual_year_di || 0)}
          className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50 inline-flex items-center gap-2"
        >
          {buyVerify.isPending && <Loader2 className="size-3 animate-spin" />}
          {isVerified ? "تجديد" : "وثّق الآن"} · {p.verify_individual_year_di} DI
        </button>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="rounded-xl border border-border p-4">
          <div className="font-bold">باقة تاجر</div>
          <div className="text-xs text-muted-foreground mb-3">إعلانات أكثر + ترويج مجاني شهري</div>
          <button
            onClick={() => buySub.mutate("merchant")}
            disabled={buySub.isPending || bal < Number(p.sub_merchant_month_di || 0)}
            className="w-full px-3 py-2 rounded-lg bg-foreground text-background text-sm font-bold disabled:opacity-50"
          >
            اشترك شهرياً · {p.sub_merchant_month_di} DI
          </button>
        </div>
        <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <div className="font-bold">باقة متجر</div>
          <div className="text-xs text-muted-foreground mb-3">واجهة متجر + ترويج موسّع + أولوية دعم</div>
          <button
            onClick={() => buySub.mutate("store")}
            disabled={buySub.isPending || bal < Number(p.sub_store_month_di || 0)}
            className="w-full px-3 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
          >
            اشترك شهرياً · {p.sub_store_month_di} DI
          </button>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">يُخصم من رصيدك بالعملة الداخلية DI (1 DI = 5 ر.س).</p>
    </div>
  );
}
