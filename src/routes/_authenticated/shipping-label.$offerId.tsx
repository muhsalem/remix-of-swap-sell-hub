import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Printer, ArrowRight, Loader2, AlertTriangle } from "lucide-react";
import { getShipmentTracking } from "@/lib/shipping.functions";
import { code39Bars } from "@/lib/barcode";

export const Route = createFileRoute("/_authenticated/shipping-label/$offerId")({
  head: () => ({
    meta: [
      { title: "ملصق الشحن — بَدِّل" },
      { name: "description", content: "اطبع ملصق الشحن الخاص بصفقتك مع رقم التتبع والباركود وبيانات المرسِل والمستلم." },
      { property: "og:title", content: "ملصق الشحن — بَدِّل" },
      { property: "og:description", content: "ملصق شحن جاهز للطباعة برقم تتبع وباركود." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ShippingLabelPage,
});

function Barcode({ value }: { value: string }) {
  const { bars, width } = code39Bars(value);
  return (
    <svg viewBox={`0 0 ${width} 70`} width="100%" height="70" preserveAspectRatio="none" role="img" aria-label={`باركود ${value}`}>
      <rect x="0" y="0" width={width} height="70" fill="#fff" />
      {bars.map((b, i) => (
        <rect key={i} x={b.x} y="0" width={b.w} height="70" fill="#000" />
      ))}
    </svg>
  );
}

function ShippingLabelPage() {
  const { offerId } = Route.useParams();
  const trackFn = useServerFn(getShipmentTracking);

  const q = useQuery({
    queryKey: ["shipment-label", offerId],
    queryFn: () => trackFn({ data: { offer_id: offerId } }),
  });

  const info: any = q.data?.offer;
  const tracking = q.data?.tracking_number;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6" dir="rtl">
      <style>{`@media print { .no-print { display: none !important; } body { background: #fff; } .label-sheet { box-shadow: none !important; margin: 0 !important; } }`}</style>

      <div className="flex items-center justify-between mb-4 no-print">
        <Link to="/offers/$id" params={{ id: offerId }} className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          <ArrowRight className="size-4" /> رجوع للصفقة
        </Link>
        <button
          onClick={() => window.print()}
          disabled={!tracking}
          className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-2 disabled:opacity-50"
        >
          <Printer className="size-4" /> طباعة الملصق
        </button>
      </div>

      {q.isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-16">
          <Loader2 className="size-4 animate-spin" /> جاري تجهيز الملصق…
        </div>
      )}

      {q.isError && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-sm flex items-start gap-2">
          <AlertTriangle className="size-4 mt-0.5" /> تعذّر تحميل بيانات الشحنة — تأكد أنك طرف في هذه الصفقة.
        </div>
      )}

      {q.isSuccess && !tracking && (
        <div className="p-4 rounded-2xl bg-stone-soft text-sm text-muted-foreground">
          لا توجد شحنة محجوزة لهذه الصفقة بعد. احجز الشحن أولاً من صفحة الصفقة ثم عُد لطباعة الملصق.
        </div>
      )}

      {tracking && (
        <div className="label-sheet bg-white text-black rounded-2xl ring-1 ring-black/10 p-6 shadow-sm">
          <div className="flex items-start justify-between border-b-2 border-black pb-3 mb-4">
            <div>
              <div className="text-2xl font-extrabold">بَدِّل</div>
              <div className="text-[11px]">{info?.shipping_provider ?? "BadelShip"} · ملصق شحن</div>
            </div>
            <div className="text-end text-[11px]">
              <div>الدولة: {info?.country_code === "EG" ? "مصر" : "السعودية"}</div>
              <div>الوزن: {info?.shipment_weight_kg ?? "—"} كجم</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs mb-4">
            <div className="border border-black/30 rounded-lg p-3">
              <div className="font-bold mb-1">المرسِل</div>
              <div className="text-lg font-extrabold">{info?.from_city ?? "—"}</div>
            </div>
            <div className="border border-black/30 rounded-lg p-3">
              <div className="font-bold mb-1">المستلِم</div>
              <div className="text-lg font-extrabold">{info?.to_city ?? "—"}</div>
            </div>
          </div>

          <div className="text-center">
            <Barcode value={tracking} />
            <div className="font-mono tracking-[0.3em] text-lg font-extrabold mt-1">{tracking}</div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] mt-4 pt-3 border-t border-black/20">
            <div>التسليم المتوقع: <b>{info?.expected_delivery ?? "—"}</b></div>
            <div className="text-end">تكلفة الشحن: <b>{info?.shipping_cost_sar ?? "—"} ر.س</b></div>
            <div className="col-span-2">رقم الصفقة: <span className="font-mono">{offerId}</span></div>
          </div>

          <p className="text-[10px] text-center mt-3 opacity-70">
            الصق هذا الملصق على الطرد بوضوح. لا تغطِّ الباركود بالشريط اللاصق اللامع.
          </p>
        </div>
      )}
    </div>
  );
}
