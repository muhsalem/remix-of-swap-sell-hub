import { useMemo, useState } from "react";
import { FAMILIES, ITEMS, familiesByType, type FamilyEntry } from "@/lib/badel-catalog";
import { Package, Wrench, Plus, Sparkles } from "lucide-react";

export type CatalogPick = {
  familyId: string;
  family: FamilyEntry;
  itemName: string;
};

export function CatalogPicker({
  defaultCurrency,
  onPick,
  compact = false,
}: {
  defaultCurrency: string;
  onPick: (pick: CatalogPick) => void;
  compact?: boolean;
}) {
  const [type, setType] = useState<"good" | "service">("good");
  const [familyId, setFamilyId] = useState<string>("g7");
  const [itemName, setItemName] = useState<string>("هواتف ذكية");

  const grouped = useMemo(() => familiesByType(type), [type]);
  const family = FAMILIES[familyId];
  const items = ITEMS[familyId] || [];

  const switchType = (t: "good" | "service") => {
    setType(t);
    const first = Object.values(familiesByType(t))[0]?.[0];
    if (first) {
      setFamilyId(first.id);
      setItemName(ITEMS[first.id]?.[0] || first.entry.n);
    }
  };

  const switchFamily = (id: string) => {
    setFamilyId(id);
    setItemName(ITEMS[id]?.[0] || FAMILIES[id].n);
  };

  const handleAdd = () => onPick({ familyId, family, itemName });

  return (
    <div className={compact
      ? "rounded-2xl border border-border bg-card p-3"
      : "rounded-2xl border border-border bg-card p-4"
    }>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-sm font-extrabold text-foreground">
          <Sparkles className="size-4 text-primary" />
          أضف من الكتالوج
        </div>
        <div className="inline-flex p-0.5 rounded-lg bg-stone-soft border border-border">
          <button
            type="button"
            onClick={() => switchType("good")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all ${
              type === "good" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Package className="size-3" /> سلعة
          </button>
          <button
            type="button"
            onClick={() => switchType("service")}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-extrabold transition-all ${
              type === "service" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Wrench className="size-3" /> خدمة
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
        <select
          value={familyId}
          onChange={(e) => switchFamily(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        >
          {Object.entries(grouped).map(([sub, arr]) => (
            <optgroup key={sub} label={sub}>
              {arr.map((f) => (
                <option key={f.id} value={f.id}>{f.entry.n}</option>
              ))}
            </optgroup>
          ))}
        </select>
        <select
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          className="px-3 py-2.5 rounded-xl bg-stone-soft border border-border text-sm font-bold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
        >
          {items.map((it) => (
            <option key={it} value={it}>{it}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleAdd}
          className="px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-extrabold hover:opacity-90 transition-all shadow-sm flex items-center justify-center gap-1.5"
        >
          <Plus className="size-4" /> أضف
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        <Chip>{family.defaultUnit}</Chip>
        {family.mkt && <Chip>سيولة: {family.mkt}</Chip>}
        {family.dep && <Chip>إهلاك {Math.round(family.dep * 100)}%</Chip>}
        <Chip>Nice {family.nice}</Chip>
      </div>
      <span className="sr-only">{defaultCurrency}</span>
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-stone-soft text-muted-foreground border border-border">
      {children}
    </span>
  );
}
