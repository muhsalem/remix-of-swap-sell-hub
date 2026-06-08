import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { getWalletStats } from "@/lib/wallet.functions";
import { SAR_PER_DI } from "@/lib/pricing.functions";
import { Wallet, Star, TrendingUp, Award, Package, Inbox, CheckCircle2, Sparkles, History, ArrowLeftRight, ShieldCheck, AlertTriangle, Ban, Building2, User as UserIcon, BadgeCheck } from "lucide-react";
import { ContactSettings } from "@/components/ContactSettings";
import { VerificationCard } from "@/components/VerificationCard";
import { getPricing } from "@/lib/promotions.functions";
import { useQuery } from "@tanstack/react-query";

const walletQO = queryOptions({ queryKey: ["wallet-stats"], queryFn: () => getWalletStats() });
const pricingQO = queryOptions({ queryKey: ["pricing"], queryFn: () => getPricing() });

export const Route = createFileRoute("/_authenticated/profile")({
  loader: ({ context }) => context.queryClient.ensureQueryData(walletQO),
  component: ProfilePage,
  errorComponent: ({ error }) => (
    <div className="max-w-2xl mx-auto p-8 text-center">
      <p className="text-destructive">تعذّر تحميل بياناتك: {error.message}</p>
    </div>
  ),
});

type LastAnalysis = {
  at: number;
  fairness: number;
  diA: number; diB: number;
  itemsA: { name: string; di: number }[];
  itemsB: { name: string; di: number }[];
  recommendation: string;
  shariahLevel: "safe" | "warning" | "forbidden";
  shariahRule: string;
  serviceBarter?: boolean;
};

function Stat({ icon: Icon, label, value, hint }: { icon: React.ElementType; label: string; value: string | number; hint?: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
        <Icon className="size-4" /> {label}
      </div>
      <div className="text-2xl font-extrabold tracking-tight">{value}</div>
      {hint ? <div className="text-xs text-muted-foreground mt-1">{hint}</div> : null}
    </div>
  );
}

function ScoreBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="font-bold">{value}/100</span>
      </div>
      <div className="h-2.5 bg-stone-soft rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function ProfilePage() {
  const { data } = useSuspenseQuery(walletQO);
  const { data: pricing } = useQuery(pricingQO);
  const diOn = pricing?.diEnabled ?? false;
  const { profile, diBalance, reputationScore, impactScore, trustLevel, stats, recentReviews } = data;

  const [lastAnalysis, setLastAnalysis] = useState<LastAnalysis | null>(null);
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("lastAnalysis");
      if (raw) setLastAnalysis(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const ShIcon = lastAnalysis?.shariahLevel === "forbidden" ? Ban
    : lastAnalysis?.shariahLevel === "warning" ? AlertTriangle : ShieldCheck;
  const fairnessColor = (f: number) =>
    f >= 85 ? "text-primary" : f >= 65 ? "text-accent" : "text-destructive";

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">
      <div className="flex items-center gap-4">
        <div className="size-16 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-2xl font-extrabold text-primary-foreground">
          {(profile?.display_name ?? "U").slice(0, 1).toUpperCase()}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-2xl font-extrabold">
              {profile?.account_type === "company" && profile?.company_name
                ? profile.company_name
                : profile?.display_name ?? "مستخدم"}
            </h1>
            {profile?.account_type === "company" ? (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-accent/15 text-accent-foreground font-bold border border-accent/30">
                <Building2 className="size-3" /> شركة
                {profile?.company_verified && <BadgeCheck className="size-3 text-primary" />}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-full bg-stone-soft text-muted-foreground font-bold">
                <UserIcon className="size-3" /> فرد
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-primary/10 text-primary font-bold">
              <Award className="size-3" /> {trustLevel}
            </span>
            {profile?.account_type === "company" && profile?.display_name && (
              <span className="text-xs text-muted-foreground">المسؤول: {profile.display_name}</span>
            )}
            {profile?.bio ? <span className="text-sm text-muted-foreground">{profile.bio}</span> : null}
          </div>
        </div>
        <Link to="/transactions" className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 rounded-full border border-border text-sm font-bold hover:bg-stone-soft">
          <History className="size-4" /> سجل المعاملات
        </Link>
      </div>

      {diOn ? (
        <div className="rounded-3xl p-6 bg-gradient-to-br from-primary via-primary to-accent text-primary-foreground shadow-[0_20px_60px_-20px_hsl(var(--primary)/0.5)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-sm opacity-90">
              <Wallet className="size-5" /> محفظة DI Credit
            </div>
            <Sparkles className="size-5 opacity-80" />
          </div>
          <div className="flex items-baseline gap-3">
            <div className="text-5xl font-extrabold tracking-tight">{diBalance.toFixed(2)}</div>
            <div className="text-lg opacity-90">DI</div>
          </div>
          <div className="text-sm opacity-80 mt-2">
            ≈ {(diBalance * SAR_PER_DI).toFixed(2)} ر.س &middot; 1 DI = {SAR_PER_DI} ر.س
          </div>
        </div>
      ) : (
        <div className="rounded-3xl p-6 border border-dashed border-border bg-card">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <Wallet className="size-5" /> محفظة العملة الداخلية (DI)
          </div>
          <div className="text-lg font-bold">قريباً — المرحلة الثانية</div>
          <p className="text-sm text-muted-foreground mt-1">
            خلال المرحلة الأولى المنصة مجانية بالكامل. سيتم تفعيل العملة الداخلية (DI) ومكافآت الصفقات لاحقاً.
          </p>
        </div>
      )}

      {/* آخر تحليل توافق مقايضة — مربوط بـ PricingEngine */}
      {lastAnalysis && (
        <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-6 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h2 className="font-bold flex items-center gap-2">
              <Sparkles className="size-4 text-primary" /> آخر تحليل توافق مقايضة
              {lastAnalysis.serviceBarter && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/20 text-accent-foreground">خدمة بخدمة</span>
              )}
            </h2>
            <span className="text-xs text-muted-foreground font-mono">
              {new Date(lastAnalysis.at).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3">
            <div className="rounded-xl bg-card p-3 border border-border">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">الطرف (أ) — {(lastAnalysis.diA * SAR_PER_DI).toLocaleString()} ر.س</div>
              <ul className="text-sm space-y-1">
                {lastAnalysis.itemsA.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{it.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{(it.di * SAR_PER_DI).toLocaleString()} ر.س</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="text-center">
              <div className={`text-3xl font-extrabold ${fairnessColor(lastAnalysis.fairness)}`}>{lastAnalysis.fairness}%</div>
              <div className="text-[10px] uppercase text-muted-foreground">توافق</div>
              <ArrowLeftRight className="size-5 mx-auto mt-1 text-primary" />
            </div>
            <div className="rounded-xl bg-card p-3 border border-border">
              <div className="text-[10px] uppercase font-bold text-muted-foreground mb-2">الطرف (ب) — {(lastAnalysis.diB * SAR_PER_DI).toLocaleString()} ر.س</div>
              <ul className="text-sm space-y-1">
                {lastAnalysis.itemsB.map((it, i) => (
                  <li key={i} className="flex justify-between gap-2">
                    <span className="truncate">{it.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">{(it.di * SAR_PER_DI).toLocaleString()} ر.س</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="text-sm bg-card rounded-xl p-3 border border-border">
            <div className="text-[10px] uppercase font-bold text-muted-foreground mb-1">سبب المطابقة / التوصية</div>
            <p className="leading-relaxed">{lastAnalysis.recommendation}</p>
          </div>

          <div className={`p-3 rounded-xl text-xs flex items-start gap-2 border ${
            lastAnalysis.shariahLevel === "forbidden" ? "bg-destructive/10 border-destructive/30 text-destructive"
            : lastAnalysis.shariahLevel === "warning" ? "bg-accent/10 border-accent/30"
            : "bg-primary/5 border-primary/20"
          }`}>
            <ShIcon className="size-4 mt-0.5 shrink-0" />
            <div>
              <div className="font-bold mb-0.5">الفحص الشرعي</div>
              <div className="opacity-90">{lastAnalysis.shariahRule}</div>
            </div>
          </div>

          <div className="flex gap-2">
            <Link to="/" hash="engine" className="text-xs text-primary hover:underline">← العودة لمحرك التسعير</Link>
            <button
              onClick={() => { sessionStorage.removeItem("lastAnalysis"); setLastAnalysis(null); }}
              className="text-xs text-muted-foreground hover:text-destructive ms-auto"
            >
              مسح
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
        <h2 className="font-bold flex items-center gap-2">
          <TrendingUp className="size-4 text-primary" /> درجات الثقة والتأثير
        </h2>
        <ScoreBar label="Reputation Score — درجة السمعة" value={reputationScore} color="bg-gradient-to-r from-primary to-accent" />
        <ScoreBar label="Impact Score — درجة التأثير" value={impactScore} color="bg-gradient-to-r from-emerald-500 to-teal-400" />
        <p className="text-xs text-muted-foreground pt-2 border-t border-border">
          تُحتسب درجة السمعة من تقييمات الشركاء، ودرجة التأثير من حجم نشاطك ومقايضاتك المكتملة.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat icon={CheckCircle2} label="صفقات مكتملة" value={stats.completedTrades} />
        <Stat icon={Inbox} label="عروض معلقة" value={stats.pendingOffers} />
        <Stat icon={Package} label="إعلاناتي النشطة" value={stats.activeListings} />
        <Stat icon={Star} label="متوسط التقييم" value={Number(stats.averageRating).toFixed(2)} hint={`${stats.totalReviews} مراجعة`} />
      </div>

      <ContactSettings />
      <VerificationCard />



      <div className="rounded-2xl border border-border bg-card p-6">
        <h2 className="font-bold mb-4 flex items-center gap-2">
          <Star className="size-4 text-amber-500" /> آخر المراجعات
        </h2>
        {recentReviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد مراجعات بعد. أكمل صفقتك الأولى لبدء بناء سمعتك.</p>
        ) : (
          <ul className="space-y-3">
            {recentReviews.map((r) => (
              <li key={r.id} className="p-3 rounded-xl bg-stone-soft/50">
                <div className="flex items-center gap-1 text-amber-500 mb-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-3.5 ${i < r.rating ? "fill-current" : "opacity-30"}`} />
                  ))}
                </div>
                {r.comment ? <p className="text-sm">{r.comment}</p> : <p className="text-sm text-muted-foreground italic">بدون تعليق</p>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/my-listings" className="flex-1 min-w-[160px] text-center px-5 py-3 rounded-full bg-foreground text-background font-bold hover:bg-primary transition-all">
          إدارة إعلاناتي
        </Link>
        <Link to="/offers" className="flex-1 min-w-[160px] text-center px-5 py-3 rounded-full border border-border font-bold hover:bg-stone-soft transition-all">
          صندوق العروض
        </Link>
        <Link to="/transactions" className="flex-1 min-w-[160px] text-center px-5 py-3 rounded-full border border-border font-bold hover:bg-stone-soft transition-all inline-flex items-center justify-center gap-2">
          <History className="size-4" /> السجل
        </Link>
      </div>
    </div>
  );
}
