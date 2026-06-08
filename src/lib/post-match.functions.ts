import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getPeerContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase.rpc("get_peer_contact", { _offer_id: data.offer_id });
    if (error) throw new Error(error.message === "contact_locked" ? "بيانات التواصل تُكشف بعد قبول العرض" : error.message);
    return { peer: rows?.[0] ?? null };
  });

export const getMyContact = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("contact_phone,whatsapp")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { contact_phone: (data as { contact_phone?: string } | null)?.contact_phone ?? null, whatsapp: (data as { whatsapp?: string } | null)?.whatsapp ?? null };
  });

export const updateMyContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      contact_phone: z.string().min(5).max(20).regex(/^\+?[0-9\s-]+$/).optional().nullable(),
      whatsapp: z.string().min(5).max(20).regex(/^\+?[0-9\s-]+$/).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("profiles")
      .update({ contact_phone: data.contact_phone ?? null, whatsapp: data.whatsapp ?? null } as never)
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMeetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      meetup_location: z.string().min(2).max(200),
      meetup_at: z.string().min(5),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: o } = await supabase.from("trade_offers").select("from_user,to_user,status").eq("id", data.offer_id).maybeSingle();
    if (!o) throw new Error("الصفقة غير موجودة");
    if (o.from_user !== userId && o.to_user !== userId) throw new Error("غير مصرّح");
    if (o.status !== "accepted") throw new Error("اللقاء يُحدَّد بعد القبول");
    const { error } = await supabase
      .from("trade_offers")
      .update({ meetup_location: data.meetup_location, meetup_at: data.meetup_at } as never)
      .eq("id", data.offer_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveReceiptUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ offer_id: z.string().uuid(), receipt_url: z.string().min(3).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: o } = await supabase.from("trade_offers").select("from_user,to_user").eq("id", data.offer_id).maybeSingle();
    if (!o) throw new Error("الصفقة غير موجودة");
    if (o.from_user !== userId && o.to_user !== userId) throw new Error("غير مصرّح");
    const { error } = await supabase
      .from("trade_offers")
      .update({ receipt_url: data.receipt_url } as never)
      .eq("id", data.offer_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getFeeStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ offer_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: o } = await supabase
      .from("trade_offers")
      .select("from_user,to_user,cash_balance,fee_paid_at")
      .eq("id", data.offer_id).maybeSingle();
    if (!o) throw new Error("الصفقة غير موجودة");
    const cash = Number(o.cash_balance ?? 0);
    const base = Math.max(cash, 50);
    const feeSar = Math.round(base * 0.03 * 100) / 100;

    const { data: fee } = await supabase.from("platform_fees").select("*").eq("offer_id", data.offer_id).maybeSingle();
    let diBalance = 0;
    const { data: ledger } = await supabase.from("wallet_ledger").select("amount_di").eq("user_id", userId);
    diBalance = (ledger ?? []).reduce((s, r) => s + Number(r.amount_di), 0);

    return {
      feeSar,
      cashBalance: cash,
      paid: !!fee && fee.status === "paid",
      fee,
      diBalance,
      diValueSar: diBalance * 5,
      isInitiator: o.from_user === userId,
    };
  });

export const payPlatformFee = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      offer_id: z.string().uuid(),
      di_amount: z.number().min(0).max(1_000_000),
      cash_amount: z.number().min(0).max(1_000_000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: res, error } = await supabase.rpc("pay_platform_fee", {
      _offer_id: data.offer_id,
      _di_amount: data.di_amount,
      _cash_amount: data.cash_amount,
    });
    if (error) {
      const m = error.message || "";
      if (m.includes("insufficient_di")) throw new Error("رصيد DI لا يكفي");
      if (m.includes("insufficient_total")) throw new Error("المبلغ المُغطّى أقل من العمولة المطلوبة");
      if (m.includes("fee_already_paid")) throw new Error("العمولة مدفوعة بالفعل");
      if (m.includes("only_initiator")) throw new Error("فقط مُبادر العرض يدفع العمولة");
      throw new Error(m);
    }
    return res as { ok: boolean; fee_sar: number };
  });
