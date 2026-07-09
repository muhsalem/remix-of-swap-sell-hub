import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, Medal, Award, Star, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/leaderboard")({
  head: () => ({
    meta: [
      { title: "لوحة المتصدرين — بدِّل" },
      { name: "description", content: "أفضل المستخدمين في منصة بدِّل هذا الأسبوع حسب عدد الصفقات والتقييمات." },
      { property: "og:title", content: "لوحة المتصدرين — بدِّل" },
      { property: "og:url", content: "https://badelbarter.lovable.app/leaderboard" },
    ],
    links: [{ rel: "canonical", href: "https://badelbarter.lovable.app/leaderboard" }],
  }),
  component: LeaderboardPage,
});

type Row = {
  user_id: string;
  display_name: string | null;
  avatar_url: string | null;
  verified_badge: boolean | null;
  rating: number;
  total_trades: number;
  weekly_trades: number;
  badges_count: number;
};

function LeaderboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard_weekly"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("leaderboard_weekly" as never)
        .select("*")
        .order("weekly_trades", { ascending: false })
        .order("rating", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
  });

  return (
    <main dir="rtl" className="mx-auto max-w-4xl px-4 py-10">
      <header className="mb-8 text-center">
        <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-gradient-to-br from-amber-100 to-amber-50 p-4 shadow-glass">
          <Trophy className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-3xl font-bold tracking-tight">لوحة المتصدرين</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          أنشط المُقايضين خلال آخر 7 أيام. تُحدَّث اللوحة مباشرة.
        </p>
      </header>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : (data?.length ?? 0) === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-sm text-muted-foreground">
          لا يوجد نشاط بعد — كن أول المتصدرين!
        </div>
      ) : (
        <ol className="space-y-2">
          {data!.map((row, idx) => (
            <li
              key={row.user_id}
              className="flex items-center gap-3 rounded-xl border bg-card/70 p-3 shadow-sm backdrop-blur transition hover:shadow-md"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted font-bold tabular-nums">
                {idx === 0 ? <Medal className="h-5 w-5 text-amber-500" /> :
                 idx === 1 ? <Medal className="h-5 w-5 text-slate-400" /> :
                 idx === 2 ? <Award className="h-5 w-5 text-orange-600" /> :
                 <span className="text-sm text-muted-foreground">#{idx + 1}</span>}
              </div>
              {row.avatar_url ? (
                <img src={row.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover" />
              ) : (
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-cyan-100 to-violet-100" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 truncate font-medium">
                  <span className="truncate">{row.display_name || "مستخدم"}</span>
                  {row.verified_badge && <ShieldCheck className="h-4 w-4 shrink-0 text-cyan-600" />}
                </div>
                <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <Star className="h-3 w-3 text-amber-500" />
                    {Number(row.rating).toFixed(1)}
                  </span>
                  <span>{row.total_trades} صفقة إجمالاً</span>
                  {row.badges_count > 0 && <span>{row.badges_count} شارة</span>}
                </div>
              </div>
              <div className="text-left">
                <div className="text-lg font-bold tabular-nums text-cyan-700">{row.weekly_trades}</div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">هذا الأسبوع</div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
