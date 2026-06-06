import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const staticPaths = ["", "/auth", "/premium", "/digital-currency", "/legal/terms", "/legal/privacy"];

        let listings: { id: string; updated_at: string }[] = [];
        try {
          const { data } = await supabaseAdmin
            .from("listings")
            .select("id,updated_at")
            .eq("status", "active")
            .order("updated_at", { ascending: false })
            .limit(1000);
          listings = (data ?? []) as never;
        } catch {
          // fail-open
        }

        const urls = [
          ...staticPaths.map((p) => ({ loc: `${origin}${p}`, lastmod: new Date().toISOString() })),
          ...listings.map((l) => ({ loc: `${origin}/listings/${l.id}`, lastmod: l.updated_at })),
        ];

        const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod></url>`).join("\n")}
</urlset>`;

        return new Response(xml, {
          status: 200,
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
