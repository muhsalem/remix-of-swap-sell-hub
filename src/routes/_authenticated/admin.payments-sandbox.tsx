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
  simulateWebhook,
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
  const simulate = useServerFn(simulateWebhook);
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

  // Filters + pagination
  const [fStatus, setFStatus] = useState<string>("");
  const [fCurrency, setFCurrency] = useState<string>("");
  const [fSearch, setFSearch] = useState<string>("");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");
  const [pageSize, setPageSize] = useState<number>(30);
  const [debouncedSearch, setDebouncedSearch] = useState<string>("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(fSearch.trim()), 300);
    return () => clearTimeout(t);
  }, [fSearch]);

  const filterArgs = {
    limit: pageSize,
    offset: 0,
    status: (fStatus || undefined) as
      | "pending" | "paid" | "failed" | "expired" | "refunded" | undefined,
    currency: fCurrency || undefined,
    search: debouncedSearch || undefined,
    from: fFrom ? new Date(fFrom).toISOString() : undefined,
    to: fTo ? new Date(fTo + "T23:59:59").toISOString() : undefined,
  };

  const modeQ = useQuery({ queryKey: ["fw-mode"], queryFn: () => modeFn() });
  const paymentsQ = useQuery({
    queryKey: ["sandbox-payments", filterArgs],
    queryFn: () => list({ data: filterArgs }),
    refetchInterval: 15_000,
  });
  const rows = paymentsQ.data?.rows ?? [];
  const total = paymentsQ.data?.total ?? 0;
  const hasMore = rows.length < total;

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

  const simulateMut = useMutation({
    mutationFn: (v: {
      paymentId: string;
      scenario: "success" | "failure" | "pending" | "expired";
    }) => simulate({ data: v }),
    onSuccess: (res) => {
      const label =
        res.status === "paid"
          ? "مدفوعة ✅"
          : res.status === "failed"
            ? "فشلت ❌"
            : res.status === "expired"
              ? "منتهية ⌛"
              : "قيد الانتظار ⏳";
      toast.success(`تمت محاكاة Webhook — الحالة الآن: ${label}`);
      qc.invalidateQueries({ queryKey: ["sandbox-payments"] });
    },
    onError: (e: Error) => {
      if (e.message.includes("live_mode")) {
        toast.error("المحاكاة معطّلة في الوضع الحي.");
      } else {
        toast.error(e.message);
      }
    },
  });

  const isSandbox = (modeQ.data?.mode ?? "sandbox") === "sandbox";

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
          <h2 className="font-display text-xl font-extrabold">
            آخر عمليات الدفع و Webhooks
            <span className="ms-2 text-xs font-normal text-muted-foreground">
              ({rows.length}/{total})
            </span>
          </h2>
          <div className="flex items-center gap-3 flex-wrap">
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
              onClick={() => exportPayments(rows, "json", revealSensitive)}
              disabled={!rows.length}
              className="text-xs font-bold px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-stone-soft/40 disabled:opacity-50"
            >
              تصدير JSON ⬇
            </button>
            <button
              onClick={() => exportPayments(rows, "csv", revealSensitive)}
              disabled={!rows.length}
              className="text-xs font-bold px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-stone-soft/40 disabled:opacity-50"
            >
              تصدير CSV ⬇
            </button>
            <button
              onClick={() => paymentsQ.refetch()}
              className="text-xs text-primary font-bold hover:underline"
            >
              تحديث ↻
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="grid md:grid-cols-5 gap-2 mb-3 p-3 rounded-xl border border-border bg-stone-soft/30">
          <label className="text-[11px] font-bold">
            الحالة
            <select
              value={fStatus}
              onChange={(e) => {
                setFStatus(e.target.value);
                setPageSize(30);
              }}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
            >
              <option value="">الكل</option>
              <option value="paid">مدفوعة</option>
              <option value="pending">قيد الانتظار</option>
              <option value="failed">فشلت</option>
              <option value="expired">منتهية</option>
              <option value="refunded">مستردة</option>
            </select>
          </label>
          <label className="text-[11px] font-bold">
            العملة
            <select
              value={fCurrency}
              onChange={(e) => {
                setFCurrency(e.target.value);
                setPageSize(30);
              }}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
            >
              <option value="">الكل</option>
              <option value="SAR">SAR</option>
              <option value="EGP">EGP</option>
            </select>
          </label>
          <label className="text-[11px] font-bold">
            من تاريخ
            <input
              type="date"
              value={fFrom}
              onChange={(e) => {
                setFFrom(e.target.value);
                setPageSize(30);
              }}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
            />
          </label>
          <label className="text-[11px] font-bold">
            إلى تاريخ
            <input
              type="date"
              value={fTo}
              onChange={(e) => {
                setFTo(e.target.value);
                setPageSize(30);
              }}
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs"
            />
          </label>
          <label className="text-[11px] font-bold">
            بحث (UUID / رقم فاتورة / غرض)
            <input
              value={fSearch}
              onChange={(e) => {
                setFSearch(e.target.value);
                setPageSize(30);
              }}
              placeholder="🔎"
              className="mt-1 w-full px-2 py-1.5 rounded-lg border border-border bg-background text-xs font-mono"
            />
          </label>
          {(fStatus || fCurrency || fFrom || fTo || fSearch) && (
            <button
              onClick={() => {
                setFStatus("");
                setFCurrency("");
                setFFrom("");
                setFTo("");
                setFSearch("");
                setPageSize(30);
              }}
              className="md:col-span-5 justify-self-start text-[11px] text-primary font-bold hover:underline"
            >
              مسح الفلاتر
            </button>
          )}
        </div>

        {!revealSensitive && (
          <p className="text-[11px] text-muted-foreground mb-3">
            بطاقات · توقيعات · مفاتيح · Tokens ستظهر كـ <code className="font-mono">••••</code>. فعّل "عرض كامل" للاطلاع الكامل (للتشخيص فقط).
          </p>
        )}

        {paymentsQ.isLoading && <p className="text-sm text-muted-foreground">جارٍ التحميل…</p>}
        {!paymentsQ.isLoading && rows.length === 0 && (
          <p className="text-sm text-muted-foreground">لا توجد عمليات دفع مطابقة.</p>
        )}

        <div className="space-y-3">
          {rows.map((p: any) => {
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

                {isSandbox && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 pt-3 border-t border-dashed border-border">
                    <span className="text-[11px] font-bold text-muted-foreground">
                      محاكاة Webhook:
                    </span>
                    {(
                      [
                        { key: "success", label: "نجاح ✅", cls: "bg-emerald-600 text-white border-emerald-700" },
                        { key: "failure", label: "فشل ❌", cls: "bg-rose-600 text-white border-rose-700" },
                        { key: "pending", label: "قيد الانتظار ⏳", cls: "bg-amber-500 text-white border-amber-600" },
                        { key: "expired", label: "منتهية ⌛", cls: "bg-stone-600 text-white border-stone-700" },
                      ] as const
                    ).map((s) => {
                      const isThis =
                        simulateMut.isPending &&
                        simulateMut.variables?.paymentId === p.id &&
                        simulateMut.variables?.scenario === s.key;
                      return (
                        <button
                          key={s.key}
                          onClick={() =>
                            simulateMut.mutate({ paymentId: p.id, scenario: s.key })
                          }
                          disabled={simulateMut.isPending}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-full border disabled:opacity-50 ${s.cls}`}
                        >
                          {isThis ? "…" : s.label}
                        </button>
                      );
                    })}
                  </div>
                )}
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

        {hasMore && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={() => setPageSize((n) => n + 30)}
              disabled={paymentsQ.isFetching}
              className="text-xs font-bold px-4 py-2 rounded-xl border border-border bg-background hover:bg-stone-soft/40 disabled:opacity-50"
            >
              {paymentsQ.isFetching
                ? "جارٍ التحميل…"
                : `تحميل المزيد (${total - rows.length} متبقّية)`}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

// مفاتيح حساسة (بطاقات، توقيعات، أسرار، Tokens) نطمسها افتراضياً.
const SENSITIVE_KEY_RE =
  /(card|pan|cvv|cvc|cardnumber|card_number|expiry|exp_month|exp_year|holder|signature|sign|hash|hmac|secret|api[_-]?key|apikey|token|access[_-]?token|refresh[_-]?token|password|authorization|auth[_-]?header|otp|iban|account[_-]?number|routing)/i;

function maskValue(v: unknown): unknown {
  if (v == null) return v;
  if (typeof v === "string") {
    if (v.length <= 4) return "••••";
    return `${v.slice(0, 2)}••••${v.slice(-2)} (${v.length})`;
  }
  if (typeof v === "number") return "••••";
  return "••••";
}

function redact(data: unknown): unknown {
  if (data == null) return data;
  if (Array.isArray(data)) return data.map(redact);
  if (typeof data === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(k)) {
        out[k] = maskValue(v);
      } else {
        out[k] = redact(v);
      }
    }
    return out;
  }
  return data;
}

function JsonBlock({
  title,
  data,
  reveal,
}: {
  title: string;
  data: unknown;
  reveal: boolean;
}) {
  const display = reveal ? data : redact(data);
  const hasData = data != null;
  return (
    <div className="rounded-xl border border-border bg-stone-soft/40 p-3">
      <div className="flex items-center justify-between mb-2 gap-2">
        <div className="text-[11px] uppercase tracking-widest font-bold text-muted-foreground">
          {title}
        </div>
        {hasData && (
          <span
            className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              reveal
                ? "bg-amber-100 border-amber-300 text-amber-800"
                : "bg-emerald-100 border-emerald-300 text-emerald-800"
            }`}
          >
            {reveal ? "كامل" : "مطموس"}
          </span>
        )}
      </div>
      {hasData ? (
        <pre className="text-[11px] font-mono max-h-64 overflow-auto whitespace-pre-wrap break-all">
          {JSON.stringify(display, null, 2)}
        </pre>
      ) : (
        <p className="text-[11px] text-muted-foreground">لا توجد بيانات.</p>
      )}
    </div>
  );
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function exportPayments(
  rows: Array<Record<string, unknown>>,
  format: "json" | "csv",
  reveal: boolean,
) {
  const cleaned = rows.map((r) => (reveal ? r : (redact(r) as Record<string, unknown>)));
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  if (format === "json") {
    triggerDownload(
      JSON.stringify(cleaned, null, 2),
      `badel-webhooks-${stamp}.json`,
      "application/json",
    );
    toast.success(`تم تصدير ${cleaned.length} عملية (JSON)`);
    return;
  }
  const cols = [
    "id",
    "created_at",
    "paid_at",
    "status",
    "purpose",
    "amount",
    "currency",
    "country",
    "provider",
    "provider_ref",
    "user_id",
    "raw_request",
    "raw_callback",
  ];
  const header = cols.join(",");
  const body = cleaned
    .map((r) => cols.map((c) => csvCell((r as Record<string, unknown>)[c])).join(","))
    .join("\n");
  triggerDownload(
    `\uFEFF${header}\n${body}`,
    `badel-webhooks-${stamp}.csv`,
    "text/csv",
  );
  toast.success(`تم تصدير ${cleaned.length} عملية (CSV)`);
}
