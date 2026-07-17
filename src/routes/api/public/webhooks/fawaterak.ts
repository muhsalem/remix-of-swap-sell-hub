// Fawaterak webhook — verifies signature, marks payment paid/failed.
// Public route (bypasses auth on the published site); the HMAC check is the trust boundary.

import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/fawaterak")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const rawBody = await request.text();
        const signature =
          request.headers.get("x-hash") ??
          request.headers.get("x-fawaterak-hash") ??
          request.headers.get("hashkey");

        const { verifyFawaterakHash, mapFawaterakStatus } = await import(
          "@/lib/payments/fawaterak.server"
        );
        if (!verifyFawaterakHash(rawBody, signature)) {
          return new Response("Invalid signature", { status: 401 });
        }

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(rawBody);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
        }

        // Fawaterak places the useful bits under `data` or at the root depending on account.
        const data = (payload.data as Record<string, unknown>) ?? payload;
        const invoiceId = String(
          data.invoiceId ?? data.invoice_id ?? data.invoiceNumber ?? "",
        );
        const rawStatus = String(
          data.invoiceStatus ??
            data.status ??
            data.paymentStatus ??
            (payload as { status?: string }).status ??
            "",
        );
        const status = mapFawaterakStatus(rawStatus);

        // Resolve our payments.id either from custom payLoad.paymentId or invoiceNumber.
        const payLoad = (data.payLoad as Record<string, unknown> | undefined) ?? undefined;
        const paymentId =
          (payLoad?.paymentId as string | undefined) ??
          (data.invoiceNumber as string | undefined) ??
          undefined;

        if (!paymentId && !invoiceId) {
          return new Response("Missing payment identifiers", { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        // Find target row (prefer id, fallback to provider invoice id).
        let query = supabaseAdmin.from("payments").select("id, status").limit(1);
        query = paymentId ? query.eq("id", paymentId) : query.eq("provider_invoice_id", invoiceId);
        const { data: rows } = await query;
        const row = rows?.[0];
        if (!row) return new Response("Payment not found", { status: 404 });
        if (row.status === "paid") return new Response("ok", { status: 200 });

        const patch: {
          status: "pending" | "paid" | "failed" | "expired";
          raw_callback: unknown;
          provider_invoice_id?: string;
          paid_at?: string;
        } = {
          status,
          raw_callback: payload,
        };
        if (invoiceId) patch.provider_invoice_id = invoiceId;
        if (status === "paid") patch.paid_at = new Date().toISOString();

        const { error } = await supabaseAdmin
          .from("payments")
          .update(patch as never)
          .eq("id", row.id);
        if (error) {
          console.error("[fawaterak-webhook] update failed", error);
          return new Response("DB error", { status: 500 });
        }

        return new Response("ok", { status: 200 });
      },
      // Fawaterak sometimes probes the URL with GET; return 200 so validation passes.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
