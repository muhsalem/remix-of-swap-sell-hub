import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Power, Coins } from "lucide-react";
import { getPricing, setCommissionEnabled, setDiEnabled } from "@/lib/promotions.functions";

export function CommissionToggle() {
  const qc = useQueryClient();
  const fetchPricing = useServerFn(getPricing);
  const toggle = useServerFn(setCommissionEnabled);
  const { data } = useQuery({ queryKey: ["pricing"], queryFn: () => fetchPricing() });
  const m = useMutation({
    mutationFn: (enabled: boolean) => toggle({ data: { enabled } }),
    onSuccess: () => {
      toast.success("تم التحديث");
      qc.invalidateQueries({ queryKey: ["pricing"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const on = data?.commissionEnabled ?? false;

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-bold"><Power className="size-4" /> عمولة المنصة 3%</div>
          <div className="text-xs text-muted-foreground mt-1">
            {on ? "مفعّلة — تُحصّل من كل صفقة" : "معطّلة — مرحلة النمو (الصفقات مجانية)"}
          </div>
        </div>
        <button
          onClick={() => m.mutate(!on)}
          disabled={m.isPending}
          className={`px-4 py-2 rounded-lg text-sm font-bold ${on ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground"} disabled:opacity-50`}
        >
          {on ? "تعطيل العمولة" : "تفعيل العمولة"}
        </button>
      </div>
    </div>
  );
}
