import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { createListing } from "@/lib/listings.functions";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/bulk-import")({
  component: BulkImportPage,
  head: () => ({
    meta: [
      { title: "استيراد جماعي للإعلانات — بَدِّل للشركات" },
      { name: "description", content: "ارفع ملف CSV لنشر عشرات الإعلانات دفعة واحدة على منصة بَدِّل — مخصص للمتاجر والشركات لتصريف المخزون الراكد." },
      { property: "og:title", content: "استيراد جماعي للإعلانات — بَدِّل للشركات" },
      { property: "og:description", content: "انشر مخزونك الراكد دفعة واحدة عبر ملف CSV مع تحقق فوري من كل صف." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const CONDITIONS = ["new", "like-new", "excellent", "good", "fair"] as const;
type Condition = (typeof CONDITIONS)[number];

const TEMPLATE = `title,category,condition,age_months,market_price,wants,description,city
آيفون 14 برو 256,إلكترونيات,excellent,14,3200,لابتوب أو ساعة ذكية,بحالة ممتازة مع العلبة,الرياض
ساعة سامسونج ووتش 6,ساعات,like-new,6,850,سماعات لاسلكية,استخدام خفيف,جدة`;

type Row = {
  line: number;
  title: string;
  category: string;
  condition: Condition;
  age_months: number;
  market_price: number;
  wants: string;
  description: string;
  city: string;
  error?: string;
  status?: "pending" | "ok" | "failed";
  message?: string;
};

function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") { out.push(cur); cur = ""; }
    else cur += ch;
  }
  out.push(cur);
  return out.map((v) => v.trim());
}

function parseCsv(text: string): Row[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const header = splitCsvLine(lines[0]!).map((h) => h.toLowerCase());
  const idx = (k: string) => header.indexOf(k);
  const rows: Row[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvLine(lines[i]!);
    const get = (k: string) => (idx(k) >= 0 ? (cells[idx(k)] ?? "") : "");
    const price = Number(get("market_price"));
    const age = Number(get("age_months") || "0");
    const cond = get("condition") as Condition;
    const row: Row = {
      line: i + 1,
      title: get("title"),
      category: get("category"),
      condition: CONDITIONS.includes(cond) ? cond : "good",
      age_months: Number.isFinite(age) ? Math.max(0, Math.min(360, Math.round(age))) : 0,
      market_price: price,
      wants: get("wants"),
      description: get("description"),
      city: get("city"),
      status: "pending",
    };
    if (row.title.length < 3) row.error = "العنوان قصير جداً (3 أحرف على الأقل)";
    else if (!row.category) row.error = "الفئة مطلوبة";
    else if (!Number.isFinite(price) || price <= 0) row.error = "السعر السوقي غير صالح";
    else if (row.wants.length < 2) row.error = "حقل «ما تريد مقايضته» مطلوب";
    else if (!CONDITIONS.includes(cond)) row.error = `الحالة غير معروفة (${get("condition") || "فارغة"}) — استُخدم good`;
    rows.push(row);
  }
  return rows;
}

function BulkImportPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const create = useServerFn(createListing);

  const valid = rows.filter((r) => !r.error || r.error.startsWith("الحالة غير معروفة"));
  const blocked = rows.length - valid.length;

  const onFile = async (file: File) => {
    if (file.size > 2_000_000) { toast.error("حجم الملف يجب أن يكون أقل من 2MB"); return; }
    const text = await file.text();
    const parsed = parseCsv(text);
    if (parsed.length === 0) { toast.error("الملف فارغ أو لا يحتوي على صفوف صالحة"); return; }
    if (parsed.length > 200) { toast.error("الحد الأقصى 200 صف في الملف الواحد"); return; }
    setRows(parsed);
    toast.success(`تم قراءة ${parsed.length} صف`);
  };

  const publish = async () => {
    setBusy(true);
    let ok = 0;
    let fail = 0;
    for (const row of valid) {
      try {
        await create({
          data: {
            title: row.title,
            description: row.description,
            category: row.category,
            condition: row.condition,
            age_months: row.age_months,
            market_price: row.market_price,
            wants: row.wants,
            images: [],
            is_ribawi: false,
            city: row.city || "",
            listing_type: "item",
            image_hashes: [],
          },
        });
        ok++;
        setRows((prev) => prev.map((r) => (r.line === row.line ? { ...r, status: "ok", message: "تم النشر" } : r)));
      } catch (e) {
        fail++;
        const msg = e instanceof Error ? e.message : "فشل النشر";
        setRows((prev) => prev.map((r) => (r.line === row.line ? { ...r, status: "failed", message: msg } : r)));
      }
    }
    setBusy(false);
    if (ok) toast.success(`تم نشر ${ok} إعلان${fail ? ` — فشل ${fail}` : ""}`);
    else toast.error("لم يتم نشر أي إعلان — راجع الأخطاء في الجدول");
  };

  const downloadTemplate = () => {
    const blob = new Blob(["\uFEFF" + TEMPLATE], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "badel-bulk-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <Nav />
      <main className="flex-1 max-w-5xl mx-auto w-full px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          الاستيراد الجماعي للإعلانات
        </h1>
        <p className="text-sm text-muted-foreground mt-2 leading-7 max-w-2xl">
          مخصّص للمتاجر والشركات: ارفع ملف CSV واحد لنشر مخزونك الراكد دفعة واحدة. يمرّ كل صف على نفس
          فحوص المنصة (الفحص الشرعي، مرجع القيمة العادلة، وحدود الاستخدام).
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-bold cursor-pointer hover:bg-primary transition-colors">
            <Upload className="size-4" /> اختر ملف CSV
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void onFile(f); e.target.value = ""; }}
            />
          </label>
          <button
            onClick={downloadTemplate}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full ring-1 ring-border text-sm font-bold hover:bg-stone-soft transition-colors"
          >
            <FileSpreadsheet className="size-4" /> تنزيل القالب
          </button>
          <Link to="/new-listing" className="text-sm text-muted-foreground hover:text-primary underline underline-offset-4">
            أو أضف إعلاناً واحداً يدوياً
          </Link>
        </div>

        {rows.length > 0 && (
          <section className="mt-8">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <p className="text-sm text-muted-foreground">
                {rows.length} صف — <span className="text-primary font-bold">{valid.length} جاهز</span>
                {blocked > 0 && <span className="text-destructive font-bold"> · {blocked} به أخطاء</span>}
              </p>
              <button
                disabled={busy || valid.length === 0}
                onClick={() => void publish()}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground text-sm font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
                نشر الصفوف الجاهزة
              </button>
            </div>

            <div className="overflow-x-auto rounded-2xl ring-1 ring-border">
              <table className="w-full text-right text-sm">
                <thead className="bg-stone-soft text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 font-bold">#</th>
                    <th className="p-3 font-bold">العنوان</th>
                    <th className="p-3 font-bold">الفئة</th>
                    <th className="p-3 font-bold">الحالة</th>
                    <th className="p-3 font-bold">السعر</th>
                    <th className="p-3 font-bold">يريد</th>
                    <th className="p-3 font-bold">النتيجة</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.line} className="border-t border-border align-top">
                      <td className="p-3 text-muted-foreground">{r.line}</td>
                      <td className="p-3 font-medium text-foreground">{r.title || "—"}</td>
                      <td className="p-3">{r.category || "—"}</td>
                      <td className="p-3">{r.condition}</td>
                      <td className="p-3 tabular-nums">{Number.isFinite(r.market_price) ? r.market_price : "—"}</td>
                      <td className="p-3">{r.wants || "—"}</td>
                      <td className="p-3 text-xs">
                        {r.status === "ok" ? (
                          <span className="inline-flex items-center gap-1 text-primary font-bold">
                            <CheckCircle2 className="size-3.5" /> {r.message}
                          </span>
                        ) : r.status === "failed" ? (
                          <span className="inline-flex items-center gap-1 text-destructive font-bold">
                            <XCircle className="size-3.5" /> {r.message}
                          </span>
                        ) : r.error ? (
                          <span className="text-destructive">{r.error}</span>
                        ) : (
                          <span className="text-muted-foreground">جاهز</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </main>
      <Footer />
    </div>
  );
}
