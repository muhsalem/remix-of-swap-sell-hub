import { Link } from "@tanstack/react-router";
import { Smartphone, Laptop, Car, Sofa, Watch, Briefcase } from "lucide-react";

const CATS = [
  { key: "هواتف", label: "هواتف وأجهزة", icon: Smartphone },
  { key: "حواسيب", label: "حواسيب وألعاب", icon: Laptop },
  { key: "وسائل تنقل", label: "وسائل تنقل", icon: Car },
  { key: "أثاث", label: "أثاث ومنزل", icon: Sofa },
  { key: "ساعات", label: "ساعات ومجوهرات", icon: Watch },
  { key: "خدمات مهنية", label: "خدمات وأعمال", icon: Briefcase },
];

export function CategoryQuickBar() {
  return (
    <section className="border-y border-border bg-card/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">
            ابدأ من فئة
          </h2>
          <Link to="/" hash="market" className="text-xs font-bold text-primary hover:underline">
            كل الفئات ←
          </Link>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CATS.map(({ key, label, icon: Icon }) => (
            <Link
              key={key}
              to="/"
              hash="market"
              search={{ cat: key } as never}
              className="group flex flex-col items-center gap-2 p-4 rounded-2xl bg-background hover:bg-primary/5 ring-1 ring-border hover:ring-primary/30 transition-all"
            >
              <div className="size-12 rounded-full bg-primary/10 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                <Icon className="size-5" />
              </div>
              <span className="text-xs font-bold text-center leading-tight">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
