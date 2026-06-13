import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { getOffer, respondToOffer, sendMessage, submitReview } from "@/lib/offers.functions";
import { openDispute, listOfferDisputes } from "@/lib/disputes.functions";
import { setShipping, confirmDelivery } from "@/lib/logistics.functions";
import { supabase } from "@/integrations/supabase/client";
import { Nav } from "@/components/Nav";
import { ListingImage } from "@/components/ListingImage";
import { ArrowLeftRight, Check, X, Send, Star, CheckCircle2, Ban, AlertTriangle, Truck } from "lucide-react";
import { PostMatchPanel } from "@/components/PostMatchPanel";

const offerQuery = (id: string) =>
  queryOptions({ queryKey: ["offer", id], queryFn: () => getOffer({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/offers/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(offerQuery(params.id)),
  head: () => ({ meta: [{ title: "تفاصيل المقايضة — بادل بادل" }] }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">العرض غير موجود</div>,
  component: OfferDetailPage,
});

function OfferDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(offerQuery(id));
  const qc = useQueryClient();
  const offer = data.offer as any;
  const isReceiver = offer.to_user === data.userId;
  const otherUserId = isReceiver ? offer.from_user : offer.to_user;
  const otherProfile = isReceiver ? offer.from_profile : offer.to_profile;

  const respondFn = useServerFn(respondToOffer);
  const sendFn = useServerFn(sendMessage);
  const reviewFn = useServerFn(submitReview);

  const respond = useMutation({
    mutationFn: (action: "accept" | "reject" | "complete" | "cancel") =>
      respondFn({ data: { id, action } }),
    onSuccess: (_, action) => {
      toast.success(`تم ${action === "accept" ? "قبول" : action === "reject" ? "رفض" : action === "complete" ? "إكمال" : "إلغاء"} العرض`);
      qc.invalidateQueries({ queryKey: ["offer", id] });
      qc.invalidateQueries({ queryKey: ["my-offers"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [msg, setMsg] = useState("");
  const send = useMutation({
    mutationFn: () => sendFn({ data: { offer_id: id, body: msg } }),
    onSuccess: () => {
      setMsg("");
      qc.invalidateQueries({ queryKey: ["offer", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Realtime: refresh on new messages for this offer
  useEffect(() => {
    const ch = supabase
      .channel(`offer-msgs:${id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `offer_id=eq.${id}` },
        () => qc.invalidateQueries({ queryKey: ["offer", id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  // Disputes
  const disputesFn = useServerFn(listOfferDisputes);
  const { data: disputesData } = useQuery({
    queryKey: ["disputes", id],
    queryFn: () => disputesFn({ data: { offer_id: id } }),
  });
  const disputes = disputesData?.disputes ?? [];

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-5xl mx-auto px-6 py-10">
        <Link to="/offers" className="text-xs text-muted-foreground hover:text-primary mb-4 inline-block">← العودة للصندوق</Link>

        <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 mb-6">
          <div className="grid md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
            <ListingMini listing={offer.offered} title={isReceiver ? "ما يعرضه عليك" : "ما عرضته"} />
            <div className="flex flex-col items-center gap-2">
              <ArrowLeftRight className="size-8 text-primary" />
              {Number(offer.cash_balance) > 0 && (
                <span className="text-xs bg-accent/20 text-accent-foreground px-2 py-1 rounded-full font-bold">
                  + {Number(offer.cash_balance).toLocaleString()} ر.س
                </span>
              )}
              {Number(offer.cash_balance) > 0 && offer.status === "accepted" && (
                <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                  🔒 محجوز في الضمان
                </span>
              )}
              {offer.fairness_score != null && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full font-bold">
                  عدالة {offer.fairness_score}%
                </span>
              )}
            </div>
            <ListingMini listing={offer.requested} title={isReceiver ? "ما يطلبه" : "ما طلبته"} />
          </div>

          {offer.anchor_price_sar && offer.anchor_expires_at && (
            <AnchorBadge price={Number(offer.anchor_price_sar)} expiresAt={offer.anchor_expires_at} status={offer.status} />
          )}


          {offer.message && (
            <div className="mt-6 p-4 bg-stone-soft rounded-2xl text-sm">
              <span className="text-xs text-muted-foreground block mb-1">رسالة العارض:</span>
              {offer.message}
            </div>
          )}

          <div className="mt-6 flex flex-wrap gap-2 justify-end">
            {offer.status === "pending" && isReceiver && (
              <>
                <button onClick={() => respond.mutate("accept")} disabled={respond.isPending}
                  className="px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
                  <Check className="size-4" /> قبول
                </button>
                <button onClick={() => respond.mutate("reject")} disabled={respond.isPending}
                  className="px-5 py-2.5 bg-destructive/10 text-destructive rounded-full text-sm font-bold flex items-center gap-2 hover:bg-destructive/20">
                  <X className="size-4" /> رفض
                </button>
              </>
            )}
            {offer.status === "pending" && !isReceiver && (
              <button onClick={() => respond.mutate("cancel")} disabled={respond.isPending}
                className="px-5 py-2.5 bg-muted rounded-full text-sm font-bold flex items-center gap-2 hover:bg-muted/80">
                <Ban className="size-4" /> إلغاء العرض
              </button>
            )}
            {offer.status === "accepted" && (
              <span className="px-4 py-2.5 bg-primary/10 text-primary rounded-full text-xs font-bold flex items-center gap-2">
                <Truck className="size-4" /> أكمل الشحن والاستلام في الأسفل
              </span>
            )}
            <span className="px-4 py-2.5 bg-stone-soft rounded-full text-xs font-bold">الحالة: {offer.status}</span>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <section className="md:col-span-2 bg-card rounded-3xl ring-1 ring-black/5 p-6 flex flex-col h-[500px]">
            <h2 className="font-bold mb-4 pb-3 border-b border-border">المحادثة مع {otherProfile?.display_name ?? "المستخدم"}</h2>
            <div className="flex-1 overflow-y-auto space-y-3 mb-4">
              {data.messages.length === 0 && (
                <p className="text-center text-sm text-muted-foreground py-12">ابدأ المحادثة لتنسيق المقايضة.</p>
              )}
              {data.messages.map((m: any) => {
                const mine = m.sender_id === data.userId;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                    <div className={`max-w-[75%] px-4 py-2 rounded-2xl text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-stone-soft"}`}>
                      {m.body}
                      <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                        {new Date(m.created_at).toLocaleString("ar")}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <form
              onSubmit={(e) => { e.preventDefault(); if (msg.trim()) send.mutate(); }}
              className="flex gap-2"
            >
              <input
                value={msg}
                onChange={(e) => setMsg(e.target.value)}
                placeholder="اكتب رسالتك..."
                maxLength={2000}
                className="flex-1 px-4 py-2.5 rounded-full bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30"
              />
              <button type="submit" disabled={!msg.trim() || send.isPending}
                className="px-4 py-2.5 bg-primary text-primary-foreground rounded-full font-bold disabled:opacity-50">
                <Send className="size-4" />
              </button>
            </form>
          </section>

          <aside className="space-y-4">
            {offer.status === "completed" && !data.myReview && (
              <ReviewForm offerId={id} reviewedUser={otherUserId} reviewFn={reviewFn} qc={qc} />
            )}
            {data.myReview && (
              <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 text-sm">
                <div className="font-bold mb-1">تقييمك للطرف الآخر</div>
                <div className="flex gap-0.5 mb-2">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-4 ${i < data.myReview!.rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
                  ))}
                </div>
                {data.myReview.comment && <p className="text-xs">{data.myReview.comment}</p>}
              </div>
            )}

            <PostMatchPanel offer={offer} userId={data.userId} qc={qc} />

            {(offer.status === "accepted" || offer.status === "completed") && (
              <ShippingBlock offer={offer} userId={data.userId} qc={qc} />
            )}

            {(offer.status === "accepted" || offer.status === "completed") && (
              <DisputeBlock offerId={id} disputes={disputes} qc={qc} />
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}

function ListingMini({ listing, title }: { listing: any; title: string }) {
  if (!listing) return <div className="text-sm text-muted-foreground">منتج محذوف</div>;
  return (
    <div>
      <div className="text-[11px] text-muted-foreground mb-2">{title}</div>
      <Link to="/listings/$id" params={{ id: listing.id }} className="block bg-stone-soft rounded-2xl p-3 hover:ring-2 ring-primary/30 transition-all">
        <div className="aspect-[4/3] rounded-xl overflow-hidden mb-2">
          <ListingImage path={listing.images?.[0]} alt={listing.title} />
        </div>
        <div className="font-bold text-sm truncate">{listing.title}</div>
        <div className="text-xs text-muted-foreground">{Number(listing.market_price).toLocaleString()} ر.س</div>
      </Link>
    </div>
  );
}

function ReviewForm({ offerId, reviewedUser, reviewFn, qc }: any) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const m = useMutation({
    mutationFn: () => reviewFn({ data: { offer_id: offerId, reviewed_user: reviewedUser, rating, comment } }),
    onSuccess: () => {
      toast.success("شكراً على تقييمك");
      qc.invalidateQueries({ queryKey: ["offer", offerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold mb-3">قيّم الطرف الآخر</h3>
      <div className="flex gap-1 mb-3 justify-center">
        {Array.from({ length: 5 }).map((_, i) => (
          <button key={i} type="button" onClick={() => setRating(i + 1)}>
            <Star className={`size-7 ${i < rating ? "fill-accent text-accent" : "text-muted-foreground"}`} />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={500}
        placeholder="تعليق اختياري..."
        className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none mb-3"
        rows={3}
      />
      <button onClick={() => m.mutate()} disabled={m.isPending}
        className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold disabled:opacity-50">
        إرسال التقييم
      </button>
    </div>
  );
}

function DisputeBlock({ offerId, disputes, qc }: { offerId: string; disputes: any[]; qc: any }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [evidence, setEvidence] = useState("");
  const openFn = useServerFn(openDispute);
  const m = useMutation({
    mutationFn: () => openFn({ data: { offer_id: offerId, reason, evidence } }),
    onSuccess: () => {
      toast.success("تم فتح نزاع — تم تجميد الصفقة للمراجعة");
      setOpen(false);
      setReason("");
      setEvidence("");
      qc.invalidateQueries({ queryKey: ["disputes", offerId] });
      qc.invalidateQueries({ queryKey: ["offer", offerId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
        <AlertTriangle className="size-4 text-destructive" /> النزاعات والضمان
      </h3>
      {disputes.length > 0 ? (
        <div className="space-y-2 mb-3">
          {disputes.map((d) => (
            <div key={d.id} className="text-xs p-2 rounded-lg bg-destructive/5 border border-destructive/20">
              <div className="font-bold">الحالة: {d.status}</div>
              <div className="text-muted-foreground mt-1">{d.reason}</div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground mb-3">لا توجد نزاعات على هذه الصفقة.</p>
      )}
      {!open ? (
        <button onClick={() => setOpen(true)} className="w-full text-xs px-3 py-2 rounded-full bg-destructive/10 text-destructive font-bold hover:bg-destructive/20">
          فتح نزاع
        </button>
      ) : (
        <div className="space-y-2">
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="سبب النزاع..." rows={2}
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none" />
          <textarea value={evidence} onChange={(e) => setEvidence(e.target.value)} placeholder="أدلة/تفاصيل (اختياري)..." rows={2}
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none" />
          <div className="flex gap-2">
            <button onClick={() => m.mutate()} disabled={reason.length < 5 || m.isPending}
              className="flex-1 px-3 py-2 bg-destructive text-destructive-foreground rounded-full text-xs font-bold disabled:opacity-50">
              تأكيد فتح النزاع
            </button>
            <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-full bg-muted text-xs">إلغاء</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ShippingBlock({ offer, userId, qc }: { offer: any; userId: string; qc: any }) {
  const isFrom = offer.from_user === userId;
  const myConfirmed = isFrom ? offer.delivery_confirmed_by_from : offer.delivery_confirmed_by_to;
  const otherConfirmed = isFrom ? offer.delivery_confirmed_by_to : offer.delivery_confirmed_by_from;
  const setShipFn = useServerFn(setShipping);
  const confirmFn = useServerFn(confirmDelivery);
  const [carrier, setCarrier] = useState(offer.shipping_carrier ?? "");
  const [tracking, setTracking] = useState(offer.tracking_number ?? "");
  const [expected, setExpected] = useState(offer.expected_delivery ?? "");

  const ship = useMutation({
    mutationFn: () => setShipFn({ data: { offer_id: offer.id, shipping_carrier: carrier, tracking_number: tracking, expected_delivery: expected || undefined } }),
    onSuccess: () => { toast.success("تم حفظ بيانات الشحن"); qc.invalidateQueries({ queryKey: ["offer", offer.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: () => confirmFn({ data: { offer_id: offer.id } }),
    onSuccess: (r: any) => {
      toast.success(r.completed ? "اكتملت الصفقة 🎉" : "تم تأكيد استلامك — بانتظار الطرف الآخر");
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
        <Truck className="size-4 text-primary" /> الشحن والاستلام
      </h3>

      {offer.tracking_number ? (
        <div className="text-xs space-y-1 mb-3 p-2 bg-stone-soft rounded-lg">
          <div><span className="text-muted-foreground">شركة الشحن:</span> <b>{offer.shipping_carrier}</b></div>
          <div><span className="text-muted-foreground">رقم التتبع:</span> <b>{offer.tracking_number}</b></div>
          {offer.expected_delivery && <div><span className="text-muted-foreground">التسليم المتوقع:</span> {offer.expected_delivery}</div>}
        </div>
      ) : offer.status === "accepted" ? (
        <div className="space-y-2 mb-3">
          <input value={carrier} onChange={(e) => setCarrier(e.target.value)} placeholder="شركة الشحن (سمسا/أرامكس...)"
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none" maxLength={60} />
          <input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="رقم التتبع"
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none" maxLength={80} />
          <input type="date" value={expected} onChange={(e) => setExpected(e.target.value)}
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none" />
          <button onClick={() => ship.mutate()} disabled={!carrier || tracking.length < 3 || ship.isPending}
            className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-full text-xs font-bold disabled:opacity-50">
            حفظ بيانات الشحن
          </button>
        </div>
      ) : null}

      {offer.status === "accepted" && (
        <>
          <div className="text-xs grid grid-cols-2 gap-2 mb-3">
            <div className={`p-2 rounded-lg text-center ${myConfirmed ? "bg-primary/10 text-primary" : "bg-stone-soft"}`}>
              أنت {myConfirmed ? "✓ مؤكِّد" : "بانتظار التأكيد"}
            </div>
            <div className={`p-2 rounded-lg text-center ${otherConfirmed ? "bg-primary/10 text-primary" : "bg-stone-soft"}`}>
              الطرف الآخر {otherConfirmed ? "✓ مؤكِّد" : "بانتظار التأكيد"}
            </div>
          </div>
          <button onClick={() => confirm.mutate()} disabled={myConfirmed || confirm.isPending}
            className="w-full px-3 py-2 bg-foreground text-background rounded-full text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            <CheckCircle2 className="size-4" /> {myConfirmed ? "أكدت استلامك" : "تأكيد استلامي للمنتج"}
          </button>
        </>
      )}
    </div>
  );
}
