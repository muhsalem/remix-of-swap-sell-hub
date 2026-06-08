import { Link } from "@tanstack/react-router";
import { Smartphone, Laptop, Car, Sofa, Watch, Briefcase } from "lucide-react";

const CATS = [
  { key: "هواتف وأجهزة", icon: Smartphone },
  { key: "حواسيب وألعاب", icon: Laptop },
  { key: "وسائل تنقل", icon: Car },
  { key: "أثاث ومنزل", icon: Sofa },
  { key: "ساعات ومجوهرات", icon: Watch },
  { key: "خدمات وأعمال", icon: Briefcase },
];

export function CategoryQuickBar({ active }: { active?: string }) {
  return (
    <section className="border-y border-border bg-card/50 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">ابدأ من فئة</h2>
          <Link to="/" hash="market" search={{} as never} className="text-xs font-bold text-primary hover:underline">
            كل الفئات ←
          </Link>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
          {CATS.map(({ key, icon: Icon }) => {
            const isActive = active === key;
            return (
              <Link
                key={key}
                to="/"
                hash="market"
                search={{ cat: isActive ? "" : key } as never}
                className={`group flex flex-col items-center gap-2 p-4 rounded-2xl ring-1 transition-all ${
                  isActive
                    ? "bg-primary/10 ring-primary text-primary"
                    : "bg-background hover:bg-primary/5 ring-border hover:ring-primary/30"
                }`}
              >
                <div
                  className={`size-12 rounded-full flex items-center justify-center transition-colors ${
                    isActive ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground"
                  }`}
                >
                  <Icon className="size-5" />
                </div>
                <span className="text-xs font-bold text-center leading-tight">{key}</span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
