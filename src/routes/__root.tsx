import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { CookieConsent } from "@/components/CookieConsent";
import { OnboardingTour } from "@/components/OnboardingTour";
import { CountryDetectedBanner } from "@/components/CountryDetectedBanner";
import { trackPageview, track } from "@/lib/analytics";
import { detectCountryServer } from "@/lib/geo.functions";
import { getPreferredCountry, setPreferredCountry } from "@/lib/currency-pref.functions";
import { hasSavedCountry, saveCountry, loadCountry } from "@/lib/currency-fx";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">الصفحة غير موجودة</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            العودة للرئيسية
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          تعذّر تحميل الصفحة
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          حدث خطأ من جهتنا. جرّب تحديث الصفحة أو العودة للرئيسية.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            حاول مجدداً
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            العودة للرئيسية
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "بدِّل — أول منصة مقايضة ذكية عادلة ومتوافقة شرعياً" },
      { name: "description", content: "بدِّل ما تملك بما تحتاج. منصة عربية للمقايضة الرقمية بمحرك تسعير ذكي (AI) متوافق شرعياً، إطلاق مبدئي في مصر والسعودية و14 فئة سلع وخدمات." },
      { name: "author", content: "Baddel" },
      { name: "theme-color", content: "#06b6d4" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "بدِّل" },
      { property: "og:title", content: "بدِّل — منصة المقايضة الذكية العادلة" },
      { property: "og:description", content: "قيّم وقايض سلعك وخدماتك بعدالة عبر محرك تسعير ذكي متوافق شرعياً." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "بدِّل · Baddel" },
      { property: "og:locale", content: "ar_AR" },
      { property: "og:image", content: "https://badelbarter.lovable.app/og-image.jpg" },
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:alt", content: "بدِّل — منصة المقايضة الذكية العادلة" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:image", content: "https://badelbarter.lovable.app/og-image.jpg" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800&family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;600&display=swap" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", type: "image/png", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <Outlet />
      <CookieConsent />
      <OnboardingTour />
      <CountryDetectedBanner />
      <Toaster position="top-center" richColors closeButton dir="rtl" />
    </QueryClientProvider>
  );
}

function AuthListener() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    // Start live FX auto-refresh (cache-first, backoff on outage, broadcast on update).
    void import("@/lib/fx-live-init").then((m) => m.initFxLive());
    // Pull profile-stored country preference; fall back to pushing local choice up.
    const syncCountry = async () => {
      try {
        const { country } = await getPreferredCountry();
        if (country === "SAR" || country === "EGP") {
          if (loadCountry() !== country) saveCountry(country);
          return;
        }
        // No profile pref yet — seed it from current local choice (if user has one).
        if (hasSavedCountry()) {
          const local = loadCountry();
          if (local === "SAR" || local === "EGP") {
            await setPreferredCountry({ data: { country: local } }).catch(() => {});
          }
        }
      } catch { /* silent — not signed in or transient */ }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") {
        qc.invalidateQueries();
        if (event === "SIGNED_IN") void syncCountry();
      }
    });

    // Push local country changes up to the profile whenever a signed-in user switches.
    const onCountryChanged = (e: Event) => {
      const code = (e as CustomEvent<string>).detail;
      if (code !== "SAR" && code !== "EGP") return;
      void track("country_confirmed", { action: "manual-change", country: code, source: "user-action" });
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setPreferredCountry({ data: { country: code } }).catch(() => {});
        }
      });
    };
    window.addEventListener("badel:country-changed", onCountryChanged as EventListener);

    // Pageview tracking on every route change (search is an object in TSR)
    const unsub = router.subscribe("onResolved", ({ toLocation }) => {
      trackPageview(toLocation.href ?? toLocation.pathname);
    });
    // First load
    trackPageview(window.location.pathname + window.location.search);

    // If already signed in on mount, sync immediately.
    supabase.auth.getSession().then(({ data }) => { if (data.session) void syncCountry(); });

    // Auto-detect visitor country from edge headers (once, only if user hasn't chosen)
    if (!hasSavedCountry()) {
      detectCountryServer()
        .then((r) => {
          const src = r?.source || "client-fallback";
          if (!hasSavedCountry() && (r?.country === "SAR" || r?.country === "EGP")) {
            saveCountry(r.country);
            void track("country_detected", {
              detected: r.country,
              local: null,
              source: src,
              matches_local: false,
              auto_saved: true,
            });
          } else {
            void track("country_detected", {
              detected: r?.country ?? null,
              local: loadCountry(),
              source: src,
              matches_local: r?.country === loadCountry(),
              auto_saved: false,
            });
          }
        })
        .catch(() => { /* silent — fallback to locale/timezone detection */ });
    }
    return () => {
      subscription.unsubscribe();
      unsub();
      window.removeEventListener("badel:country-changed", onCountryChanged as EventListener);
    };
  }, [router, qc]);
  return null;
}
