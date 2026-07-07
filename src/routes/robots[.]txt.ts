import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const origin = new URL(request.url).origin;
        const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /offers
Disallow: /api/
Disallow: /reset-password
Disallow: /.lovable/

Sitemap: ${origin}/sitemap.xml
`;
        return new Response(body, {
          status: 200,
          headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "public, max-age=3600" },
        });
      },
    },
  },
});
