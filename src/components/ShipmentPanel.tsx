import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useRef, useState, useEffect } from "react";
import { toast } from "sonner";
import { Truck, Package, CheckCircle2, MapPin, Clock, Loader2, AlertTriangle, Search, X, ChevronDown, Printer } from "lucide-react";
import {
  quoteShipping,
  bookShipment,
  getShipmentTracking,
  listShippingCities,
} from "@/lib/shipping.functions";
import { validateShipmentInput } from "@/lib/shipment-validation";
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
      <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4" data-testid="shipment-panel-tracking">
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
            <b className="font-mono" data-testid="shipment-tracking-number">{offer.tracking_number}</b>
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

        <a
          href={`/shipping-label/${offer.id}`}
          target="_blank"
          rel="noopener"
          data-testid="shipment-label-link"
          className="mb-3 w-full px-3 py-2 bg-stone-soft rounded-full text-xs font-bold flex items-center justify-center gap-2 hover:bg-stone-soft/70"
        >
          <Printer className="size-4" /> طباعة ملصق الشحن
        </a>


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
              data-testid="shipment-confirm-button"
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



  // ── Smart validation + suggestions (pure logic — see shipment-validation.ts) ──
  const { issue, fromCity } = validateShipmentInput({ from, to, weight, declared, cities });



  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4" data-testid="shipment-panel">
      <h3 className="font-bold mb-3 flex items-center gap-2 text-sm">
        <Truck className="size-4 text-primary" /> حجز الشحن (Sandbox)
        <span className="ms-auto text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full ring-1 ring-emerald-200">
          BadelShip · {saCities.length + egCities.length} مدينة
        </span>
      </h3>

      <div className="grid grid-cols-2 gap-2 mb-2">
        <CityPicker
          label="من مدينة"
          testId="city-picker-from"
          value={from}
          onChange={(v) => { setFrom(v); setQuote(null); }}
          cities={cities}
        />
        <CityPicker
          label="إلى مدينة"
          testId="city-picker-to"
          value={to}
          onChange={(v) => { setTo(v); setQuote(null); }}
          cities={cities}
          restrictCountry={fromCity?.country}
        />
      </div>



      <div className="grid grid-cols-2 gap-2 mb-2">
        <label className="text-[11px] text-muted-foreground">
          الوزن (كجم)
          <input
            type="number" min={0.1} step={0.5} value={weight}
            onChange={(e) => { setWeight(Number(e.target.value)); setQuote(null); }}
            data-testid="shipment-weight-input"
            className="mt-1 w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none"
          />
        </label>
        <label className="text-[11px] text-muted-foreground">
          القيمة المُعلنة (ر.س)
          <input
            type="number" min={0} step={50} value={declared}
            onChange={(e) => { setDeclared(Number(e.target.value)); setQuote(null); }}
            data-testid="shipment-declared-input"
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
        data-testid="shipment-quote-button"
        className="w-full px-3 py-2 bg-primary/10 text-primary rounded-full text-xs font-bold disabled:opacity-50 mb-2"
      >
        {q.isPending ? "جاري الحساب…" : "احسب سعر الشحن"}
      </button>


      {quote && (
        <div className="text-xs bg-stone-soft rounded-xl p-3 mb-2 space-y-1" data-testid="shipment-quote-summary">
          <div className="flex justify-between"><span>الأساس</span><span><LocalPrice sar={quote.base_sar} /></span></div>
          <div className="flex justify-between"><span>وزن {quote.weight_kg} × {quote.per_kg_sar} ر.س/كجم</span><span><LocalPrice sar={quote.per_kg_sar * quote.weight_kg} /></span></div>
          {quote.zone_fee_sar > 0 && <div className="flex justify-between"><span>رسوم المنطقة</span><span><LocalPrice sar={quote.zone_fee_sar} /></span></div>}
          {quote.intercity_fee_sar > 0 && <div className="flex justify-between"><span>بين المدن</span><span><LocalPrice sar={quote.intercity_fee_sar} /></span></div>}
          {quote.insurance_sar > 0 && <div className="flex justify-between"><span>تأمين</span><span><LocalPrice sar={quote.insurance_sar} /></span></div>}
          <div className="flex justify-between"><span>ضريبة القيمة المضافة</span><span><LocalPrice sar={quote.vat_sar} /></span></div>
          <div className="flex justify-between font-extrabold text-sm pt-1 border-t border-border">
            <span>الإجمالي</span><span className="text-primary" data-testid="shipment-quote-total"><LocalPrice sar={quote.total_sar} /></span>
          </div>
          <div className="text-[10px] text-muted-foreground text-center pt-1">
            التسليم المتوقع خلال ~{quote.eta_hours} ساعة
          </div>
        </div>
      )}

      <button
        onClick={() => book.mutate()}
        disabled={!quote || book.isPending}
        data-testid="shipment-book-button"
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

// ─────────────────────────── CityPicker ───────────────────────────
type CityRow = { code: string; name_ar: string; region_ar: string; country: string };

function CityPicker({
  label,
  testId,
  value,
  onChange,
  cities,
  restrictCountry,
}: {
  label: string;
  testId?: string;
  value: string;
  onChange: (code: string) => void;
  cities: CityRow[];
  restrictCountry?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState<"ALL" | "SA" | "EG">("ALL");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (restrictCountry === "SA" || restrictCountry === "EG") setCountry(restrictCountry);
  }, [restrictCountry]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const selected = cities.find((c) => c.code === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = cities;
    if (country !== "ALL") list = list.filter((c) => c.country === country);
    if (restrictCountry) list = list.filter((c) => c.country === restrictCountry);
    if (q) {
      list = list.filter(
        (c) =>
          c.name_ar.toLowerCase().includes(q) ||
          (c.region_ar || "").toLowerCase().includes(q) ||
          c.code.toLowerCase().includes(q),
      );
    }
    return list.slice(0, 200);
  }, [cities, query, country, restrictCountry]);

  const grouped = useMemo(() => {
    const m: Record<string, CityRow[]> = {};
    for (const c of filtered) {
      const key = `${c.country}|${c.region_ar || c.name_ar}`;
      (m[key] ||= []).push(c);
    }
    return m;
  }, [filtered]);

  const flag = (co: string) => (co === "SA" ? "🇸🇦" : co === "EG" ? "🇪🇬" : "🌍");

  return (
    <div className="text-[11px] text-muted-foreground" ref={ref} data-testid={testId}>
      <div>{label}</div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        data-testid={testId ? `${testId}-trigger` : undefined}
        className="mt-1 w-full px-2 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none flex items-center justify-between gap-1 text-start"
      >
        <span className={selected ? "text-foreground font-medium truncate" : "text-muted-foreground"}>
          {selected ? `${flag(selected.country)} ${selected.name_ar}` : "اختر…"}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </button>

      {open && (
        <div className="relative">
          <div className="absolute z-30 mt-1 w-full bg-card rounded-xl ring-1 ring-black/10 shadow-lg p-2">
            <div className="relative mb-1.5">
              <Search className="size-3.5 absolute top-1/2 -translate-y-1/2 start-2 text-muted-foreground" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="ابحث بالمدينة أو المنطقة…"
                data-testid={testId ? `${testId}-search` : undefined}
                className="w-full ps-7 pe-7 py-1.5 rounded-lg bg-stone-soft border border-border text-xs outline-none"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute top-1/2 -translate-y-1/2 end-2 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {!restrictCountry && (
              <div className="flex gap-1 mb-1.5">
                {(["ALL", "SA", "EG"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCountry(c)}
                    className={`flex-1 px-2 py-1 rounded-lg text-[11px] font-bold ${
                      country === c ? "bg-primary text-primary-foreground" : "bg-stone-soft text-muted-foreground"
                    }`}
                  >
                    {c === "ALL" ? "الكل" : c === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"}
                  </button>
                ))}
              </div>
            )}

            <div className="max-h-64 overflow-y-auto -mx-1 px-1">
              {Object.keys(grouped).length === 0 ? (
                <div className="py-6 text-center text-xs text-muted-foreground">
                  لا توجد نتائج مطابقة.
                </div>
              ) : (
                Object.entries(grouped).map(([key, list]) => {
                  const [co, region] = key.split("|");
                  return (
                    <div key={key} className="mb-1">
                      <div className="sticky top-0 bg-card text-[10px] font-bold text-muted-foreground px-1.5 py-1">
                        {flag(co)} {region}
                      </div>
                      {list.map((c) => (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => {
                            onChange(c.code);
                            setOpen(false);
                            setQuery("");
                          }}
                          data-testid={testId ? `${testId}-option-${c.code}` : undefined}
                          className={`w-full text-start px-2 py-1.5 rounded-md text-xs hover:bg-primary/5 ${
                            c.code === value ? "bg-primary/10 text-primary font-bold" : ""
                          }`}
                        >
                          {c.name_ar}
                          <span className="text-[10px] text-muted-foreground ms-1">· {c.code}</span>
                        </button>
                      ))}
                    </div>
                  );
                })
              )}
            </div>

            <div className="text-[10px] text-muted-foreground text-center pt-1 border-t border-border mt-1">
              {filtered.length} مدينة{filtered.length >= 200 ? "+ (اكتب للتحديد)" : ""}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
