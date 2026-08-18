import { useQuery } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { getTrustScore } from "@/lib/trust.functions";

const tone = (s: number) =>
  s >= 80 ? "text-emerald-600" : s >= 60 ? "text-primary" : s >= 35 ? "text-amber-600" : "text-muted-foreground";

export function TrustScoreCard({ userId, compact = false }: { userId: string; compact?: boolean }) {
  const q = useQuery({
    queryKey: ["trust", userId],
    queryFn: () => getTrustScore({ data: { userId } }),
    staleTime: 5 * 60 * 1000,
  });

  const trust = q.data?.trust;
  if (!trust) return null;

  if (compact) {
    return (
      <span className={`inline-flex items-center gap-1 text-[11px] font-bold ${tone(trust.score)}`}>
        <ShieldCheck className="size-3" /> ثقة {trust.score}
      </span>
    );
  }

  return (
    <div className="bg-card rounded-2xl p-4 ring-1 ring-black/5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm flex items-center gap-2">
          <ShieldCheck className={`size-4 ${tone(trust.score)}`} /> درجة الثقة
        </h3>
        <span className={`font-mono font-bold ${tone(trust.score)}`}>
          {trust.score}/100 · {trust.level}
        </span>
      </div>
      <div className="h-2 bg-stone-soft rounded-full overflow-hidden">
        <div className="h-full bg-primary transition-all" style={{ width: `${trust.score}%` }} />
      </div>
      <ul className="space-y-1.5">
        {trust.parts.map((p) => (
          <li key={p.key} className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>{p.label}</span>
            <span className="font-mono">{p.earned}/{p.max}</span>
          </li>
        ))}
      </ul>
      <p className="text-[10px] text-muted-foreground">
        تُحتسب من التقييمات والصفقات المكتملة والتوثيق وأقدمية الحساب.
      </p>
    </div>
  );
}
