import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/pricing-engine')({
  head: () => ({
    meta: [
      { title: 'محرك تسعير المقايضة — بدِّل' },
      { name: 'description', content: 'محرك تسعير ذكي للمقايضات متوافق شرعياً يدعم مصر والسعودية و14 فئة سلع وخدمات.' },
      { property: 'og:title', content: 'محرك تسعير المقايضة الذكي — بدِّل' },
      { property: 'og:description', content: 'قيّم عروضك بعدالة عبر محرك تسعير ذكي متوافق شرعياً.' },
      { property: 'og:url', content: 'https://badelbarter.lovable.app/pricing-engine' },
    ],
    links: [{ rel: 'canonical', href: 'https://badelbarter.lovable.app/pricing-engine' }],
  }),
  component: PricingEnginePage,
});

function PricingEnginePage() {
  return (
    <iframe
      src="/pricing-engine/index.html"
      title="محرك تسعير المقايضة"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 'none' }}
    />
  );
}
