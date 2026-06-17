import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createListing } from "@/lib/listings.functions";
import { uploadListingImage } from "@/lib/storage";
import { supabase } from "@/integrations/supabase/client";
import { Nav } from "@/components/Nav";
import { toast } from "sonner";
import { Loader2, Upload, X, AlertTriangle, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/_authenticated/new-listing")({
  head: () => ({ meta: [{ title: "أضف عرضاً جديداً — بادل بادل" }] }),
  component: NewListing,
});

const CATEGORIES = ["إلكترونيات", "ساعات", "كاميرات", "أجهزة لوحية", "صوتيات", "وسائل تنقل", "ذهب وفضة", "أثاث", "كتب", "أخرى"];
const RIBAWI = ["ذهب وفضة"];

function NewListing() {
  const navigate = useNavigate();
  const fn = useServerFn(createListing);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [ownsItem, setOwnsItem] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "إلكترونيات",
    condition: "excellent" as const,
    age_months: 0,
    market_price: 0,
    wants: "",
    city: "",
  });

  const isRibawi = RIBAWI.includes(form.category);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجّل");
      const uploaded: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - images.length)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: يجب أن يكون أقل من 5MB`);
          continue;
        }
        const path = await uploadListingImage(file, user.id);
        uploaded.push(path);
      }
      setImages((prev) => [...prev, ...uploaded]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "فشل رفع الصورة");
    } finally {
      setUploading(false);
    }
  };

  const mutation = useMutation({
    mutationFn: () => fn({
      data: {
        ...form,
        images,
        is_ribawi: isRibawi,
        market_price: Number(form.market_price),
        age_months: Number(form.age_months),
      },
    }),
    onSuccess: (r) => {
      toast.success("تم نشر عرضك!");
      navigate({ to: "/listings/$id", params: { id: r.id } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل النشر"),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold mb-2">أضف عرضاً جديداً</h1>
        <p className="text-muted-foreground text-sm mb-8">املأ بيانات منتجك بدقة لتحصل على تقييم AI عادل.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }}
          className="bg-card rounded-3xl p-8 ring-1 ring-black/5 space-y-6"
        >
          <Field label="عنوان المنتج *">
            <input
              required minLength={3} maxLength={120}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="مثال: آيفون 14 برو 256 جيجا"
              className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm focus:ring-2 ring-primary/30"
            />
          </Field>

          <Field label="الوصف">
            <textarea
              maxLength={2000}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              placeholder="حالة المنتج، الملحقات، أي عيوب..."
              className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm focus:ring-2 ring-primary/30 resize-none"
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="الفئة *">
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
              >
                {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="الحالة *">
              <select
                value={form.condition}
                onChange={(e) => setForm({ ...form, condition: e.target.value as typeof form.condition })}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
              >
                <option value="new">جديد</option>
                <option value="like-new">كالجديد</option>
                <option value="excellent">ممتاز</option>
                <option value="good">جيد</option>
                <option value="fair">مقبول</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="العمر (بالأشهر) *">
              <input
                type="number" min={0} max={360} required
                value={form.age_months}
                onChange={(e) => setForm({ ...form, age_months: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
              />
            </Field>
            <Field label="السعر السوقي (ر.س) *">
              <input
                type="number" min={1} required
                value={form.market_price}
                onChange={(e) => setForm({ ...form, market_price: Number(e.target.value) })}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
              />
            </Field>
          </div>

          <Field label="ما الذي تريد مقايضته به؟ *">
            <input
              required minLength={2} maxLength={200}
              value={form.wants}
              onChange={(e) => setForm({ ...form, wants: e.target.value })}
              placeholder="مثال: لاب توب MacBook أو كاميرا"
              className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm focus:ring-2 ring-primary/30"
            />
          </Field>

          <Field label="المدينة (اختياري — يساعد المشترين القريبين على إيجادك)">
            <input
              list="city-suggestions"
              minLength={2} maxLength={60}
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="مثال: الرياض، جدة، الدمام..."
              className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm focus:ring-2 ring-primary/30"
            />
            <datalist id="city-suggestions">
              {["الرياض","جدة","مكة المكرمة","المدينة المنورة","الدمام","الخبر","الظهران","الطائف","تبوك","بريدة","أبها","خميس مشيط","حائل","نجران","جازان","ينبع","الأحساء","القطيف"].map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>

          <Field label="الصور (حتى 8 صور)">
            <div className="grid grid-cols-4 gap-3">
              {images.map((path) => (
                <div key={path} className="relative aspect-square bg-stone-soft rounded-xl overflow-hidden group">
                  <ImagePreview path={path} />
                  <button
                    type="button"
                    onClick={() => setImages((p) => p.filter((x) => x !== path))}
                    className="absolute top-1 left-1 p-1 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100"
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
              {images.length < 8 && (
                <label className="aspect-square rounded-xl border-2 border-dashed border-border flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all">
                  {uploading ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : <Upload className="size-5 text-muted-foreground" />}
                  <span className="text-[10px] text-muted-foreground mt-1">أضف صورة</span>
                  <input
                    type="file" accept="image/*" multiple hidden
                    onChange={(e) => handleFiles(e.target.files)}
                  />
                </label>
              )}
            </div>
          </Field>

          {isRibawi && (
            <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-2xl">
              <AlertTriangle className="size-5 text-accent flex-shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong>تنبيه شرعي:</strong> هذا الصنف من الأصناف الربوية. عند المقايضة بجنسه (ذهب بذهب مثلاً) يُشترط شرعاً <strong>التماثل في الوزن</strong> و<strong>التقابض في المجلس</strong> لتجنّب ربا الفضل.
              </div>
            </div>
          )}

          {/* Ownership & legal acknowledgment */}
          <div className="rounded-2xl border border-border bg-stone-soft/50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              إقرارات ضرورية قبل النشر
            </div>
            <label className="flex items-start gap-2 cursor-pointer text-xs leading-relaxed">
              <input
                type="checkbox"
                required
                checked={ownsItem}
                onChange={(e) => setOwnsItem(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                أُقرّ بأنني <strong>المالك الشرعي</strong> لهذه السلعة/الخدمة، وأنها <strong>خالية من الرهن أو النزاع</strong>، ويحق لي التصرف فيها قانونياً.
              </span>
            </label>
            <label className="flex items-start gap-2 cursor-pointer text-xs leading-relaxed">
              <input
                type="checkbox"
                required
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                وافقت على{" "}
                <Link to="/legal/$doc" params={{ doc: "terms" }} className="text-primary underline">شروط الاستخدام</Link>{" "}و{" "}
                <Link to="/legal/$doc" params={{ doc: "barter-agreement" }} className="text-primary underline">اتفاقية المقايضة</Link>{" "}و{" "}
                <Link to="/legal/$doc" params={{ doc: "anti-riba" }} className="text-primary underline">سياسة مكافحة الربا</Link>.
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={mutation.isPending || uploading || !ownsItem || !acceptTerms}
            className="w-full px-6 py-3.5 bg-foreground text-background rounded-xl font-bold hover:bg-primary transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
            نشر العرض
          </button>
        </form>
      </main>
    </div>
  );
}

function ImagePreview({ path }: { path: string }) {
  const [url, setUrl] = useState("");
  useState(() => {
    supabase.storage.from("listing-images").createSignedUrl(path, 3600).then(({ data }) => {
      if (data?.signedUrl) setUrl(data.signedUrl);
    });
  });
  return url ? <img src={url} alt="" className="w-full h-full object-cover" /> : null;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground block mb-2 font-bold">{label}</label>
      {children}
    </div>
  );
}
