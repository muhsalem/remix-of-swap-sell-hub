import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createListing } from "@/lib/listings.functions";
import { analyzeProductImage } from "@/lib/vision.functions";
import { uploadListingImage } from "@/lib/storage";
import { computeImageHash } from "@/lib/image-hash";
import { supabase } from "@/integrations/supabase/client";
import { Nav } from "@/components/Nav";
import { toast } from "sonner";
import { listingErrorMessage } from "@/lib/user-error-messages";
import { Loader2, Upload, X, AlertTriangle, ShieldCheck, ChevronLeft, ChevronRight, Check, Sparkles } from "lucide-react";


export const Route = createFileRoute("/_authenticated/new-listing")({
  head: () => ({ meta: [{ title: "أضف عرضاً جديداً — بادل بادل" }] }),
  component: NewListing,
});

const CATEGORIES = ["إلكترونيات", "ساعات", "كاميرات", "أجهزة لوحية", "صوتيات", "وسائل تنقل", "ذهب وفضة", "أثاث", "كتب", "أخرى"];
const RIBAWI = ["ذهب وفضة"];

const STEPS = [
  { id: 1, label: "الأساسيات", hint: "ماذا تعرض؟" },
  { id: 2, label: "التفاصيل والصور", hint: "السعر والحالة" },
  { id: 3, label: "المراجعة والنشر", hint: "الإقرارات" },
] as const;

function NewListing() {
  const navigate = useNavigate();
  const fn = useServerFn(createListing);
  const [step, setStep] = useState(1);
  const [images, setImages] = useState<string[]>([]);
  const [imageHashes, setImageHashes] = useState<string[]>([]);
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
    listing_type: "item" as "item" | "service",
  });

  const isRibawi = RIBAWI.includes(form.category);

  const handleFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجّل");
      const uploaded: string[] = [];
      const hashes: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - images.length)) {
        if (file.size > 5 * 1024 * 1024) {
          toast.error(`${file.name}: يجب أن يكون أقل من 5MB`);
          continue;
        }
        const hash = await computeImageHash(file);
        if (hash) hashes.push(hash);
        const path = await uploadListingImage(file, user.id);
        uploaded.push(path);
      }
      setImages((prev) => [...prev, ...uploaded]);
      setImageHashes((prev) => [...prev, ...hashes]);
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
        image_hashes: imageHashes,
        is_ribawi: isRibawi,
        market_price: Number(form.market_price),
        age_months: Number(form.age_months),
      },
    }),
    onSuccess: (r) => {
      if (r.note) toast.warning(r.note, { duration: 8000 });
      else toast.success("تم نشر عرضك!");
      navigate({ to: "/listings/$id", params: { id: r.id } });
    },

    onError: (e) => {
      const friendly = listingErrorMessage(e);
      toast.error(friendly.title, {
        description: friendly.description,
        duration: friendly.isRateLimit ? 10000 : 7000,
      });
    },
  });

  const canNext1 = form.title.trim().length >= 3 && form.category && form.listing_type;
  const canNext2 = Number(form.market_price) > 0 && form.wants.trim().length >= 2;
  const canSubmit = canNext1 && canNext2 && ownsItem && acceptTerms;

  const goNext = () => {
    if (step === 1 && !canNext1) { toast.error("أكمل عنوان العرض وفئته أولاً"); return; }
    if (step === 2 && !canNext2) { toast.error("أدخل السعر السوقي وما تريد مقايضته"); return; }
    setStep((s) => Math.min(3, s + 1));
  };

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold mb-2 text-gradient">أضف عرضاً جديداً</h1>
        <p className="text-muted-foreground text-sm mb-8">3 خطوات فقط لنشر عرضك بتقييم AI عادل.</p>

        {/* Stepper */}
        <div className="glass rounded-2xl p-4 mb-6">
          <div className="flex items-center justify-between gap-2">
            {STEPS.map((s, i) => {
              const active = step === s.id;
              const done = step > s.id;
              return (
                <div key={s.id} className="flex-1 flex items-center gap-2 min-w-0">
                  <div className={`size-8 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 transition ${
                    done ? "bg-primary text-primary-foreground border-primary"
                    : active ? "bg-primary/10 text-primary border-primary"
                    : "bg-muted text-muted-foreground border-border"
                  }`}>
                    {done ? <Check className="size-4" /> : s.id}
                  </div>
                  <div className="min-w-0 hidden sm:block">
                    <div className={`text-xs font-bold truncate ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</div>
                    <div className="text-[10px] text-muted-foreground truncate">{s.hint}</div>
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${done ? "bg-primary" : "bg-border"}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <form
          onSubmit={(e) => { e.preventDefault(); if (step < 3) { goNext(); return; } if (canSubmit) mutation.mutate(); }}
          className="glass rounded-3xl p-8 space-y-6"
        >
          {step === 1 && (
            <>
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

              <Field label="نوع الإعلان *">
                <div className="flex gap-2">
                  {([
                    { v: "item", label: "سلعة", hint: "منتج مادي" },
                    { v: "service", label: "خدمة", hint: "استشارة، تدريب، عمل" },
                  ] as const).map((o) => (
                    <button
                      key={o.v}
                      type="button"
                      onClick={() => setForm({ ...form, listing_type: o.v })}
                      className={`flex-1 px-4 py-3 rounded-xl border text-sm font-bold transition ${
                        form.listing_type === o.v
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-stone-soft border-border hover:border-primary/40"
                      }`}
                    >
                      <div>{o.label}</div>
                      <div className="text-[10px] font-normal opacity-70 mt-0.5">{o.hint}</div>
                    </button>
                  ))}
                </div>
              </Field>

              <Field label="الفئة *">
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
                >
                  {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </Field>

              {isRibawi && (
                <div className="flex items-start gap-3 p-4 bg-accent/10 border border-accent/30 rounded-2xl">
                  <AlertTriangle className="size-5 text-accent flex-shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">
                    <strong>تنبيه شرعي:</strong> عند المقايضة بجنسه يُشترط <strong>التماثل في الوزن</strong> و<strong>التقابض في المجلس</strong>.
                  </div>
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
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
                <Field label="العمر (بالأشهر) *">
                  <input
                    type="number" min={0} max={360} required
                    value={form.age_months}
                    onChange={(e) => setForm({ ...form, age_months: Number(e.target.value) })}
                    className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
                  />
                </Field>
              </div>

              <Field label="السعر السوقي (ر.س) *">
                <input
                  type="number" min={1} required
                  value={form.market_price}
                  onChange={(e) => setForm({ ...form, market_price: Number(e.target.value) })}
                  className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm"
                />
              </Field>

              <Field label="ما الذي تريد مقايضته به؟ *">
                <input
                  required minLength={2} maxLength={200}
                  value={form.wants}
                  onChange={(e) => setForm({ ...form, wants: e.target.value })}
                  placeholder="مثال: لاب توب MacBook أو كاميرا"
                  className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none text-sm focus:ring-2 ring-primary/30"
                />
              </Field>

              <Field label="المدينة (اختياري)">
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
            </>
          )}

          {step === 3 && (
            <>
              <div className="rounded-2xl border border-border bg-stone-soft/50 p-5 space-y-2 text-sm">
                <div className="font-extrabold text-base mb-2 text-gradient">مراجعة العرض</div>
                <Row k="العنوان" v={form.title} />
                <Row k="النوع" v={form.listing_type === "item" ? "سلعة" : "خدمة"} />
                <Row k="الفئة" v={form.category} />
                <Row k="الحالة" v={form.condition} />
                <Row k="العمر" v={`${form.age_months} شهر`} />
                <Row k="السعر السوقي" v={`${form.market_price} ر.س`} />
                <Row k="يقايض بـ" v={form.wants} />
                {form.city && <Row k="المدينة" v={form.city} />}
                <Row k="الصور" v={`${images.length} صورة`} />
              </div>

              <div className="rounded-2xl border border-border bg-stone-soft/50 p-4 space-y-3">
                <div className="flex items-center gap-2 text-xs font-extrabold text-foreground">
                  <ShieldCheck className="size-4 text-primary" />
                  إقرارات ضرورية قبل النشر
                </div>
                <label className="flex items-start gap-2 cursor-pointer text-xs leading-relaxed">
                  <input
                    type="checkbox"
                    checked={ownsItem}
                    onChange={(e) => setOwnsItem(e.target.checked)}
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span>
                    أُقرّ بأنني <strong>المالك الشرعي</strong> لهذه السلعة/الخدمة، وأنها <strong>خالية من الرهن أو النزاع</strong>.
                  </span>
                </label>
                <label className="flex items-start gap-2 cursor-pointer text-xs leading-relaxed">
                  <input
                    type="checkbox"
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
            </>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-3 pt-2">
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(1, s - 1))}
              disabled={step === 1}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-bold hover:bg-stone-soft transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1"
            >
              <ChevronRight className="size-4" />
              السابق
            </button>

            {step < 3 ? (
              <button
                type="button"
                onClick={goNext}
                className="px-6 py-2.5 bg-foreground text-background rounded-xl font-bold text-sm hover:bg-primary transition flex items-center gap-1"
              >
                التالي
                <ChevronLeft className="size-4" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={mutation.isPending || uploading || !canSubmit}
                className="px-6 py-2.5 bg-foreground text-background rounded-xl font-bold text-sm hover:bg-primary transition disabled:opacity-50 flex items-center gap-2"
              >
                {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
                نشر العرض
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-xs">{k}</span>
      <span className="font-bold text-xs truncate">{v}</span>
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
