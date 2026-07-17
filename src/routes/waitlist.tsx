import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { joinWaitlist, getWaitlistStats } from "@/lib/waitlist.functions";
import { captureUtm, readUtm } from "@/lib/utm";
import { track } from "@/lib/analytics";

export const Route = createFileRoute("/waitlist")({
  head: () => ({
    meta: [
      { title: "انضم إلى قائمة الانتظار — بدل | منصة المقايضة الأولى" },
      {
        name: "description",
        content:
          "سجّل بريدك الآن واحصل على وصول مبكّر مجاني لمنصة بدل — أول منصة مقايضة ذكية في مصر والسعودية. مقايضات مجانية بدون عمولة لأول 1000 مستخدم.",
      },
      { property: "og:title", content: "بدل — قائمة الانتظار للوصول المبكّر" },
      {
        property: "og:description",
        content: "منصة مقايضة ذكية بلا عمولة للمرحلة الأولى. سجّل الآن قبل بدء البيتا.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WaitlistPage,
  errorComponent: ({ error }) => (
    <div dir="rtl" className="p-8 text-destructive font-body">{error.message}</div>
  ),
  notFoundComponent: () => (
    <div dir="rtl" className="p-8 font-body">الصفحة غير موجودة</div>
  ),
});

function WaitlistPage() {
  const submitFn = useServerFn(joinWaitlist);
  const statsFn = useServerFn(getWaitlistStats);

  const { data: stats } = useQuery({
    queryKey: ["waitlist-stats"],
    queryFn: () => statsFn(),
    staleTime: 60_000,
  });

  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [country, setCountry] = useState<"SA" | "EG" | "">("");
  const [role, setRole] = useState<"user" | "merchant" | "store">("user");
  const [interest, setInterest] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    captureUtm();
    void track("waitlist_view", { path: "/waitlist" });
  }, []);

  const shareUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const utm = readUtm();
    const ref = utm.referral_code || "share";
    return `${window.location.origin}/waitlist?ref=${encodeURIComponent(ref)}&utm_source=user_share&utm_medium=referral`;
  }, [done]);

  const mut = useMutation({
    mutationFn: async () => {
      const utm = readUtm();
      const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
      return submitFn({
        data: {
          email,
          phone: phone || null,
          country: country || null,
          role,
          interest: interest || null,
          referral_code: utm.referral_code || null,
          utm_source: utm.utm_source || null,
          utm_medium: utm.utm_medium || null,
          utm_campaign: utm.utm_campaign || null,
          utm_content: utm.utm_content || null,
          utm_term: utm.utm_term || null,
          landing_path: utm.landing_path || "/waitlist",
          user_agent: ua,
        },
      });
    },
    onSuccess: (res) => {
      setDone(true);
      void track("waitlist_signup", {
        role,
        country,
        duplicate: res?.duplicate ?? false,
        has_ref: !!readUtm().referral_code,
      });
    },
    onError: (e: Error) => {
      void track("waitlist_signup_failed", { message: e.message });
    },
  });

  const total = stats?.total ?? 217;

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      {/* Nav */}
      <header className="border-b border-border/60 bg-background/70 backdrop-blur">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="font-display text-2xl font-extrabold text-primary">
            بدل
          </Link>
          <Link
            to="/"
            className="text-xs px-3 py-2 rounded-lg border border-border hover:bg-muted"
          >
            عودة للرئيسية
          </Link>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-12 md:py-20 grid lg:grid-cols-2 gap-12 items-start">
        {/* Left: pitch */}
        <section>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold mb-5">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            البيتا قادمة قريباً · وصول مبكّر مجاني
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold leading-tight mb-5">
            قايض. ما تدفعش.
            <br />
            <span className="text-primary">افتح باب صفقاتك.</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-6 leading-relaxed">
            <strong className="text-foreground">بدل</strong> منصّة المقايضة الذكية الأولى في مصر
            والسعودية. تسعير بالذكاء الاصطناعي، ضمان صفقات، وشحن مربوط ببلدك — بلا عمولة للمرحلة الأولى.
          </p>

          <ul className="space-y-3 mb-8">
            {[
              "مقايضات مجانية بالكامل حتى ١٠٠ ألف مستخدم",
              "تسعير عادل لحظي بالذكاء الاصطناعي",
              "ضمان مالي داخلي لكل صفقة (Escrow)",
              "شحن جاهز داخل مصر والسعودية",
              "شارة توثيق للمهتمين الأوائل",
            ].map((t) => (
              <li key={t} className="flex items-start gap-3 text-sm">
                <span className="mt-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-bold">
                  ✓
                </span>
                <span>{t}</span>
              </li>
            ))}
          </ul>

          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex -space-x-2 rtl:space-x-reverse">
              {["A", "M", "S", "K"].map((c, i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/70 to-primary/30 border-2 border-background flex items-center justify-center text-xs font-bold text-primary-foreground"
                >
                  {c}
                </div>
              ))}
            </div>
            <span>
              <strong className="text-foreground">{total.toLocaleString("ar-EG")}+</strong>{" "}
              مشترك في قائمة الانتظار
            </span>
          </div>
        </section>

        {/* Right: form */}
        <section className="lg:sticky lg:top-6">
          <div className="rounded-3xl border border-border bg-card p-6 md:p-8 shadow-lg backdrop-blur">
            {done ? (
              <SuccessCard shareUrl={shareUrl} />
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void track("waitlist_submit_attempt", { role, country });
                  mut.mutate();
                }}
                className="space-y-4"
              >
                <div>
                  <h2 className="font-display text-2xl font-extrabold mb-1">
                    احجز مكانك الآن
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    خذ دعوة مبكّرة قبل الإطلاق الرسمي — دون التزام.
                  </p>
                </div>

                <Field label="البريد الإلكتروني *">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </Field>

                <Field label="رقم الجوال (اختياري)">
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+20 / +966"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </Field>

                <div className="grid grid-cols-2 gap-3">
                  <Field label="الدولة">
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value as "SA" | "EG" | "")}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background"
                    >
                      <option value="">—</option>
                      <option value="EG">مصر</option>
                      <option value="SA">السعودية</option>
                    </select>
                  </Field>
                  <Field label="أنا">
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value as typeof role)}
                      className="w-full px-4 py-3 rounded-xl border border-border bg-background"
                    >
                      <option value="user">مستخدم عادي</option>
                      <option value="merchant">تاجر</option>
                      <option value="store">صاحب محل</option>
                    </select>
                  </Field>
                </div>

                <Field label="ما الذي تريد مقايضته؟ (اختياري)">
                  <textarea
                    value={interest}
                    onChange={(e) => setInterest(e.target.value.slice(0, 500))}
                    rows={2}
                    placeholder="مثلاً: جوّالات، أثاث، ملابس، أدوات كهربائية…"
                    className="w-full px-4 py-3 rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                  />
                </Field>

                {mut.error && (
                  <p className="text-sm text-destructive">{(mut.error as Error).message}</p>
                )}

                <button
                  type="submit"
                  disabled={mut.isPending}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-base hover:opacity-90 disabled:opacity-60 transition"
                >
                  {mut.isPending ? "جارٍ التسجيل…" : "احجز دعوتي المجانية"}
                </button>

                <p className="text-[11px] text-muted-foreground text-center">
                  بالتسجيل توافق على{" "}
                  <Link to="/legal/$doc" params={{ doc: "terms" }} className="underline">
                    الشروط
                  </Link>{" "}
                  و{" "}
                  <Link to="/legal/$doc" params={{ doc: "privacy" }} className="underline">
                    الخصوصية
                  </Link>
                  . لن نُرسل بريداً مزعجاً.
                </p>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* Trust strip */}
      <section className="border-t border-border/60 bg-muted/30">
        <div className="max-w-6xl mx-auto px-6 py-10 grid md:grid-cols-3 gap-6 text-center">
          {[
            { k: "0%", v: "عمولة في المرحلة الأولى" },
            { k: "AI", v: "تسعير عادل بالذكاء الاصطناعي" },
            { k: "24س", v: "استجابة الدعم كحد أقصى" },
          ].map((s) => (
            <div key={s.v}>
              <div className="font-display text-3xl font-extrabold text-primary">{s.k}</div>
              <div className="text-sm text-muted-foreground mt-1">{s.v}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-muted-foreground block mb-1.5">{label}</span>
      {children}
    </label>
  );
}

function SuccessCard({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="text-center py-4">
      <div className="mx-auto w-16 h-16 rounded-full bg-primary/15 text-primary flex items-center justify-center text-3xl mb-4">
        ✓
      </div>
      <h2 className="font-display text-2xl font-extrabold mb-2">تم! أنت على القائمة.</h2>
      <p className="text-sm text-muted-foreground mb-6">
        سنُرسل لك دعوتك على البريد بمجرد فتح البيتا. شارك رابطك لتقفز أعلى في القائمة:
      </p>

      <div className="flex gap-2 items-center bg-muted rounded-xl p-2 mb-4">
        <input
          readOnly
          value={shareUrl}
          className="flex-1 bg-transparent text-xs px-2 outline-none"
        />
        <button
          onClick={() => {
            if (typeof navigator !== "undefined" && navigator.clipboard) {
              void navigator.clipboard.writeText(shareUrl);
              setCopied(true);
              void track("waitlist_share_copy", {});
              setTimeout(() => setCopied(false), 1800);
            }
          }}
          className="text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground"
        >
          {copied ? "نُسخ ✓" : "نسخ"}
        </button>
      </div>

      <div className="flex justify-center gap-2 flex-wrap">
        <ShareBtn
          label="واتساب"
          href={`https://wa.me/?text=${encodeURIComponent("انضم معي إلى بدل — منصة المقايضة الذكية: " + shareUrl)}`}
          channel="whatsapp"
        />
        <ShareBtn
          label="X / تويتر"
          href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("جرّب بدل — منصة المقايضة الذكية")}&url=${encodeURIComponent(shareUrl)}`}
          channel="twitter"
        />
        <ShareBtn
          label="تيليجرام"
          href={`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent("بدل — منصة المقايضة")}`}
          channel="telegram"
        />
      </div>
    </div>
  );
}

function ShareBtn({ label, href, channel }: { label: string; href: string; channel: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => void track("waitlist_share_click", { channel })}
      className="text-xs font-bold px-4 py-2 rounded-lg border border-border hover:bg-muted"
    >
      {label}
    </a>
  );
}
