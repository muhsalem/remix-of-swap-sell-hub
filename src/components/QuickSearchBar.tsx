import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

type Props = {
  q: string;
  cat: string;
  cond: string;
  sort: string;
};

export function QuickSearchBar({ q, cat, cond, sort }: Props) {
  const navigate = useNavigate({ from: "/" });
  const [value, setValue] = useState(q);
  const [open, setOpen] = useState(false);

  const apply = (patch: Partial<Props>) => {
    navigate({
      to: "/",
      hash: "market",
      search: (prev: any) => ({ ...prev, ...patch }),
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    apply({ q: value });
  };

  const clear = () => {
    setValue("");
    navigate({ to: "/", hash: "market", search: {} as never });
  };

  const active = !!(q || cat || cond || (sort && sort !== "newest"));

  return (
    <div className="sticky top-0 z-30 -mt-1 bg-background/85 backdrop-blur border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-3">
        <form onSubmit={submit} className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="search"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={cat ? `بحث داخل: ${cat}` : "بحث سريع في السوق..."}
              className="w-full pr-10 pl-3 py-2.5 rounded-full bg-card border border-border outline-none focus:ring-2 ring-primary/30 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-2 rounded-full border transition ${
              open || active ? "bg-primary/10 border-primary/40 text-primary" : "bg-card border-border hover:border-primary/40"
            }`}
          >
            <SlidersHorizontal className="size-3.5" /> فلاتر
          </button>
          <button type="submit" className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90">
            بحث
          </button>
          {active && (
            <button type="button" onClick={clear} className="p-2 rounded-full hover:bg-stone-soft" title="مسح الفلاتر">
              <X className="size-4" />
            </button>
          )}
        </form>

        {open && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            <select
              value={cond}
              onChange={(e) => apply({ cond: e.target.value })}
              className="px-3 py-2 rounded-xl bg-card border border-border text-xs outline-none focus:ring-2 ring-primary/30"
            >
              <option value="">الحالة: الكل</option>
              <option value="new">جديد</option>
              <option value="like-new">شبه جديد</option>
              <option value="good">جيد</option>
              <option value="fair">مقبول</option>
            </select>
            <select
              value={sort || "newest"}
              onChange={(e) => apply({ sort: e.target.value })}
              className="px-3 py-2 rounded-xl bg-card border border-border text-xs outline-none focus:ring-2 ring-primary/30"
            >
              <option value="newest">الأحدث</option>
              <option value="price-asc">السعر: الأقل</option>
              <option value="price-desc">السعر: الأعلى</option>
            </select>
            {cat && (
              <button
                type="button"
                onClick={() => apply({ cat: "" })}
                className="px-3 py-2 rounded-xl bg-primary/10 text-primary text-xs font-bold inline-flex items-center justify-center gap-1.5"
              >
                <X className="size-3.5" /> إزالة فئة «{cat}»
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
