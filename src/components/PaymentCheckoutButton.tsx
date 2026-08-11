import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, CreditCard } from "lucide-react";
import { toast } from "sonner";
import { createPaymentIntent } from "@/lib/payments/fawaterak.functions";
import { paymentErrorMessage } from "@/lib/user-error-messages";

type Purpose =
  | "verify_individual"
  | "verify_company"
  | "listing_featured_7d"
  | "listing_featured_30d"
  | "listing_pinned_7d"
  | "listing_boost"
  | "sub_merchant_month"
  | "sub_store_month";

interface Props {
  purpose: Purpose;
  targetId?: string;
  country?: "SA" | "EG";
  label?: string;
  className?: string;
  variant?: "primary" | "outline";
}

/**
 * Reusable checkout button. Creates a Fawaterak invoice via server function
 * and redirects the browser to the hosted checkout URL.
 */
export function PaymentCheckoutButton({
  purpose,
  targetId,
  country,
  label = "ادفع عبر فواتيرك",
  className = "",
  variant = "primary",
}: Props) {
  const [loading, setLoading] = useState(false);
  const start = useServerFn(createPaymentIntent);

  async function onClick() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await start({
        data: { purpose, targetId, country: country ?? "SA" },
      });
      if (!res?.checkoutUrl) throw new Error("no_checkout_url");
      window.location.href = res.checkoutUrl;
    } catch (err) {
      console.error("[checkout]", err);
      const friendly = paymentErrorMessage(err);
      toast.error(friendly.title, {
        description: friendly.description,
        duration: friendly.isRateLimit ? 10000 : 6000,
      });
      setLoading(false);
    }
  }

  const base =
    "inline-flex items-center justify-center gap-2 px-4 py-2.5 min-h-11 rounded-full text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed";
  const style =
    variant === "primary"
      ? "bg-primary text-primary-foreground hover:opacity-90"
      : "border border-border bg-white hover:bg-stone-soft text-foreground";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className={`${base} ${style} ${className}`}
      aria-busy={loading}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden />
      ) : (
        <CreditCard className="size-4" aria-hidden />
      )}
      {loading ? "جاري التحويل للدفع…" : label}
    </button>
  );
}
