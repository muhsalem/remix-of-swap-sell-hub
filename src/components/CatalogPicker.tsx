import { useMemo, useState } from "react";
import { FAMILIES, ITEMS, familiesByType, type FamilyEntry } from "@/lib/badel-catalog";
import { Package, Wrench, ChevronLeft, Sparkles } from "lucide-react";

export type CatalogPick = {
  familyId: string;
  family: FamilyEntry;
  itemName: string;
};

export function CatalogPicker({
  defaultCurrency,
  onPick,
}: {
  defaultCurrency: string;
  onPick: (side: "A" | "B", pick: CatalogPick) => void;
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

  return (
    <div className="rounded-3xl border border-[#d8cdb8] bg-gradient-to-br from-[#fdfbf6] to-[#f3ede1] p-5 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm font-bold text-[#0f4d39]">
          <Sparkles className="size-4 text-[#b3863a]" />
          كتالوج التصنيف الرباعي
        </div>
        <span className="text-[10px] text-[#4a5249] font-mono tracking-wider uppercase">
          NICE · HS · BEC · سيولة
        </span>
      </div>

      {/* المستوى 1: النوع الأساسي */}
      <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/60 border border-[#d8cdb8] mb-3">
        <button
          type="button"
          onClick={() => switchType("good")}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all ${
            type === "good" ? "bg-[#176b50] text-white shadow-sm" : "text-[#4a5249] hover:bg-white"
          }`}
        >
          <Package className="size-4" /> سلعة
        </button>
        <button
          type="button"
          onClick={() => switchType("service")}
          className={`flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-bold transition-all ${
            type === "service" ? "bg-[#176b50] text-white shadow-sm" : "text-[#4a5249] hover:bg-white"
          }`}
        >
          <Wrench className="size-4" /> خدمة
        </button>
      </div>

      {/* المستوى 2 و 3: التصنيف الفرعي + العائلة */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
        <div>
          <label className="text-[10px] font-bold text-[#4a5249] uppercase tracking-wider block mb-1">
            تصنيف فرعي ← عائلة
          </label>
          <select
            value={familyId}
            onChange={(e) => switchFamily(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#d8cdb8] text-sm font-medium text-[#20271f] outline-none focus:ring-2 focus:ring-[#176b50]/20"
          >
            {Object.entries(grouped).map(([sub, arr]) => (
              <optgroup key={sub} label={sub}>
                {arr.map((f) => (
                  <option key={f.id} value={f.id}>{f.entry.n}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] font-bold text-[#4a5249] uppercase tracking-wider block mb-1">
            الصنف المحدّد
          </label>
          <select
            value={itemName}
            onChange={(e) => setItemName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-white border border-[#d8cdb8] text-sm font-medium text-[#20271f] outline-none focus:ring-2 focus:ring-[#176b50]/20"
          >
            {items.map((it) => (
              <option key={it} value={it}>{it}</option>
            ))}
          </select>
        </div>
      </div>

      {/* وسوم الأكواد */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        <Chip color="#ece3d2" textColor="#6b5526">Nice {family.nice}</Chip>
        {family.bec && <Chip color="#efe7d6" textColor="#6b5526">{family.bec}</Chip>}
        {family.mkt && <Chip color="#e1f5ee" textColor="#0f4d39">سيولة: {family.mkt}</Chip>}
        {family.dep && <Chip color="#faece7" textColor="#712b13">إهلاك {Math.round(family.dep * 100)}%</Chip>}
        <Chip color="#f3ede1" textColor="#4a5249">{family.defaultUnit}</Chip>
      </div>

      {/* أزرار إضافة لكل طرف */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onPick("A", { familyId, family, itemName })}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#1c6b6b] text-white text-xs font-bold hover:bg-[#155454] transition-all shadow-sm"
        >
          أضف للطرف (أ) <ChevronLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPick("B", { familyId, family, itemName })}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-[#8a5a17] text-white text-xs font-bold hover:bg-[#6e4612] transition-all shadow-sm"
        >
          أضف للطرف (ب) <ChevronLeft className="size-3.5" />
        </button>
      </div>

      <p className="text-[11px] text-[#4a5249] mt-3 leading-relaxed">
        ⚡ اختر النوع، ثم العائلة من التصنيف الفرعي، ثم الصنف المحدد — تُملأ كل خصائص التسعير تلقائياً.
        لا تحتاج لمعرفة الفئة أو الوحدة، المحرك يستنتجها من معايير Nice الدولية.
      </p>
      <span className="sr-only">{defaultCurrency}</span>
    </div>
  );
}

function Chip({ children, color, textColor }: { children: React.ReactNode; color: string; textColor: string }) {
  return (
    <span
      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color, color: textColor }}
    >
      {children}
    </span>
  );
}
