import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "إعادة تعيين كلمة المرور — بدِّل" },
      { name: "description", content: "أعد تعيين كلمة المرور لحسابك في منصة بدِّل بأمان." },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"request" | "update">("request");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If the user landed here from a recovery email, Supabase sets a recovery session.
    const hash = window.location.hash;
    if (hash.includes("type=recovery") || hash.includes("access_token")) {
      setMode("update");
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setMode("update");
    });
    return () => subscription.unsubscribe();
  }, []);

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success("تحقق من بريدك — أرسلنا رابط إعادة التعيين.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر إرسال الرابط");
    } finally {
      setLoading(false);
    }
  };

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("كلمتا المرور غير متطابقتين");
      return;
    }
    if (password.length < 8) {
      toast.error("يجب ألا تقل كلمة المرور عن 8 أحرف");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("تم تحديث كلمة المرور بنجاح.");
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "تعذّر التحديث");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen grid place-items-center bg-background px-4 font-body">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="font-display text-3xl font-extrabold text-primary">بدِّل</Link>
        </div>
        <h1 className="font-display text-2xl font-extrabold mb-2">
          {mode === "request" ? "نسيت كلمة المرور؟" : "اختر كلمة مرور جديدة"}
        </h1>
        <p className="text-sm text-muted-foreground mb-8">
          {mode === "request"
            ? "أدخل بريدك الإلكتروني وسنرسل رابطاً لإعادة التعيين."
            : "اكتب كلمة المرور الجديدة ثم أكّدها."}
        </p>

        {mode === "request" ? (
          <form onSubmit={requestReset} className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">
                البريد الإلكتروني
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-foreground text-background rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              إرسال الرابط
            </button>
          </form>
        ) : (
          <form onSubmit={updatePassword} className="space-y-4">
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">
                كلمة المرور الجديدة
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">
                تأكيد كلمة المرور
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full px-4 py-3 bg-foreground text-background rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              تحديث كلمة المرور
            </button>
          </form>
        )}

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link to="/auth" className="text-primary font-bold hover:underline">
            العودة لتسجيل الدخول
          </Link>
        </p>
      </div>
    </div>
  );
}
