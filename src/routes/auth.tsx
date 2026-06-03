import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { TERMS_VERSION } from "./legal.$doc";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — بادل بادل" },
      { name: "description", content: "أنشئ حسابك في منصة بادل لبدء عرض ومقايضة منتجاتك بعدالة." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [accountType, setAccountType] = useState<"individual" | "company">("individual");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [loading, setLoading] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/" });
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/" });
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (!acceptedTerms) {
          toast.error("يجب الموافقة على الشروط وسياسة الخصوصية للمتابعة");
          setLoading(false);
          return;
        }
        const displayName = accountType === "company"
          ? (companyName || name || email.split("@")[0])
          : (name || email.split("@")[0]);
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              display_name: displayName,
              account_type: accountType,
              company_name: accountType === "company" ? companyName : null,
              terms_accepted: "true",
              terms_version: TERMS_VERSION,
            },
            emailRedirectTo: `${window.location.origin}/`,
          },
        });
        if (error) throw error;
        toast.success("تم إنشاء حسابك! تحقق من بريدك لتفعيله.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("مرحباً بعودتك!");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "حدث خطأ";
      toast.error(
        msg.includes("Invalid login") ? "البريد أو كلمة المرور غير صحيحة"
        : msg.includes("already registered") ? "هذا البريد مسجّل مسبقاً"
        : msg
      );
    } finally {
      setLoading(false);
    }
  };

  const google = async () => {
    setLoading(true);
    try {
      await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    } catch (e) {
      toast.error("تعذّر الدخول بـ Google");
      setLoading(false);
    }
  };

  return (
    <div dir="rtl" className="min-h-screen grid lg:grid-cols-2 bg-background font-body">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary to-accent text-primary-foreground">
        <Link to="/" className="font-display text-3xl font-extrabold tracking-tighter">
          بادل بادل
        </Link>
        <div>
          <h2 className="font-display text-4xl font-extrabold leading-tight mb-4">
            انضمّ لأول منصة مقايضة ذكية في العالم العربي.
          </h2>
          <p className="opacity-90 leading-relaxed">
            اعرض منتجاتك، احسب عدالة المقايضة، وتبادل بثقة مع آلاف المستخدمين.
          </p>
        </div>
        <div className="text-xs opacity-70 font-mono">© 2026 بادل AI ENGINE</div>
      </div>

      <div className="flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden text-center mb-8">
            <Link to="/" className="font-display text-3xl font-extrabold text-primary">بادل بادل</Link>
          </div>
          <h1 className="font-display text-3xl font-extrabold mb-2">
            {mode === "signin" ? "مرحباً بعودتك" : "أنشئ حسابك"}
          </h1>
          <p className="text-sm text-muted-foreground mb-8">
            {mode === "signin" ? "سجّل دخولك لإدارة عروضك" : "ابدأ بنشر عرضك الأول مجاناً"}
          </p>

          <button
            onClick={google}
            disabled={loading}
            className="w-full mb-6 px-4 py-3 border border-border rounded-xl bg-card hover:bg-stone-soft transition-all font-bold text-sm flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <svg className="size-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
            متابعة بحساب Google
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground">أو</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <>
                <div>
                  <label className="text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">نوع الحساب</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setAccountType("individual")}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        accountType === "individual"
                          ? "bg-foreground text-background border-foreground"
                          : "bg-stone-soft border-border hover:bg-stone-soft/70"
                      }`}
                    >
                      فرد
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountType("company")}
                      className={`px-3 py-2.5 rounded-xl text-sm font-bold border transition-all ${
                        accountType === "company"
                          ? "bg-foreground text-background border-foreground"
                          : "bg-stone-soft border-border hover:bg-stone-soft/70"
                      }`}
                    >
                      شركة
                    </button>
                  </div>
                </div>
                {accountType === "company" && (
                  <Field label="اسم الشركة">
                    <input
                      type="text"
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      required
                      maxLength={120}
                      className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
                    />
                  </Field>
                )}
                <Field label={accountType === "company" ? "اسم المسؤول" : "الاسم"}>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    maxLength={60}
                    className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
                  />
                </Field>
              </>
            )}
            <Field label="البريد الإلكتروني">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
              />
            </Field>
            <Field label="كلمة المرور">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border focus:ring-2 ring-primary/30 outline-none text-sm"
              />
            </Field>
            {mode === "signup" && (
              <label className="flex items-start gap-2 text-xs text-muted-foreground leading-relaxed cursor-pointer">
                <input
                  type="checkbox"
                  checked={acceptedTerms}
                  onChange={(e) => setAcceptedTerms(e.target.checked)}
                  className="mt-0.5 size-4 accent-primary"
                />
                <span>
                  أوافق على{" "}
                  <Link to="/legal/$doc" params={{ doc: "terms" }} target="_blank" className="text-primary font-bold hover:underline">شروط الاستخدام</Link>
                  {" "}و{" "}
                  <Link to="/legal/$doc" params={{ doc: "privacy" }} target="_blank" className="text-primary font-bold hover:underline">سياسة الخصوصية</Link>
                  {" "}و{" "}
                  <Link to="/legal/$doc" params={{ doc: "anti-riba" }} target="_blank" className="text-primary font-bold hover:underline">سياسة مكافحة الربا</Link>.
                </span>
              </label>
            )}
            <button
              type="submit"
              disabled={loading || (mode === "signup" && !acceptedTerms)}
              className="w-full px-4 py-3 bg-foreground text-background rounded-xl font-bold text-sm hover:bg-primary transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="size-4 animate-spin" />}
              {mode === "signin" ? "تسجيل الدخول" : "إنشاء الحساب"}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground mt-6">
            {mode === "signin" ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}{" "}
            <button
              onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
              className="text-primary font-bold hover:underline"
            >
              {mode === "signin" ? "أنشئ حساباً" : "سجّل دخولك"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[11px] uppercase tracking-widest text-muted-foreground block mb-1.5 font-bold">{label}</label>
      {children}
    </div>
  );
}
