import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Local typed wrapper — supabase.auth.oauth is currently beta and not fully typed.
type OAuthDetails = {
  client?: { name?: string; client_uri?: string };
  redirect_url?: string;
  redirect_to?: string;
};
type OAuthResult = { redirect_url?: string; redirect_to?: string };
const oauthApi = () => {
  const authAny = (supabase as unknown as { auth: { oauth: {
    getAuthorizationDetails: (id: string) => Promise<{ data: OAuthDetails | null; error: Error | null }>;
    approveAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
    denyAuthorization: (id: string) => Promise<{ data: OAuthResult | null; error: Error | null }>;
  } } }).auth;
  return authAny.oauth;
};

function isSafeRelativePath(p: string) {
  return /^\/[^/\\]/.test(p) && !p.startsWith("//");
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: isSafeRelativePath(next) ? { next } : {} });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
    if (error) throw error;
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <main dir="rtl" className="min-h-screen flex items-center justify-center p-6 text-center">
      <p>تعذّر تحميل طلب التفويض: {String((error as Error)?.message ?? error)}</p>
    </main>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const api = oauthApi();
    const { data, error } = approve
      ? await api.approveAuthorization(authorization_id)
      : await api.denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("لم يُعِد خادم التفويض عنوان توجيه."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "التطبيق";

  return (
    <main dir="rtl" className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 shadow-sm">
        <h1 className="font-display text-2xl font-extrabold mb-2">
          ربط {clientName} بحسابك على بادل
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          سيتمكّن {clientName} من استخدام أدوات بادل بالنيابة عنك (تصفح الإعلانات، إدارة عروضك، إنشاء إعلانات جديدة).
          يمكنك إلغاء الوصول في أي وقت.
        </p>
        {error && (
          <p role="alert" className="mb-4 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
            {error}
          </p>
        )}
        <div className="flex gap-3">
          <button
            disabled={busy}
            onClick={() => decide(true)}
            className="flex-1 px-4 py-3 bg-foreground text-background rounded-xl font-bold text-sm hover:bg-primary transition-all disabled:opacity-50"
          >
            الموافقة والاتصال
          </button>
          <button
            disabled={busy}
            onClick={() => decide(false)}
            className="flex-1 px-4 py-3 border border-border rounded-xl font-bold text-sm hover:bg-stone-soft transition-all disabled:opacity-50"
          >
            رفض
          </button>
        </div>
      </div>
    </main>
  );
}
