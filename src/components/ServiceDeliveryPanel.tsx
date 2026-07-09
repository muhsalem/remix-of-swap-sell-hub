import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { CalendarClock, MapPin, Link2, ListChecks, CheckCircle2, Sparkles } from "lucide-react";
import { confirmDelivery } from "@/lib/logistics.functions";
import { sendMessage } from "@/lib/offers.functions";

type Offer = {
  id: string;
  status: string;
  from_user: string;
  to_user: string;
  delivery_confirmed_by_from?: boolean;
  delivery_confirmed_by_to?: boolean;
};

type Method = "session" | "onsite" | "digital" | "milestone";

const METHODS: {
  id: Method;
  label: string;
  hint: string;
  icon: any;
  placeholder: string;
}[] = [
  {
    id: "session",
    label: "جلسة عن بُعد",
    hint: "Zoom / Google Meet — استشارات، تدريب، تعليم",
    icon: CalendarClock,
    placeholder: "الموعد + رابط الجلسة (مثال: الأربعاء 8م — meet.google.com/xyz)",
  },
  {
    id: "onsite",
    label: "زيارة ميدانية",
    hint: "صيانة، تركيب، خدمات منزلية",
    icon: MapPin,
    placeholder: "العنوان + الموعد المتفق عليه",
  },
  {
    id: "digital",
    label: "تسليم رقمي",
    hint: "تصميم، برمجة، محتوى — رابط ملف/مستودع",
    icon: Link2,
    placeholder: "رابط التسليم (Drive / GitHub / Figma …)",
  },
  {
    id: "milestone",
    label: "مراحل متعددة",
    hint: "مشاريع طويلة — مقاولات، تسويق",
    icon: ListChecks,
    placeholder: "قائمة المراحل والتواريخ",
  },
];

export function ServiceDeliveryPanel({
  offer,
  userId,
}: {
  offer: Offer;
  userId: string;
}) {
  const qc = useQueryClient();
  const confirmFn = useServerFn(confirmDelivery);
  const sendFn = useServerFn(sendMessage);

  const [method, setMethod] = useState<Method>("session");
  const [note, setNote] = useState("");

  const isFrom = offer.from_user === userId;
  const myConfirmed = isFrom ? offer.delivery_confirmed_by_from : offer.delivery_confirmed_by_to;
  const otherConfirmed = isFrom ? offer.delivery_confirmed_by_to : offer.delivery_confirmed_by_from;

  const savePlan = useMutation({
    mutationFn: () => {
      const m = METHODS.find((x) => x.id === method)!;
      const body = `📌 خطة تنفيذ الخدمة\n• الطريقة: ${m.label}\n• التفاصيل: ${note.trim() || "—"}`;
      return sendFn({ data: { offer_id: offer.id, body } });
    },
    onSuccess: () => {
      toast.success("تم إرسال خطة التنفيذ في المحادثة");
      setNote("");
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: () => confirmFn({ data: { offer_id: offer.id } }),
    onSuccess: (r: any) => {
      toast.success(r.completed ? "اكتملت الصفقة 🎉" : "تم التأكيد — بانتظار الطرف الآخر");
      qc.invalidateQueries({ queryKey: ["offer", offer.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const active = METHODS.find((m) => m.id === method)!;
  const Icon = active.icon;

  return (
    <div className="bg-card rounded-2xl ring-1 ring-black/5 p-4">
      <h3 className="font-bold mb-1 flex items-center gap-2 text-sm">
        <Sparkles className="size-4 text-primary" /> تنفيذ الخدمة
        <span className="ms-auto text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full ring-1 ring-primary/20">
          بدون شحن
        </span>
      </h3>
      <p className="text-[11px] text-muted-foreground mb-3">
        الخدمات لا تحتاج شحن — اتفقا على طريقة التسليم ثم أكّدا الإنجاز لتحرير الضمان.
      </p>

      <div className="grid grid-cols-2 gap-1.5 mb-3">
        {METHODS.map((m) => {
          const MIcon = m.icon;
          const isActive = method === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setMethod(m.id)}
              className={`text-start p-2 rounded-xl border text-[11px] transition-all ${
                isActive
                  ? "bg-primary/10 border-primary/40 text-primary font-bold"
                  : "bg-stone-soft border-border text-muted-foreground hover:border-primary/20"
              }`}
            >
              <MIcon className="size-3.5 mb-1" />
              <div>{m.label}</div>
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-muted-foreground mb-2 flex items-start gap-1.5">
        <Icon className="size-3.5 mt-0.5 text-primary shrink-0" />
        <span>{active.hint}</span>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={active.placeholder}
        rows={2}
        maxLength={500}
        className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-xs outline-none mb-2 resize-none"
      />
      <button
        onClick={() => savePlan.mutate()}
        disabled={!note.trim() || savePlan.isPending}
        className="w-full px-3 py-2 bg-primary/10 text-primary rounded-full text-xs font-bold disabled:opacity-50 mb-3"
      >
        {savePlan.isPending ? "جاري الإرسال…" : "أرسل خطة التنفيذ للطرف الآخر"}
      </button>

      {offer.status === "accepted" && (
        <>
          <div className="text-xs grid grid-cols-2 gap-2 mb-2">
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
            {myConfirmed ? "أكدت الإنجاز" : "تأكيد إنجاز الخدمة"}
          </button>
        </>
      )}

      <p className="text-[10px] text-muted-foreground text-center mt-2">
        قريباً: حجز موعد داخل المنصة، مكالمات فيديو مدمجة، وتوقيع تسليم رقمي.
      </p>
    </div>
  );
}
