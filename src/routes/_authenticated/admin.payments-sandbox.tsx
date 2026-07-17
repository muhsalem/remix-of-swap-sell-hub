import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createPaymentIntent } from "@/lib/payments/fawaterak.functions";
import {
  listRecentPayments,
  getFawaterakMode,
} from "@/lib/payments/sandbox.functions";

export const Route = createFileRoute("/_authenticated/admin/payments-sandbox")({
  component: PaymentsSandbox,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive">
      {error.message}
    </div>
  ),
});

const PURPOSES = [
  { key: "verify_individual", label: "توثيق فرد (سنة)" },
  { key: "verify_company", label: "توثيق شركة (سنة)" },
  { key: "listing_featured_7d", label: "إعلان مميز 7 أيام" },
  { key: "listing_featured_30d", label: "إعلان مميز 30 يوم" },
  { key: "listing_pinned_7d", label: "تثبيت 7 أيام" },
  { key: "listing_boost", label: "تعزيز الإعلان" },
  { key: "sub_merchant_month", label: "اشتراك تاجر شهري" },
  { key: "sub_store_month", label: "اشتراك متجر شهري" },
] as const;

const STATUS_STYLE: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-800 border-emerald-300",
  pending: "bg-amber-100 text-amber-800 border-amber-300",
  failed: "bg-rose-100 text-rose-800 border-rose-300",
  expired: "bg-stone-200 text-stone-700 border-stone-300",
  refunded: "bg-sky-100 text-sky-800 border-sky-300",
};

function PaymentsSandbox() {
  const create = useServerFn(createPaymentIntent);
  const list = useServerFn(listRecentPayments);
  const modeFn = useServerFn(getFawaterakMode);
  const qc = useQueryClient();

  const [purpose, setPurpose] = useState<string>("verify_individual");
  const [country, setCountry] = useState<"SA" | "EG">("SA");
  const [targetId, setTargetId] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revealSensitive, setRevealSensitive] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("badel:reveal-sensitive") === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(
      "badel:reveal-sensitive",
      revealSensitive ? "1" : "0",
    );
  }, [revealSensitive]);

  const modeQ = useQuery({ queryKey: ["fw-mode"], queryFn: () => modeFn() });
  const paymentsQ = useQuery({
    queryKey: ["sandbox-payments"],
    queryFn: () => list({ data: { limit: 30 } }),
    refetchInterval: 15_000,
  });

  // إشعارات فورية عبر Realtime (يشمل كل صفوف الجدول لأن المشرف يرى الجميع).
  useEffect(() => {
    const ch = supabase
      .channel("sandbox-payments")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "payments" },
        () => {
          qc.invalidateQueries({ queryKey: ["sandbox-payments"] });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const startPayment = useMutation({
    mutationFn: () =>
      create({
        data: {
          purpose: purpose as never,
          country,
          targetId: targetId.trim() || undefined,
        },
      }),
    onSuccess: (res) => {
      toast.success(`تم إنشاء الفاتورة (${res.amount} ${res.currency})`);
      qc.invalidateQueries({ queryKey: ["sandbox-payments"] });
      if (res.checkoutUrl) window.open(res.checkoutUrl, "_blank");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const needsTarget = purpose.startsWith("listing_");

  return (
    <div dir="rtl" className="min-h-screen bg-background p-6 max-w-6xl mx-auto font-body">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
        <h1 className="font-display text-3xl font-extrabold">مختبر المدفوعات (Sandbox)</h1>
        <Link to="/admin" className="text-primary text-sm font-bold hover:underline">
          ← لوحة المشرف
        </Link>
      </div>

      {modeQ.data && (
        <div
          className={`p-4 rounded-2xl border mb-6 text-sm flex flex-wrap gap-3 items-center ${
            modeQ.data.mode === "live"
              ? "bg-rose-50 border-rose-300"
              : "bg-amber-50 border-amber-300"
          }`}
        >
          <span className="font-bold">
            وضع فواتيرك: <b className="uppercase">{modeQ.data.mode}</b>
          </span>
          <span>API Key: {modeQ.data.hasApiKey ? "✓" : "✗"}</span>
          <span>Vendor Key: {modeQ.data.hasVendorKey ? "✓" : "✗"}</span>
        </div>
      )}

      <section className="p-5 rounded-2xl border border-border bg-card mb-8">
        <h2 className="font-display text-xl font-extrabold mb-4">إنشاء فاتورة اختبار</h2>
        <div className="grid md:grid-cols-3 gap-3">
          <label className="text-xs">
            الغرض
            <select
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              {PURPOSES.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            الدولة / العملة
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value as "SA" | "EG")}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background"
            >
              <option value="SA">السعودية (SAR)</option>
              <option value="EG">مصر (EGP)</option>
            </select>
          </label>
          <label className="text-xs">
            معرّف الإعلان (لغرض إعلاني فقط)
            <input
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              placeholder="UUID"
              disabled={!needsTarget}
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background disabled:opacity-50 font-mono text-[11px]"
            />
          </label>
        </div>
        <button
          onClick={() => startPayment.mutate()}
          disabled={startPayment.isPending || (needsTarget && !targetId.trim())}
          className="mt-4 px-5 py-2.5 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-50"
        >
          {startPayment.isPending ? "جارٍ الإنشاء…" : "إنشاء وفتح صفحة الدفع"}
        </button>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h2 className="font-display text-xl font-extrabold">آخر عمليات الدفع و Webhooks</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-bold cursor-pointer select-none">
              <input
                type="checkbox"
                checked={revealSensitive}
                onChange={(e) => setRevealSensitive(e.target.checked)}
                className="h-4 w-4 accent-foreground"
              />
              <span>
                {revealSensitive ? "عرض كامل ⚠️" : "طمس الحقول الحساسة"}
              </span>
            </label>
            <button
              onClick={() => paymentsQ.refetch()}
              className="text-xs text-primary font-bold hover:underline"
            >
              تحديث ↻
            </button>
          </div>
        </div>

        {!revealSensitive && (
          <p className="text-[11px] text-muted-foreground mb-3">
            بطاقات · توقيعات · مفاتيح · Tokens ستظهر كـ <code className="font-mono">••••</code>. فعّل "عرض كامل" للاطلاع الكامل (للتشخيص فقط).
          </p>
        )}

        {paymentsQ.isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {paymentsQ.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد عمليات دفع بعد.</p>
        )}

        <div className="space-y-3">
          {paymentsQ.data?.map((p) => {
            const open = expandedId === p.id;
            return (
              <div
                key={p.id}
                className="p-4 rounded-2xl border border-border bg-card text-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${
                          STATUS_STYLE[p.status] ?? "bg-stone-100 border-stone-300"
                        }`}
                      >
                        {p.status}
                      </span>
                      <span className="font-bold">{p.purpose}</span>
                      <span className="text-muted-foreground">
                        {p.amount} {p.currency}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1 font-mono truncate">
                      id: {p.id}
                      {p.provider_invoice_id && ` · invoice: ${p.provider_invoice_id}`}
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      أُنشئت: {new Date(p.created_at).toLocaleString("ar")}
                      {p.paid_at &&
                        ` · دُفعت: ${new Date(p.paid_at).toLocaleString("ar")}`}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    {p.checkout_url && (
                      <a
                        href={p.checkout_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-primary font-bold hover:underline"
                      >
                        صفحة الدفع ↗
                      </a>
                    )}
                    <button
                      onClick={() => setExpandedId(open ? null : p.id)}
                      className="text-xs font-bold text-primary hover:underline"
                    >
                      {open ? "إخفاء" : "عرض الحمولة"}
                    </button>
                  </div>
                </div>
                {open && (
                  <div className="mt-3 grid md:grid-cols-2 gap-3">
                    <JsonBlock
                      title="raw_request (إلى فواتيرك)"
                      data={p.raw_request}
                      reveal={revealSensitive}
                    />
                    <JsonBlock
                      title="raw_callback (Webhook)"
                      data={p.raw_callback}
                      reveal={revealSensitive}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

function JsonBlock({ title, data }: { title: string; data: unknown }) {
  return (
    <div className="rounded-xl border border-border bg-stone-soft/40 p-3">
      <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground mb-2">
        {title}
      </div>
      {data ? (
        <pre className="text-[11px] font-mono max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(data, null, 2)}
        </pre>
      ) : (
        <p className="text-[11px] text-muted-foreground">لا توجد بيانات.</p>
      )}
    </div>
  );
}
