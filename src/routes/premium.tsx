import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Crown, Check, Sparkles, Zap, BarChart3, ShieldCheck, Gift, Copy, Loader2 } from "lucide-react";
import { Nav } from "@/components/Nav";
import { TIERS, getMySubscription, upgradeSubscription, type Tier } from "@/lib/subscriptions.functions";
import { getOrCreateMyReferral, redeemReferral } from "@/lib/referrals.functions";
import { useAuth } from "@/lib/auth";
import { loadCashOnly, loadCountry } from "@/lib/region-mode" with { /* side-effect free */ };

// Re-import (the `with { … }` above was illegal — remove)
// (kept for the bundler to not get confused — actual import below)
import { loadCashOnly as _loadCashOnly, loadCountry as _loadCountry } from "@/lib/region-mode";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "بادل Premium — اشتراك مميز للمقايضين الجادين" },
      { name: "description", content: "خفّض عمولة المنصة، أبرز إعلاناتك، واحصل على تحليلات متقدمة. مصدر دخل مستدام للمنصة بديل عن العملة الرقمية." },
    ],
  }),
  component: PremiumPage,
});

function PremiumPage() {
  const { user } = useAuth();
  const getSub = useServerFn(getMySubscription);
  const upgrade = useServerFn(upgradeSubscription);
  const qc = useQueryClient();

  const { data: subData } = useQuery({
    queryKey: ["my-subscription", user?.id],
    queryFn: () => getSub(),
    enabled: !!user,
  });
  const current = (subData?.tier ?? "free") as Tier;

  const m = useMutation({
    mutationFn: (tier: Tier) => upgrade({ data: { tier } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-subscription"] }),
  });

  const [cashOnly, setCashOnly] = useState(false);
  useEffect(() => { setCashOnly(_loadCashOnly(_loadCountry())); }, []);

  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-10">
        {/* Hero */}
        <section className="rounded-3xl overflow-hidden bg-gradient-to-br from-amber-500 via-orange-500 to-rose-500 text-white p-10 relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-extrabold">
            <Crown className="size-4" /> BADEL · PREMIUM
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-black mt-3 leading-tight">
            اشتراك مميز يجعل المقايضة أسرع وأربح
          </h1>
          <p className="mt-3 text-base md:text-lg font-bold opacity-95 max-w-3xl">
            خفّض العمولة، أبرز إعلاناتك، واحصل على تحليلات متقدمة — بدون الحاجة لأي عملة رقمية.
            متاح في كل الدول بما فيها المناطق التي تقيّد العملات الرقمية.
          </p>
          {cashOnly && (
            <div className="mt-4 inline-flex items-center gap-2 bg-white/15 backdrop-blur px-3 py-2 rounded-xl text-xs font-extrabold">
              💵 وضعك الحالي: نقدي فقط — Premium هو طريقتك المثلى لتوفير العمولة وزيادة الظهور.
            </div>
          )}
        </section>

        {/* Pricing tiers */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          {(["free", "plus", "pro"] as Tier[]).map((t) => {
            const info = TIERS[t];
            const isCurrent = current === t;
            const featured = t === "plus";
            return (
              <div
                key={t}
                className={`rounded-3xl p-6 ring-1 relative ${
                  featured
                    ? "bg-gradient-to-b from-primary/5 to-card ring-primary/30 shadow-lg"
                    : "bg-card ring-black/5"
                }`}
              >
                {featured && (
                  <div className="absolute -top-3 right-6 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-extrabold">
                    الأكثر شعبية
                  </div>
                )}
                <div className="flex items-center gap-2 mb-2">
                  {t === "free" && <Sparkles className="size-5 text-muted-foreground" />}
                  {t === "plus" && <Zap className="size-5 text-primary" />}
                  {t === "pro" && <Crown className="size-5 text-amber-500" />}
                  <h3 className="font-extrabold text-xl">{info.name}</h3>
                </div>
                <div className="flex items-baseline gap-1 mb-4">
                  <span className="font-display text-4xl font-black tabular-nums">{info.priceSAR}</span>
                  <span className="text-sm font-bold text-muted-foreground">ر.س / شهر</span>
                </div>
                <ul className="space-y-2 mb-6">
                  {info.perks.map((p) => (
                    <li key={p} className="flex items-start gap-2 text-sm font-bold">
                      <Check className="size-4 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
                {user ? (
                  <button
                    disabled={isCurrent || m.isPending}
                    onClick={() => m.mutate(t)}
                    className={`w-full py-2.5 rounded-full text-sm font-extrabold transition ${
                      isCurrent
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 cursor-default"
                        : featured
                          ? "bg-primary text-primary-foreground hover:opacity-90"
                          : "bg-foreground text-background hover:opacity-90"
                    }`}
                  >
                    {m.isPending && m.variables === t ? (
                      <span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" /> جاري...</span>
                    ) : isCurrent ? "خطتك الحالية" : t === "free" ? "إلغاء الاشتراك" : "اشترك الآن"}
                  </button>
                ) : (
                  <Link to="/auth" className="block text-center w-full py-2.5 rounded-full bg-foreground text-background text-sm font-extrabold">
                    سجّل لتبدأ
                  </Link>
                )}
              </div>
            );
          })}
        </section>

        {/* Why premium */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <Why icon={<BarChart3 className="size-5" />} title="عمولة أقل = ربح أعلى">
            وفّر حتى 67% من رسوم كل صفقة — Pro يخفض العمولة من 3% إلى 1%.
          </Why>
          <Why icon={<Zap className="size-5" />} title="ظهور مضاعف">
            إبراز أسبوعي لإعلاناتك في أعلى نتائج السوق، مع شارة موثّق على ملفك.
          </Why>
          <Why icon={<ShieldCheck className="size-5" />} title="بديل قانوني للعملة الرقمية">
            في الدول التي تقيّد العملات الرقمية، Premium يبقى مصدر دخل ومميزات كامل.
          </Why>
        </section>

        {/* Referrals */}
        {user && <ReferralCard />}
      </main>
    </div>
  );
}

function Why({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card ring-1 ring-black/5 p-5">
      <div className="size-10 rounded-xl grid place-items-center bg-primary/10 text-primary mb-3">{icon}</div>
      <h3 className="font-extrabold text-lg mb-1">{title}</h3>
      <p className="text-sm font-bold text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function ReferralCard() {
  const getRef = useServerFn(getOrCreateMyReferral);
  const redeem = useServerFn(redeemReferral);
  const { data, refetch } = useQuery({
    queryKey: ["my-referral"],
    queryFn: () => getRef(),
  });
  const [code, setCode] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const onRedeem = async () => {
    const r = await redeem({ data: { code } });
    setMsg(r.ok ? `🎉 تم — ربحت ${r.reward_di} DI` : `❌ ${r.message}`);
    if (r.ok) { setCode(""); refetch(); }
  };

  const onCopy = () => {
    if (!data?.code) return;
    navigator.clipboard.writeText(data.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <section className="mt-10 rounded-3xl bg-gradient-to-br from-emerald-50 to-card ring-1 ring-emerald-200 p-6 md:p-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="size-11 rounded-2xl grid place-items-center bg-emerald-100 text-emerald-700">
          <Gift className="size-6" />
        </div>
        <div>
          <h2 className="font-extrabold text-xl">برنامج الإحالة</h2>
          <p className="text-xs text-muted-foreground font-bold">
            شارك كودك واربح 25 DI لكل صديق يسجّل ويتم أول صفقة. صديقك يربح 25 DI أيضاً.
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-2xl bg-background ring-1 ring-border p-4">
          <div className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground mb-2">كودك للإحالة</div>
          <div className="flex items-center gap-2">
            <code className="flex-1 font-mono font-black text-xl tracking-wider bg-stone-soft px-3 py-2 rounded-lg">
              {data?.code ?? "..."}
            </code>
            <button
              onClick={onCopy}
              className="px-3 py-2 rounded-lg bg-foreground text-background text-xs font-extrabold inline-flex items-center gap-1.5"
            >
              <Copy className="size-3.5" /> {copied ? "تم النسخ" : "نسخ"}
            </button>
          </div>
        </div>
        <div className="rounded-2xl bg-background ring-1 ring-border p-4">
          <div className="text-[11px] uppercase tracking-wider font-extrabold text-muted-foreground mb-2">لديك كود؟ استخدمه</div>
          <div className="flex items-center gap-2">
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="BD-XXXX"
              className="flex-1 px-3 py-2 rounded-lg bg-stone-soft border border-border font-mono font-extrabold tracking-wider outline-none focus:ring-2 ring-primary/30"
            />
            <button
              onClick={onRedeem}
              disabled={!code}
              className="px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-extrabold disabled:opacity-40"
            >
              تطبيق
            </button>
          </div>
          {msg && <div className="text-xs font-bold mt-2">{msg}</div>}
        </div>
      </div>
    </section>
  );
}
