import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/pricing-engine')({
  head: () => ({
    meta: [
      { title: 'محرك تسعير المقايضة — بدِّل' },
      { name: 'description', content: 'محرك تسعير ذكي للمقايضات متوافق شرعياً يدعم 30+ دولة و14 فئة.' },
    ],
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
