import { ShieldCheck, Clock, RotateCcw } from "lucide-react";

/** شارة ثقة: كل صفقة على بَدِّل محمية بالضمان + سياسة استرداد 72 ساعة. */
export function EscrowBadge({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold"
        title="محمي بضمان بَدِّل — استرداد خلال 72 ساعة عند عدم مطابقة الوصف"
      >
        <ShieldCheck className="size-3" /> محمي بضمان بَدِّل
      </span>
    );
  }

  return (
    <div className="rounded-2xl border border-emerald-500/25 bg-emerald-500/5 p-4 space-y-2">
      <div className="flex items-center gap-2 font-bold text-sm text-emerald-700 dark:text-emerald-400">
        <ShieldCheck className="size-4" /> محمي بضمان بَدِّل
      </div>
      <ul className="text-xs text-muted-foreground space-y-1.5">
        <li className="flex items-start gap-2">
          <ShieldCheck className="size-3.5 mt-0.5 shrink-0 text-emerald-600" />
          تُحجز قيمة الفارق في الضمان حتى تأكيد الطرفين استلام الأغراض.
        </li>
        <li className="flex items-start gap-2">
          <Clock className="size-3.5 mt-0.5 shrink-0 text-emerald-600" />
          لديك 72 ساعة من الاستلام لفحص الغرض والإبلاغ عن أي اختلاف.
        </li>
        <li className="flex items-start gap-2">
          <RotateCcw className="size-3.5 mt-0.5 shrink-0 text-emerald-600" />
          عند عدم مطابقة الوصف: فتح نزاع واسترداد كامل للفارق المحجوز.
        </li>
      </ul>
    </div>
  );
}
