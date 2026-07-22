import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderEmail, type EmailTemplate } from "./email-nurturing";

const TEMPLATES = [
  "welcome","listing_created","offer_received","offer_accepted",
  "kyc_approved","abandoned_listing","reactivation_7d",
  "waitlist_confirmed","referral_success",
] as const;

export const enqueueEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      to_email: z.string().email(),
      template: z.enum(TEMPLATES),
      variables: z.record(z.string(), z.string()).optional(),
      user_id: z.string().uuid().optional(),
      delay_minutes: z.number().int().min(0).max(60 * 24 * 30).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const rendered = renderEmail(data.template as EmailTemplate, data.variables ?? {});
    const scheduled_at = new Date(Date.now() + (data.delay_minutes ?? 0) * 60_000).toISOString();
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await (supabaseAdmin as any).from("email_queue").insert({
      user_id: data.user_id ?? null,
      to_email: data.to_email,
      template: data.template,
      subject: rendered.subject,
      variables: (data.variables ?? {}) as any,
      scheduled_at,
      status: "pending",
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { id: (row as any).id as string, scheduled_at };
  });

export const listEmailQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      status: z.enum(["pending","sent","failed","cancelled","all"]).optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).partial().parse(i ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("غير مصرّح");
    let q: any = (supabase as any).from("email_queue").select("*").order("created_at", { ascending: false }).limit(data.limit ?? 100);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { emails: rows ?? [] };
  });

export const cancelQueuedEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: role } = await supabase
      .from("user_roles").select("role")
      .eq("user_id", userId).eq("role", "admin").maybeSingle();
    if (!role) throw new Error("غير مصرّح");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any).from("email_queue")
      .update({ status: "cancelled" }).eq("id", data.id).eq("status", "pending");
    if (error) throw new Error(error.message);
    return { ok: true };
  });
