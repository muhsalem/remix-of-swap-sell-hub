import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, Clock, XCircle, ArrowRight } from "lucide-react";
import { getPaymentStatus } from "@/lib/payments/fawaterak.functions";
import { formatPrice } from "@/lib/format-price";

interface CallbackSearch {
  pid?: string;
  result?: "success" | "fail" | "pending";
}

export const Route = createFileRoute("/payments/callback")({
  validateSearch: (raw: Record<string, unknown>): CallbackSearch => ({
    pid: typeof raw.pid === "string" ? raw.pid : undefined,
    result:
      raw.result === "success" || raw.result === "fail" || raw.result === "pending"
        ? raw.result
        : undefined,
  }),
  component: PaymentCallback,
  head: () => ({
    meta: [
      { title: "نتيجة الدفع | بدل" },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function PaymentCallback() {
  const { pid, result } = useSearch({ from: "/payments/callback" });
  const fetchStatus = useServerFn(getPaymentStatus);

  const { data, isLoading } = useQuery({
    queryKey: ["payment-status", pid],
    queryFn: () => (pid ? fetchStatus({ data: { paymentId: pid } }) : null),
    enabled: !!pid,
    refetchInterval: (q) => {
      const s = (q.state.data as { status?: string } | undefined)?.status;
      return s === "paid" || s === "failed" || s === "expired" ? false : 2500;
    },
  });

  const status = data?.status ?? (result === "success" ? "pending" : result ?? "pending");

  const tone =
    status === "paid"
      ? { icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", border: "border-emerald-200", title: "تم الدفع بنجاح", desc: "تم تفعيل الخدمة على حسابك تلقائياً." }
      : status === "failed" || status === "expired"
        ? { icon: XCircle, color: "text-red-600", bg: "bg-red-50", border: "border-red-200", title: "لم يكتمل الدفع", desc: "لم نستلم تأكيداً من بوابة الدفع. يمكنك المحاولة مرة أخرى." }
        : { icon: Clock, color: "text-amber-600", bg: "bg-amber-50", border: "border-amber-200", title: "بانتظار تأكيد الدفع…", desc: "قد يستغرق تأكيد البنك لحظات. سنُحدّث الصفحة تلقائياً." };

  const Icon = tone.icon;

  return (
    <main className="min-h-dvh bg-stone-soft py-16 px-4 flex items-start justify-center">
      <div className={`w-full max-w-lg rounded-2xl border ${tone.border} ${tone.bg} p-6 shadow-sm`}>
        <div className="flex items-start gap-3">
          <Icon className={`size-8 ${tone.color} shrink-0`} aria-hidden />
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-foreground">{tone.title}</h1>
            <p className="text-sm text-muted-foreground mt-1">{tone.desc}</p>

            {isLoading && !data && (
              <p className="mt-4 text-xs text-muted-foreground">جاري التحقق من حالة الدفع…</p>
            )}

            {data && (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-muted-foreground">المبلغ:</dt>
                <dd className="font-bold text-foreground tabular-nums">
                  {formatPrice(Number(data.amount), (data.currency as "SAR" | "EGP") ?? "SAR")}
                </dd>
                <dt className="text-muted-foreground">الحالة:</dt>
                <dd className="font-bold text-foreground">
                  {data.status === "paid"
                    ? "مدفوعة"
                    : data.status === "failed"
                      ? "فشلت"
                      : data.status === "expired"
                        ? "منتهية الصلاحية"
                        : "قيد المعالجة"}
                </dd>
                {data.paid_at && (
                  <>
                    <dt className="text-muted-foreground">وقت الدفع:</dt>
                    <dd className="font-bold text-foreground">
                      {new Date(data.paid_at).toLocaleString("ar", { hour: "2-digit", minute: "2-digit" })}
                    </dd>
                  </>
                )}
              </dl>
            )}

            <div className="mt-6 flex flex-wrap gap-2">
              <Link
                to="/"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition"
              >
                <ArrowRight className="size-4" aria-hidden /> العودة للرئيسية
              </Link>
              {status !== "paid" && data?.checkout_url && (
                <a
                  href={data.checkout_url}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border bg-white text-sm font-bold hover:bg-stone-soft transition"
                >
                  إعادة المحاولة
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
