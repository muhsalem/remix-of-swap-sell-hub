import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { Truck, Package, CheckCircle2, MapPin, Clock, Loader2, AlertTriangle } from "lucide-react";
import {
  quoteShipping,
  bookShipment,
  getShipmentTracking,
  listShippingCities,
} from "@/lib/shipping.functions";
import { confirmDelivery } from "@/lib/logistics.functions";
import { LocalPrice } from "@/components/LocalPrice";

type Offer = {
  id: string;
  status: string;
  from_user: string;
  to_user: string;
  tracking_number?: string | null;
  delivery_confirmed_by_from?: boolean;
  delivery_confirmed_by_to?: boolean;
};

const STATUS_LABEL: Record<string, string> = {
  created: "إنشاء الشحنة",
  picked_up: "تم الاستلام",
  in_transit: "مركز الفرز",
  in_transit_out: "في الطريق",
  out_for_delivery: "خرجت للتسليم",
  delivered: "تم التسليم",
};

export function ShipmentPanel({ offer, userId }: { offer: Offer; userId: string }) {
  const qc = useQueryClient();
  const quoteFn = useServerFn(quoteShipping);
  const bookFn = useServerFn(bookShipment);
  const trackFn = useServerFn(getShipmentTracking);
  const confirmFn = useServerFn(confirmDelivery);
  const citiesFn = useServerFn(listShippingCities);

  const isFrom = offer.from_user === userId;
  const myConfirmed = isFrom ? offer.delivery_confirmed_by_from : offer.delivery_confirmed_by_to;
  const otherConfirmed = isFrom ? offer.delivery_confirmed_by_to : offer.delivery_confirmed_by_from;

  const citiesQ = useQuery({
    queryKey: ["shipping-cities"],
    queryFn: () => citiesFn(),
    staleTime: Infinity,
  });

  const trackQ = useQuery({
    queryKey: ["shipment", offer.id],
    queryFn: () => trackFn({ data: { offer_id: offer.id } }),
    enabled: !!offer.tracking_number,
    refetchInterval: 20_000,
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [weight, setWeight] = useState<number>(2);
  const [declared, setDeclared] = useState<number>(500);
  const [quote, setQuote] = useState<any>(null);

  const q = useMutation({
    mutationFn: () =>
      quoteFn({ data: { from_city: from, to_city: to, weight_kg: weight, declared_value_sar: declared } }),
    onSuccess: (r) => setQuote(r),
    onError: (e: Error) => toast.error(e.message),
  });

  const book = useMutation({
    mutationFn: () =>
      bookFn({ data: { offer_id: offer.id, from_city: from, to_city: to, weight_kg: weight, declared_value_sar: declared } }),
    onSuccess: (r) => {
      toast.success(`تم حجز الشحنة — رقم التتبع: ${r.tracking_number}`);
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
      qc.invalidateQueries({ queryKey: ["shipment", offer.id] });
    },
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

  // --- Booked view ---
  if (offer.tracking_number) {
    const events = trackQ.data?.events ?? [];
    const shipInfo: any = trackQ.data?.offer;
    return (
      <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
        <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
          <Truck className="size-4 text-primary" /> تتبع الشحنة
          <span className="ms-auto text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
            {shipInfo?.shipping_provider ?? "BadelShip"}
          </span>
        </h3>

        <div className="text-xs bg-stone-soft rounded-xl p-3 mb-3 space-y-1">
          <div className="flex items-center gap-2">
            <Package className="size-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">رقم التتبع:</span>
            <b className="font-mono">{offer.tracking_number}</b>
          </div>
          {shipInfo?.from_city && (
            <div className="flex items-center gap-2">
              <MapPin className="size-3.5 text-muted-foreground" />
              <span>{shipInfo.from_city} ← {shipInfo.to_city}</span>
              {shipInfo.shipment_weight_kg && <span className="text-muted-foreground">· {shipInfo.shipment_weight_kg} كجم</span>}
            </div>
          )}
          {shipInfo?.shipping_cost_sar != null && (
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">تكلفة الشحن:</span>
              <b><LocalPrice sar={Number(shipInfo.shipping_cost_sar)} /></b>
            </div>
          )}
          {shipInfo?.expected_delivery && (
            <div className="flex items-center gap-2">
              <Clock className="size-3.5 text-muted-foreground" />
              <span className="text-muted-foreground">التسليم المتوقع:</span>
              <span>{shipInfo.expected_delivery}</span>
            </div>
          )}
        </div>

        {trackQ.isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground py-4 justify-center">
            <Loader2 className="size-4 animate-spin" /> جاري تحميل التتبع…
          </div>
        ) : (
          <ol className="relative border-s-2 border-primary/20 ps-4 space-y-3 mb-4">
            {events.map((e: any, i: number) => {
              const isLast = i === events.length - 1;
              return (
                <li key={i} className="relative">
                  <span className={`absolute -start-[22px] top-0.5 size-3 rounded-full ring-2 ring-background ${isLast ? "bg-primary" : "bg-primary/40"}`} />
                  <div className="text-xs font-bold">{STATUS_LABEL[e.status] ?? e.status}</div>
                  <div className="text-[11px] text-muted-foreground">{e.description}</div>
                  <div className="text-[10px] text-muted-foreground/70">
                    {new Date(e.event_at).toLocaleString("ar")} · {e.location}
                  </div>
                </li>
              );
            })}
            {events.length === 0 && (
              <li className="text-xs text-muted-foreground">لم تُسجَّل أحداث تتبع بعد.</li>
            )}
          </ol>
        )}

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
            <button
              onClick={() => confirm.mutate()}
              disabled={!!myConfirmed || confirm.isPending}
              className="w-full px-3 py-2 bg-foreground text-background rounded-full text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="size-4" />
              {myConfirmed ? "أكدت استلامك" : "تأكيد استلامي للمنتج"}
            </button>
          </>
        )}
      </div>
    );
  }

  // --- Quote & Book flow ---
  if (offer.status !== "accepted") {
    return (
      <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
        <h3 className="font-bold mb-2 flex items-center gap-2 text-sm">
          <Truck className="size-4 text-primary" /> الشحن
        </h3>
        <p className="text-xs text-muted-foreground">يتاح حجز الشحن بعد قبول العرض من الطرفين.</p>
      </div>
    );
  }

  const cities = citiesQ.data ?? [];
  const saCities = cities.filter((c: any) => c.country === "SA");
  const egCities = cities.filter((c: any) => c.country === "EG");
  const groupByRegion = (list: any[]) => {
    const m: Record<string, any[]> = {};
    for (const c of list) {
      const k = c.region_ar || c.name_ar;
      (m[k] ||= []).push(c);
    }
    return m;
  };
  const saGroups = groupByRegion(saCities);
  const egGroups = groupByRegion(egCities);
  const renderGroups = (flag: string, groups: Record<string, any[]>) =>
    Object.entries(groups).map(([region, list]) => (
      <optgroup key={`${flag}-${region}`} label={`${flag} ${region}`}>
        {list.map((c: any) => <option key={c.code} value={c.code}>{c.name_ar}</option>)}
      </optgroup>
    ));

  // ── Smart validation + suggestions ──────────────────────────────────
  const fromCity = cities.find((c: any) => c.code === from);
  const toCity = cities.find((c: any) => c.code === to);
  type Issue = { code: "no_from" | "no_to" | "bad_from" | "bad_to" | "cross_border" | "bad_weight" | "bad_value" | "same_city"; msg: string; suggest?: { code: string; name_ar: string; region_ar: string }[] };
  let issue: Issue | null = null;
  if (!from) issue = { code: "no_from", msg: "اختر مدينة المنشأ." };
  else if (!fromCity) issue = { code: "bad_from", msg: `الرمز \"${from}\" غير مدعوم — اختر من القائمة.` };
  else if (!to) issue = { code: "no_to", msg: "اختر مدينة الوجهة." };
  else if (!toCity) issue = { code: "bad_to", msg: `الرمز \"${to}\" غير مدعوم — اختر من القائمة.` };
  else if (fromCity.country !== toCity.country) {
    const same = cities
      .filter((c: any) => c.country === fromCity.country && c.code !== fromCity.code)
      .sort((a: any, b: any) => (a.region_ar === fromCity.region_ar ? -1 : 1))
      .slice(0, 4);
    issue = {
      code: "cross_border",
      msg: `الشحن الدولي غير مفعّل. المنشأ في ${fromCity.country === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"} والوجهة في ${toCity.country === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"}. اختر وجهة داخل نفس البلد:`,
      suggest: same,
    };
  } else if (from === to) issue = { code: "same_city", msg: "مدينة المنشأ والوجهة متطابقتان — اختر وجهة مختلفة." };
  else if (!Number.isFinite(weight) || weight <= 0) issue = { code: "bad_weight", msg: "الوزن يجب أن يكون أكبر من صفر." };
  else if (weight > 200) issue = { code: "bad_weight", msg: "الحد الأقصى للوزن 200 كجم." };
  else if (!Number.isFinite(declared) || declared < 0) issue = { code: "bad_value", msg: "القيمة المُعلنة يجب ألا تقل عن صفر." };
  else if (declared > 500000) issue = { code: "bad_value", msg: "الحد الأقصى للقيمة المُعلنة 500,000 ر.س." };


  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
        <Truck className="size-4 text-primary" /> حجز الشحن (Sandbox)
        <span className="ms-auto text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
          BadelShip · {saCities.length + egCities.length} مدينة
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-[11px] text-muted-foreground">
          من مدينة
          <select
            value={from}
            onChange={(e) => { setFrom(e.target.value); setQuote(null); }}
            className="mt-1 w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none"
          >
            <option value="">اختر…</option>
            {renderGroups("🇸🇦", saGroups)}
            {renderGroups("🇪🇬", egGroups)}
          </select>
        </label>
        <label className="text-[11px] text-muted-foreground">
          إلى مدينة
          <select
            value={to}
            onChange={(e) => { setTo(e.target.value); setQuote(null); }}
            className="mt-1 w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none"
          >
            <option value="">اختر…</option>
            {renderGroups("🇸🇦", saGroups)}
            {renderGroups("🇪🇬", egGroups)}
          </select>
        </label>
      </div>


      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-[11px] text-muted-foreground">
          الوزن (كجم)
          <input
            type="number" min={0.1} step={0.5} value={weight}
            onChange={(e) => { setWeight(Number(e.target.value)); setQuote(null); }}
            className="mt-1 w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          القيمة المُعلنة (ر.س)
          <input
            type="number" min={0} step={50} value={declared}
            onChange={(e) => { setDeclared(Number(e.target.value)); setQuote(null); }}
            className="mt-1 w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none"
          />
        </label>
      </div>

      {issue && issue.code !== "no_from" && issue.code !== "no_to" && (
        <div className="mb-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-start gap-2">
          <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-amber-600" />
          <div className="flex-1">
            <div>{issue.msg}</div>
            {issue.suggest && issue.suggest.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {issue.suggest.map((s) => (
                  <button
                    key={s.code}
                    onClick={() => { setTo(s.code); setQuote(null); }}
                    className="px-2 py-0.5 rounded-full bg-white border border-amber-300 text-amber-800 hover:bg-amber-100 font-bold"
                  >
                    {s.name_ar} <span className="opacity-60 font-normal">· {s.region_ar}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <button
        onClick={() => q.mutate()}
        disabled={!!issue || q.isPending}
        className="w-full px-3 py-2 bg-primary/10 text-primary rounded-full text-xs font-bold disabled:opacity-50 mb-2"
      >
        {q.isPending ? "جاري الحساب…" : "احسب سعر الشحن"}
      </button>


      {quote && (
        <div className="text-xs bg-stone-soft rounded-xl p-3 mb-2 space-y-1">
          <div className="flex justify-between"><span>الأساس</span><span><LocalPrice sar={quote.base_sar} /></span></div>
          <div className="flex justify-between"><span>وزن {quote.weight_kg} × {quote.per_kg_sar} ر.س/كجم</span><span><LocalPrice sar={quote.per_kg_sar * quote.weight_kg} /></span></div>
          {quote.zone_fee_sar > 0 && <div className="flex justify-between"><span>رسوم المنطقة</span><span><LocalPrice sar={quote.zone_fee_sar} /></span></div>}
          {quote.intercity_fee_sar > 0 && <div className="flex justify-between"><span>بين المدن</span><span><LocalPrice sar={quote.intercity_fee_sar} /></span></div>}
          {quote.insurance_sar > 0 && <div className="flex justify-between"><span>تأمين</span><span><LocalPrice sar={quote.insurance_sar} /></span></div>}
          <div className="flex justify-between"><span>ضريبة القيمة المضافة</span><span><LocalPrice sar={quote.vat_sar} /></span></div>
          <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-border">
            <span>الإجمالي</span><span className="text-primary"><LocalPrice sar={quote.total_sar} /></span>
          </div>
          <div className="text-[10px] text-muted-foreground text-center pt-1">
            التسليم المتوقع خلال ~{quote.eta_hours} ساعة
          </div>
        </div>
      )}

      <button
        onClick={() => book.mutate()}
        disabled={!quote || book.isPending}
        className="w-full px-3 py-2 bg-primary text-primary-foreground rounded-full text-xs font-bold disabled:opacity-50"
      >
        {book.isPending ? "جاري الحجز…" : "احجز الشحنة وأنشئ رقم تتبع"}
      </button>

      <p className="text-[10px] text-muted-foreground text-center mt-2">
        وضع Sandbox: يتم توليد رقم تتبع تجريبي وأحداث تتبع محاكاة قبل الربط الفعلي مع Aramex/SMSA.
      </p>
    </div>
  );
}
