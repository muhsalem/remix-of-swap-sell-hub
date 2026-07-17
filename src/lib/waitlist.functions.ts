import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const Input = z.object({
  email: z.string().email().max(200),
  phone: z.string().max(30).optional().nullable(),
  country: z.string().max(3).optional().nullable(),
  city: z.string().max(80).optional().nullable(),
  role: z.enum(["user", "merchant", "store"]).optional().nullable(),
  interest: z.string().max(500).optional().nullable(),
  referral_code: z.string().max(60).optional().nullable(),
  utm_source: z.string().max(60).optional().nullable(),
  utm_medium: z.string().max(60).optional().nullable(),
  utm_campaign: z.string().max(60).optional().nullable(),
  utm_content: z.string().max(60).optional().nullable(),
  utm_term: z.string().max(60).optional().nullable(),
  landing_path: z.string().max(200).optional().nullable(),
  user_agent: z.string().max(400).optional().nullable(),
});

function makeClient() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const h = new Headers(init?.headers);
        if (key.startsWith("sb_") && h.get("Authorization") === `Bearer ${key}`) h.delete("Authorization");
        h.set("apikey", key);
        return fetch(input, { ...init, headers: h });
      },
    },
  });
}

export const joinWaitlist = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => Input.parse(i))
  .handler(async ({ data }) => {
    const supa = makeClient();
    const { error } = await supa.from("waitlist_signups").insert({
      email: data.email.toLowerCase().trim(),
      phone: data.phone || null,
      country: data.country || null,
      city: data.city || null,
      role: data.role || null,
      interest: data.interest || null,
      referral_code: data.referral_code || null,
      utm_source: data.utm_source || null,
      utm_medium: data.utm_medium || null,
      utm_campaign: data.utm_campaign || null,
      utm_content: data.utm_content || null,
      utm_term: data.utm_term || null,
      landing_path: data.landing_path || null,
      user_agent: (data.user_agent || "").slice(0, 400),
    } as never);
    if (error) {
      // Uniqueness violation → treat as success (idempotent)
      if (error.code === "23505") return { ok: true, duplicate: true };
      throw new Error(error.message);
    }
    return { ok: true, duplicate: false };
  });

export const getWaitlistStats = createServerFn({ method: "GET" }).handler(async () => {
  const supa = makeClient();
  const { count } = await supa
    .from("waitlist_signups")
    .select("*", { count: "exact", head: true });
  // Seed floor so the counter feels alive from day one
  const floor = 217;
  return { total: Math.max(floor, count || 0) };
});
