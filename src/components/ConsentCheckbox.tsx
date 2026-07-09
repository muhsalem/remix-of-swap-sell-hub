import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { useUserCurrency } from "@/components/LocalPrice";

type Props = {
  checked: boolean;
  onChange: (v: boolean) => void;
  context: "create_offer" | "complete_order" | "payment" | "listing";
};

const LABELS: Record<Props["context"], string> = {
  create_offer: "قبل إرسال هذا العرض",
  complete_order: "قبل إتمام الصفقة",
  payment: "قبل إتمام الدفع",
  listing: "قبل نشر الإعلان",
};

export function ConsentCheckbox({ checked, onChange, context }: Props) {
  const { country } = useUserCurrency();
  const cc = country === "EG" ? "EG" : "SA";
  const flag = cc === "EG" ? "🇪🇬 مصر" : "🇸🇦 السعودية";

  return (
    <label className="flex items-start gap-3 p-3 rounded-xl bg-stone-soft/60 ring-1 ring-border cursor-pointer hover:bg-stone-soft transition">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 size-4 accent-primary flex-shrink-0"
      />
      <span className="text-xs leading-relaxed text-muted-foreground">
        <ShieldCheck className="inline size-3.5 text-primary ml-1 mb-0.5" />
        {LABELS[context]} أقرّ بأني قرأت ووافقت على{" "}
        <Link to="/legal/$doc" params={{ doc: "terms" }} target="_blank" className="text-primary font-bold underline">شروط الاستخدام</Link>
        {" و "}
        <Link to="/legal/$doc" params={{ doc: "privacy" }} target="_blank" className="text-primary font-bold underline">سياسة الخصوصية</Link>
        {" و "}
        <Link to="/legal/$doc" params={{ doc: "barter" }} target="_blank" className="text-primary font-bold underline">اتفاقية المقايضة</Link>
        {" الخاصة بـ "}<strong className="text-foreground">{flag}</strong>.
      </span>
    </label>
  );
}
