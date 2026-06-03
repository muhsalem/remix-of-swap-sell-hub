
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
