import { createFileRoute } from '@tanstack/react-router';
import { BarterPricingEngine } from '@/components/BarterPricingEngine';

export const Route = createFileRoute('/pricing-engine')({
  head: () => ({
    meta: [
      { title: 'محرك تسعير المقايضة — بدِّل' },
      { name: 'description', content: 'محرك تسعير ذكي للمقايضات متوافق شرعياً يدعم مصر والسعودية و14 فئة سلع وخدمات.' },
      { property: 'og:title', content: 'محرك تسعير المقايضة الذكي — بدِّل' },
      { property: 'og:description', content: 'قيّم عروضك بعدالة عبر محرك تسعير ذكي متوافق شرعياً.' },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { property: 'og:url', content: 'https://badelbarter.lovable.app/pricing-engine' },
    ],
    links: [{ rel: 'canonical', href: 'https://badelbarter.lovable.app/pricing-engine' }],
  }),
  component: PricingEnginePage,
});

function PricingEnginePage() {
  return (
    <main className="min-h-dvh bg-stone-soft">
      <div className="mx-auto max-w-7xl px-3 py-6 md:px-6">
        <header className="mb-4">
          <h1 className="text-xl font-extrabold text-foreground md:text-2xl">محرك تسعير المقايضة</h1>
          <p className="text-xs text-muted-foreground">تقييم ذكي للمقايضات · متوافق شرعياً · سوقا الإطلاق (مصر والسعودية)</p>
        </header>
        <BarterPricingEngine />
      </div>
    </main>
  );
}
