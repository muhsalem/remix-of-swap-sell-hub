import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Category = z.enum([
  "payment",
  "listing",
  "dispute",
  "account",
  "shipping",
  "technical",
  "other",
]);
const Priority = z.enum(["low", "normal", "high", "urgent"]);
const Status = z.enum(["open", "pending", "waiting_user", "resolved", "closed"]);

async function isAdmin(supabase: any, userId: string) {
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  return !!data;
}

// ============== USER ==============

export const createTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        subject: z.string().trim().min(3).max(160),
        body: z.string().trim().min(5).max(4000),
        category: Category.default("other"),
        priority: Priority.default("normal"),
        related_offer_id: z.string().uuid().optional(),
        related_listing_id: z.string().uuid().optional(),
        related_payment_id: z.string().uuid().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .insert({
        user_id: userId,
        subject: data.subject,
        category: data.category,
        priority: data.priority,
        related_offer_id: data.related_offer_id ?? null,
        related_listing_id: data.related_listing_id ?? null,
        related_payment_id: data.related_payment_id ?? null,
      } as never)
      .select("id")
      .single();
    if (error || !ticket) throw new Error(error?.message ?? "insert_failed");

    const { error: msgErr } = await supabase.from("support_ticket_messages").insert({
      ticket_id: ticket.id,
      sender_id: userId,
      body: data.body,
      is_internal: false,
    });
    if (msgErr) throw new Error(msgErr.message);

    return { id: ticket.id };
  });

export const listMyTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("support_tickets")
      .select(
        "id, subject, category, priority, status, sla_due_at, first_response_at, resolved_at, created_at, updated_at",
      )
      .eq("user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const getTicketThread = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ticketId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);

    const { data: ticket, error } = await supabase
      .from("support_tickets")
      .select("*")
      .eq("id", data.ticketId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!ticket) throw new Error("ticket_not_found");
    if (!admin && ticket.user_id !== userId) throw new Error("forbidden");

    let msgsQ = supabase
      .from("support_ticket_messages")
      .select("id, sender_id, body, is_internal, template_key, created_at")
      .eq("ticket_id", data.ticketId)
      .order("created_at", { ascending: true });
    if (!admin) msgsQ = msgsQ.eq("is_internal", false);
    const { data: msgs } = await msgsQ;
    return { ticket, messages: msgs ?? [], isAdmin: admin };
  });

export const postTicketMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
        isInternal: z.boolean().default(false),
        templateKey: z.string().max(80).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const admin = await isAdmin(supabase, userId);
    if (data.isInternal && !admin) throw new Error("forbidden_internal");

    const { error } = await supabase.from("support_ticket_messages").insert({
      ticket_id: data.ticketId,
      sender_id: userId,
      body: data.body,
      is_internal: data.isInternal,
      template_key: data.templateKey ?? null,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const closeMyTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ticketId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("support_tickets")
      .update({ status: "closed", closed_at: new Date().toISOString() })
      .eq("id", data.ticketId)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============== ADMIN ==============

export const listAllTickets = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        status: Status.optional(),
        priority: Priority.optional(),
        category: Category.optional(),
        limit: z.number().int().min(1).max(200).default(50),
      })
      .parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("forbidden");
    let q = supabase
      .from("support_tickets")
      .select(
        "id, user_id, subject, category, priority, status, sla_due_at, first_response_at, resolved_at, assigned_admin, created_at, updated_at",
      )
      .order("sla_due_at", { ascending: true })
      .limit(data.limit);
    if (data.status) q = q.eq("status", data.status);
    if (data.priority) q = q.eq("priority", data.priority);
    if (data.category) q = q.eq("category", data.category);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // status counts (unfiltered)
    const { data: agg } = await supabase.from("support_tickets").select("status");
    const counts: Record<string, number> = {};
    for (const r of agg ?? []) counts[r.status] = (counts[r.status] ?? 0) + 1;

    return { rows: rows ?? [], counts };
  });

export const adminUpdateTicket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        ticketId: z.string().uuid(),
        status: Status.optional(),
        priority: Priority.optional(),
        assignSelf: z.boolean().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) throw new Error("forbidden");
    const patch: Record<string, unknown> = {};
    if (data.status) {
      patch.status = data.status;
      if (data.status === "resolved") patch.resolved_at = new Date().toISOString();
      if (data.status === "closed") patch.closed_at = new Date().toISOString();
    }
    if (data.priority) patch.priority = data.priority;
    if (data.assignSelf) patch.assigned_admin = userId;
    const { error } = await supabase
      .from("support_tickets")
      .update(patch as never)
      .eq("id", data.ticketId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    if (!(await isAdmin(supabase, userId))) return [];
    const { data } = await supabase
      .from("support_reply_templates")
      .select("id, key, title, body, category, active")
      .eq("active", true)
      .order("category");
    return data ?? [];
  });
