import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { listRefundableOffers, createRefundRequest } from "@/lib/refunds.functions";
import { REFUND_REASONS, REQUIRED_DOCS, remainingLabel, type RefundReasonCode } from "@/lib/refunds";
import { uploadDisputeAttachment } from "@/lib/storage";
import { useAuth } from "@/lib/auth";
import { RotateCcw, Paperclip, X, Clock, ShieldCheck, FileCheck2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/refunds_/new")({
  head: () => ({
    meta: [
      { title: "طلب استرداد جديد — بادل" },
      { name: "description", content: "ابدأ طلب استرداد خلال 72 ساعة من الاستلام مع رفع المستندات المطلوبة لكل سبب." },
      { property: "og:title", content: "طلب استرداد جديد — بادل" },
      { property: "og:description", content: "نموذج طلب الاسترداد المحمي بضمان بادل مع قائمة المستندات المطلوبة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: NewRefundPage,
});

function NewRefundPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const listFn = useServerFn(listRefundableOffers);
  const createFn = useServerFn(createRefundRequest);

  const { data, isLoading } = useQuery({
    queryKey: ["refundable-offers"],
    queryFn: () => listFn(),
  });

  const [offerId, setOfferId] = useState("");
  const [reason, setReason] = useState<RefundReasonCode>("not_as_described");
  const [details, setDetails] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const eligible = useMemo(
    () => (data?.offers ?? []).filter((o) => !o.expired && !o.hasRequest),
    [data],
  );
  const selected = eligible.find((o) => o.id === offerId);
  const docs = REQUIRED_DOCS[reason];
  const allDocsChecked = docs.every((d) => checked[d]);

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("سجّل الدخول أولاً");
      if (!offerId) throw new Error("اختر الصفقة");
      if (files.length === 0) throw new Error("أرفق مستنداً واحداً على الأقل");
      const paths: string[] = [];
      for (const f of files) paths.push(await uploadDisputeAttachment(f, user.id));
      return await createFn({
        data: { offer_id: offerId, reason_code: reason, details, attachments: paths },
      });
    },
    onSuccess: (res) => {
      toast.success("تم إرسال طلب الاسترداد — سنرد خلال 24 ساعة");
      navigate({ to: "/disputes/$id", params: { id: res.dispute_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-10">
        <Link to="/refunds" className="text-xs text-muted-foreground hover:text-primary mb-4 inline-block">
          ← كل طلبات الاسترداد
        </Link>

        <h1 className="text-2xl font-extrabold flex items-center gap-2 mb-2">
          <RotateCcw className="text-primary" /> طلب استرداد جديد
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          الاسترداد متاح خلال <b>72 ساعة</b> من استلام الغرض. يبقى المبلغ محجوزاً في الضمان حتى صدور القرار.
        </p>

        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            submit.mutate();
          }}
        >
          {/* Offer picker */}
          <section className="bg-card rounded-3xl ring-1 ring-black/5 p-5">
            <h2 className="font-bold text-sm mb-3">1) اختر الصفقة</h2>
            {isLoading ? (
              <div className="h-10 rounded-xl bg-stone-soft animate-pulse" />
            ) : eligible.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                لا توجد صفقات مؤهلة حالياً (تم تجاوز 72 ساعة أو يوجد طلب مفتوح).
              </p>
            ) : (
              <div className="space-y-2">
                {eligible.map((o) => (
                  <label
                    key={o.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl ring-1 cursor-pointer transition-colors ${
                      offerId === o.id ? "ring-primary bg-primary/5" : "ring-black/5 hover:bg-stone-soft"
                    }`}
                  >
                    <span className="flex items-center gap-2 text-sm">
                      <input
                        type="radio"
                        name="offer"
                        value={o.id}
                        checked={offerId === o.id}
                        onChange={() => setOfferId(o.id)}
                        className="accent-current"
                      />
                      صفقة #{o.id.slice(0, 8)} · {o.cash_balance.toLocaleString("ar-EG")} ر.س
                    </span>
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600">
                      <Clock className="size-3.5" /> {remainingLabel(o.deadline)}
                    </span>
                  </label>
                ))}
              </div>
            )}
          </section>

          {/* Reason */}
          <section className="bg-card rounded-3xl ring-1 ring-black/5 p-5">
            <h2 className="font-bold text-sm mb-3">2) سبب الاسترداد</h2>
            <select
              value={reason}
              onChange={(e) => {
                setReason(e.target.value as RefundReasonCode);
                setChecked({});
              }}
              className="w-full rounded-xl bg-stone-soft px-3 py-2.5 text-sm outline-none"
            >
              {REFUND_REASONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>

            <div className="mt-4 rounded-2xl bg-primary/5 ring-1 ring-primary/15 p-4">
              <div className="flex items-center gap-2 text-xs font-bold mb-2">
                <FileCheck2 className="size-4 text-primary" /> المستندات المطلوبة لهذا السبب
              </div>
              <ul className="space-y-1.5">
                {docs.map((d) => (
                  <li key={d}>
                    <label className="flex items-start gap-2 text-xs cursor-pointer">
                      <input
                        type="checkbox"
                        checked={!!checked[d]}
                        onChange={(e) => setChecked((c) => ({ ...c, [d]: e.target.checked }))}
                        className="mt-0.5"
                      />
                      {d}
                    </label>
                  </li>
                ))}
              </ul>
              {!allDocsChecked && (
                <p className="mt-2 text-[11px] text-amber-600 flex items-center gap-1">
                  <AlertTriangle className="size-3.5" /> تأكيد القائمة يسرّع المراجعة ويقلّل رفض الطلب.
                </p>
              )}
            </div>
          </section>

          {/* Details + attachments */}
          <section className="bg-card rounded-3xl ring-1 ring-black/5 p-5">
            <h2 className="font-bold text-sm mb-3">3) الوصف والمرفقات</h2>
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={5}
              minLength={10}
              maxLength={2000}
              required
              placeholder="اشرح ما حدث بالتفصيل: ما الذي يختلف عن الوصف؟ متى استلمت الغرض؟"
              className="w-full rounded-2xl bg-stone-soft px-3 py-2.5 text-sm outline-none resize-y"
            />
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-stone-soft text-xs font-bold hover:bg-primary/10"
              >
                <Paperclip className="size-3.5" /> إرفاق ملفات
              </button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setFiles((f) => [...f, ...Array.from(e.target.files ?? [])].slice(0, 10))}
              />
              {files.map((f, i) => (
                <span key={`${f.name}-${i}`} className="inline-flex items-center gap-1 text-[11px] bg-stone-soft rounded-full px-2.5 py-1">
                  {f.name}
                  <button type="button" onClick={() => setFiles((x) => x.filter((_, j) => j !== i))} aria-label="إزالة">
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              الملفات مخزّنة بشكل خاص ولا يراها إلا أطراف الصفقة وفريق المراجعة.
            </p>
          </section>

          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
              <ShieldCheck className="size-4" /> محمي بضمان بَدِّل
            </span>
            <button
              type="submit"
              disabled={submit.isPending || !offerId || files.length === 0 || details.trim().length < 10}
              className="px-6 py-2.5 rounded-full bg-foreground text-background text-sm font-bold hover:bg-primary transition-colors disabled:opacity-50"
            >
              {submit.isPending ? "جارٍ الإرسال…" : "إرسال طلب الاسترداد"}
            </button>
          </div>
          {selected && (
            <p className="text-[11px] text-muted-foreground text-left">
              نافذة هذه الصفقة: {remainingLabel(selected.deadline)}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}
