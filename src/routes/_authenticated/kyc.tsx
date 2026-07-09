import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { runKycAi, type KycAiResult } from "@/lib/kyc.functions";
import { ShieldCheck, Upload, Loader2, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/kyc")({
  head: () => ({
    meta: [
      { title: "توثيق الهوية الآلي — بدِّل" },
      { name: "description", content: "وثّق هويتك تلقائياً عبر الذكاء الاصطناعي واحصل على شارة التوثيق فوراً." },
    ],
  }),
  component: KycPage,
});

function KycPage() {
  const runKyc = useServerFn(runKycAi);
  const [fullName, setFullName] = useState("");
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<KycAiResult | null>(null);

  async function readFile(f: File): Promise<string> {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload = () => res(String(r.result));
      r.onerror = rej;
      r.readAsDataURL(f);
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!idImage || !fullName.trim()) {
      toast.error("الاسم وصورة الهوية مطلوبان");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const r = await runKyc({ data: { idFrontBase64: idImage, selfieBase64: selfie ?? undefined, fullName: fullName.trim() } });
      setResult(r);
      if (r.decision === "approved") toast.success("تم التوثيق بنجاح ✓");
      else if (r.decision === "review") toast.info("سيتم مراجعة طلبك يدوياً");
      else toast.error("تعذّر التوثيق — راجع الأسباب");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "فشل التحقق");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main dir="rtl" className="mx-auto max-w-2xl px-4 py-10">
      <header className="mb-6 text-center">
        <div className="mx-auto mb-3 inline-flex items-center justify-center rounded-full bg-cyan-50 p-3">
          <ShieldCheck className="h-7 w-7 text-cyan-600" />
        </div>
        <h1 className="text-2xl font-bold">توثيق الهوية بالذكاء الاصطناعي</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          ارفع صورة هويتك ونفحصها فوراً. عند الموافقة تحصل على شارة التوثيق سنة كاملة.
        </p>
      </header>

      <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">الاسم الكامل (كما في الهوية)</span>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            maxLength={120}
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
        </label>

        <FileField
          label="صورة الهوية الوطنية / الإقامة (الوجه الأمامي)"
          value={idImage}
          onChange={async (f) => setIdImage(await readFile(f))}
          required
        />

        <FileField
          label="سيلفي (اختياري — يزيد دقة المطابقة)"
          value={selfie}
          onChange={async (f) => setSelfie(await readFile(f))}
        />

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
        >
          {loading ? <><Loader2 className="h-4 w-4 animate-spin" /> جاري التحقق...</> : "ابدأ التحقق الآلي"}
        </button>
      </form>

      {result && (
        <div className={`mt-6 rounded-2xl border p-5 ${
          result.decision === "approved" ? "border-emerald-200 bg-emerald-50" :
          result.decision === "review" ? "border-amber-200 bg-amber-50" :
          "border-red-200 bg-red-50"
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {result.decision === "approved" && <><CheckCircle2 className="h-5 w-5 text-emerald-600" /> تمّت الموافقة</>}
            {result.decision === "review" && <><AlertTriangle className="h-5 w-5 text-amber-600" /> بحاجة لمراجعة يدوية</>}
            {result.decision === "rejected" && <><XCircle className="h-5 w-5 text-red-600" /> تم الرفض</>}
            <span className="ms-auto text-sm">درجة الثقة: {result.score}%</span>
          </div>
          {result.reasons.length > 0 && (
            <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-muted-foreground">
              {result.reasons.map((r, i) => <li key={i}>{r}</li>)}
            </ul>
          )}
        </div>
      )}

      <p className="mt-4 text-center text-xs text-muted-foreground">
        بياناتك مشفّرة ولا تُشارك مع أطراف ثالثة. يمكن للمشرف مراجعة الطلبات الحدّية.
      </p>
    </main>
  );
}

function FileField({
  label, value, onChange, required,
}: { label: string; value: string | null; onChange: (f: File) => void; required?: boolean }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <div className="flex items-center gap-3 rounded-lg border border-dashed bg-background p-3">
        <Upload className="h-4 w-4 text-muted-foreground" />
        <input
          type="file"
          accept="image/*"
          required={required && !value}
          onChange={(e) => e.target.files?.[0] && onChange(e.target.files[0])}
          className="flex-1 text-xs"
        />
        {value && <img src={value} alt="" className="h-10 w-10 rounded object-cover" />}
      </div>
    </label>
  );
}
