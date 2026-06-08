import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown } from "lucide-react";
import { Nav } from "@/components/Nav";

export const Route = createFileRoute("/premium")({
  head: () => ({
    meta: [
      { title: "بادل Premium — قريباً" },
      { name: "description", content: "باقات بادل Premium ومكافآت الإحالة ستُتاح قريباً مع إطلاق المرحلة الثانية." },
    ],
  }),
  component: PremiumGate,
});

function PremiumGate() {
  return (
    <div dir="rtl" className="min-h-screen bg-background text-foreground font-body">
      <Nav />
      <main className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <div className="size-20 mx-auto rounded-full bg-amber-500/10 grid place-items-center">
          <Crown className="size-10 text-amber-500" />
        </div>
        <h1 className="font-display text-3xl md:text-4xl font-black">بادل Premium — قريباً</h1>
        <p className="text-muted-foreground leading-relaxed">
          نحن في <b>المرحلة الأولى</b>: جميع المقايضات والإعلانات مجانية بالكامل.
          باقات Premium وبرنامج الإحالة سيُطلقان في <b>المرحلة الثانية</b>.
        </p>
        <Link
          to="/"
          className="inline-flex items-center gap-2 px-5 py-3 rounded-full bg-primary text-primary-foreground font-bold"
        >
          العودة للرئيسية
        </Link>
      </main>
    </div>
  );
}
