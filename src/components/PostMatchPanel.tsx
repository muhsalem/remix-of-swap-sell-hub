import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Phone, MessageCircle, MapPin, Calendar, Upload, Wallet, CheckCircle2, Lock, Coins } from "lucide-react";
import {
  getPeerContact, setMeetup, saveReceiptUrl, getFeeStatus, payPlatformFee,
} from "@/lib/post-match.functions";
import { getPricing } from "@/lib/promotions.functions";
import { supabase } from "@/integrations/supabase/client";
import { useUserCurrency } from "@/components/LocalPrice";
import { computeFee, fmtLocal } from "@/lib/tax-config";

type Props = { offer: any; userId: string; qc: ReturnType<typeof useQueryClient> };

export function PostMatchPanel({ offer, userId, qc }: Props) {
  if (offer.status !== "accepted" && offer.status !== "completed") return null;

  return (
    <div className="space-y-4">
      <ProgressStepper offer={offer} />
      <ContactCard offerId={offer.id} />
      <MeetupBlock offer={offer} userId={userId} qc={qc} />
      <ReceiptBlock offer={offer} userId={userId} qc={qc} />
      <FeeBlock offer={offer} qc={qc} />
    </div>
  );
}

function ProgressStepper({ offer }: { offer: any }) {
  const steps = [
    { key: "accepted", label: "قبول", done: true },
    { key: "fee", label: "دفع العمولة", done: !!offer.fee_paid_at || Number(offer.cash_balance ?? 0) === 0 },
    { key: "delivery", label: "تسليم/لقاء", done: !!offer.receipt_url || offer.delivery_confirmed_by_from || offer.delivery_confirmed_by_to },
    { key: "completed", label: "إكمال", done: offer.status === "completed" },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-bold text-sm">مراحل ما بعد القبول</h3>
        <span className="text-xs text-muted-foreground font-mono">{pct}%</span>
      </div>
      <div className="h-2 bg-stone-soft rounded-full overflow-hidden mb-3">
        <div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} />
      </div>
      <ol className="grid grid-cols-4 gap-1 text-[10px]">
        {steps.map((s, i) => (
          <li key={s.key} className={`text-center px-1 py-2 rounded-lg ${s.done ? "bg-primary/10 text-primary font-bold" : "bg-stone-soft text-muted-foreground"}`}>
            <div className="size-5 mx-auto mb-1 grid place-items-center rounded-full bg-background ring-1 ring-current">{s.done ? "✓" : i + 1}</div>
            {s.label}
          </li>
        ))}
      </ol>
    </div>
  );
}

function ContactCard({ offerId }: { offerId: string }) {
  const fn = useServerFn(getPeerContact);
  const { data, isLoading } = useQuery({
    queryKey: ["peer-contact", offerId],
    queryFn: () => fn({ data: { offer_id: offerId } }),
  });
  const peer = data?.peer;
  return (
    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Phone className="size-4 text-primary" /> بيانات التواصل المباشر
      </h3>
      {isLoading ? (
        <p className="text-xs text-muted-foreground">جاري التحميل…</p>
      ) : peer ? (
        <div className="space-y-2 text-sm">
          <div className="font-bold">{peer.display_name}</div>
          {peer.contact_phone ? (
            <a href={`tel:${peer.contact_phone}`} className="flex items-center gap-2 text-primary hover:underline">
              <Phone className="size-3.5" /> {peer.contact_phone}
            </a>
          ) : <p className="text-xs text-muted-foreground">— لم يضع رقم هاتف</p>}
          {peer.whatsapp ? (
            <a target="_blank" rel="noreferrer" href={`https://wa.me/${peer.whatsapp.replace(/[^0-9]/g, "")}`}
              className="flex items-center gap-2 text-emerald-600 hover:underline">
              <MessageCircle className="size-3.5" /> واتساب: {peer.whatsapp}
            </a>
          ) : <p className="text-xs text-muted-foreground">— لم يضع واتساب</p>}
          <p className="text-[10px] text-muted-foreground pt-2 border-t border-primary/10">
            🔒 يُمنع تبادل أي مبالغ خارج المنصة قبل دفع العمولة.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">لا توجد بيانات تواصل بعد. اطلب من الطرف الآخر إضافتها من صفحته الشخصية.</p>
      )}
    </div>
  );
}

function MeetupBlock({ offer, userId, qc }: { offer: any; userId: string; qc: any }) {
  const [loc, setLoc] = useState(offer.meetup_location ?? "");
  const [when, setWhen] = useState(offer.meetup_at ? new Date(offer.meetup_at).toISOString().slice(0, 16) : "");
  const fn = useServerFn(setMeetup);
  const m = useMutation({
    mutationFn: () => fn({ data: { offer_id: offer.id, meetup_location: loc, meetup_at: when } }),
    onSuccess: () => { toast.success("تم حفظ موعد ومكان اللقاء"); qc.invalidateQueries({ queryKey: ["offer", offer.id] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const isParty = offer.from_user === userId || offer.to_user === userId;
  if (!isParty) return null;
  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <MapPin className="size-4 text-primary" /> لقاء التسليم اليدوي
      </h3>
      <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="المكان (مثال: محطة مترو الملك عبدالله)"
        className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs mb-2 outline-none" />
      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)}
        className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs mb-2 outline-none" />
      <button onClick={() => m.mutate()} disabled={loc.length < 2 || !when || m.isPending}
        className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-full text-xs font-bold disabled:opacity-50">
        <Calendar className="size-3 inline ml-1" /> حفظ الموعد
      </button>
      {offer.meetup_at && (
        <p className="text-[11px] text-muted-foreground mt-2 text-center">
          الموعد الحالي: {new Date(offer.meetup_at).toLocaleString("ar")}
        </p>
      )}
    </div>
  );
}

function ReceiptBlock({ offer, userId, qc }: { offer: any; userId: string; qc: any }) {
  const [uploading, setUploading] = useState(false);
  const saveFn = useServerFn(saveReceiptUrl);
  const isParty = offer.from_user === userId || offer.to_user === userId;
  if (!isParty) return null;

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) return toast.error("الحد الأقصى 5MB");
    setUploading(true);
    try {
      const path = `${offer.id}/${Date.now()}_${f.name.replace(/[^\w.-]/g, "_")}`;
      const { error } = await supabase.storage.from("trade-receipts").upload(path, f, { upsert: false });
      if (error) throw error;
      await saveFn({ data: { offer_id: offer.id, receipt_url: path } });
      toast.success("تم رفع الإيصال");
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
    } catch (err: any) {
      toast.error(err.message ?? "فشل الرفع");
    } finally {
      setUploading(false);
    }
  }

  async function viewReceipt() {
    if (!offer.receipt_url) return;
    const { data } = await supabase.storage.from("trade-receipts").createSignedUrl(offer.receipt_url, 300);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Upload className="size-4 text-primary" /> إيصال التسليم
      </h3>
      {offer.receipt_url ? (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-emerald-600">
            <CheckCircle2 className="size-3.5" /> تم رفع الإيصال
          </div>
          <button onClick={viewReceipt} className="text-xs px-3 py-1.5 bg-stone-soft rounded-full hover:bg-stone-soft/70">
            عرض الإيصال
          </button>
        </div>
      ) : (
        <label className="block">
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} disabled={uploading} className="hidden" />
          <span className={`block text-center text-xs px-3 py-2 border-2 border-dashed border-primary/40 rounded-xl cursor-pointer hover:bg-primary/5 ${uploading ? "opacity-50" : ""}`}>
            {uploading ? "جاري الرفع…" : "📎 ارفع صورة/PDF للإيصال (≤5MB)"}
          </span>
        </label>
      )}
    </div>
  );
}

function FeeBlock({ offer, qc }: { offer: any; qc: any }) {
  const fn = useServerFn(getFeeStatus);
  const payFn = useServerFn(payPlatformFee);
  const pricingFn = useServerFn(getPricing);
  const { data, isLoading } = useQuery({
    queryKey: ["fee-status", offer.id],
    queryFn: () => fn({ data: { offer_id: offer.id } }),
  });
  const { data: pricing } = useQuery({ queryKey: ["pricing"], queryFn: () => pricingFn() });
  const diOn = pricing?.diEnabled ?? false;
  const [diAmt, setDiAmt] = useState(0);
  const [cashAmt, setCashAmt] = useState(0);

  const pay = useMutation({
    mutationFn: () => payFn({ data: { offer_id: offer.id, di_amount: diOn ? diAmt : 0, cash_amount: cashAmt } }),
    onSuccess: () => {
      toast.success("تم دفع العمولة ✅");
      qc.invalidateQueries({ queryKey: ["fee-status", offer.id] });
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading || !data) return null;

  // Derive user's country → currency → tax profile
  const { country } = useUserCurrency();
  const dealSar = Math.max(data.cashBalance ?? 0, 50);
  const fee = computeFee(dealSar, country);
  const { profile, baseLocal, vatLocal, totalLocal } = fee;
  const vatPct = Math.round(profile.vatRate * 100);

  const effDi = diOn ? diAmt : 0;
  const totalCoveredSar = effDi * 5 + cashAmt;
  const enough = totalCoveredSar >= fee.totalSar;
  const missingLocal = Math.max(0, (fee.totalSar - totalCoveredSar) * profile.perSAR);

  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
        <Wallet className="size-4 text-primary" /> عمولة المنصة ({Math.round(profile.feeRate * 100)}%)
        <span className="mr-auto text-[10px] font-normal text-muted-foreground">
          {profile.flag} {profile.label}
        </span>
      </h3>

      <div className="text-xs space-y-1 mb-3 p-2 bg-stone-soft rounded-lg">
        <div className="flex justify-between"><span>العمولة قبل الضريبة:</span><b>{fmtLocal(baseLocal, profile)}</b></div>
        {profile.vatRate > 0 ? (
          <div className="flex justify-between text-muted-foreground">
            <span>ضريبة القيمة المضافة ({vatPct}%):</span>
            <span>{fmtLocal(vatLocal, profile)}</span>
          </div>
        ) : (
          <div className="text-[10px] text-muted-foreground">لا تُطبَّق ضريبة قيمة مضافة في {profile.label}</div>
        )}
        <div className="flex justify-between border-t border-border/60 pt-1 mt-1">
          <span className="font-bold">الإجمالي المطلوب:</span>
          <b className="text-primary">{fmtLocal(totalLocal, profile)}</b>
        </div>
        {profile.code !== "SA" && (
          <div className="text-[10px] text-muted-foreground pt-1">
            ≈ {fee.totalSar.toFixed(2)} ر.س (يُخصم من الرصيد الداخلي بالريال ثم يُحوَّل)
          </div>
        )}
        {diOn && (
          <div className="flex justify-between pt-1"><span>رصيد DI لديك:</span><b>{data.diBalance.toFixed(2)} DI</b></div>
        )}
      </div>

      {data.paid ? (
        <div className="flex items-center gap-2 text-xs text-emerald-600 font-bold">
          <CheckCircle2 className="size-4" /> العمولة مدفوعة — يمكنكم إكمال الصفقة
          {data.fee && (
            <span className="text-[10px] font-normal text-muted-foreground mr-auto">
              {Number(data.fee.paid_di) > 0 && `${Number(data.fee.paid_di).toFixed(1)} DI`}
              {Number(data.fee.paid_di) > 0 && Number(data.fee.paid_cash_sar) > 0 && " + "}
              {Number(data.fee.paid_cash_sar) > 0 && `${Number(data.fee.paid_cash_sar).toFixed(0)} ر.س`}
            </span>
          )}
        </div>
      ) : !data.isInitiator ? (
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Lock className="size-3.5" /> بانتظار دفع المبادر للعمولة
        </div>
      ) : (
        <div className="space-y-2">
          {diOn && (
            <div>
              <label className="text-[11px] text-muted-foreground flex items-center gap-1 mb-1">
                <Coins className="size-3" /> DI (1 DI = 5 ر.س)
              </label>
              <input type="number" min={0} max={data.diBalance} step={0.1} value={diAmt}
                onChange={(e) => setDiAmt(Math.max(0, Number(e.target.value)))}
                className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none" />
            </div>
          )}
          <div>
            <label className="text-[11px] text-muted-foreground mb-1 block">
              نقدي ({profile.symbol}) — تُخصم بالمعادل بالريال
            </label>
            <input type="number" min={0} step={0.5} value={cashAmt}
              onChange={(e) => setCashAmt(Math.max(0, Number(e.target.value)))}
              className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none"
              placeholder={`أدخل المبلغ بالريال (${profile.symbol} ≈ ${(1 / profile.perSAR).toFixed(2)} ر.س)`} />
          </div>
          <div className={`text-[11px] text-center font-bold ${enough ? "text-emerald-600" : "text-destructive"}`}>
            {enough
              ? `✓ التغطية كافية (${fmtLocal(totalCoveredSar * profile.perSAR, profile)})`
              : `ينقص ${fmtLocal(missingLocal, profile)}`}
          </div>
          <button onClick={() => pay.mutate()} disabled={!enough || pay.isPending}
            className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-full text-xs font-bold disabled:opacity-50">
            دفع {fmtLocal(totalLocal, profile)} الآن
          </button>
          <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
            {profile.einvoiceNote} · {profile.taxAuthority}
          </p>
          {!diOn && (
            <p className="text-[10px] text-muted-foreground text-center">
              الدفع نقدي فقط في المرحلة الأولى. العملة الداخلية (DI) ستُتاح لاحقاً.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
