import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";

const ConditionEnum = z.enum(["new", "like-new", "excellent", "good", "fair"]);

const ListingInput = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional().default(""),
  category: z.string().min(1).max(60),
  condition: ConditionEnum,
  age_months: z.number().int().min(0).max(360),
  market_price: z.number().positive().max(10_000_000),
  wants: z.string().min(2).max(200),
  images: z.array(z.string().min(1).max(500)).max(8).default([]),
  is_ribawi: z.boolean().default(false),
});

export const listActiveListings = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await anonClient
    .from("listings")
    .select("id,title,category,condition,age_months,market_price,wants,images,status,is_ribawi,created_at,owner_id,profiles:owner_id(display_name,avatar_url,rating)")
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(error.message);
  return { listings: data ?? [] };
});

export const getListing = createServerFn({ method: "GET" })
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const { data: listing, error } = await anonClient
      .from("listings")
      .select("*,profiles:owner_id(display_name,avatar_url,rating,trades_count,bio)")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { listing };
  });

export const myListings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("listings")
      .select("*")
      .eq("owner_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { listings: data ?? [] };
  });

export const createListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ListingInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: row, error } = await supabase
      .from("listings")
      .insert({ ...data, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });

export const deleteListing = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("listings").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
