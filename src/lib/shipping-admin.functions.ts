import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { _invalidateZonesCache } from "@/lib/shipping.functions";

async function ensureAdmin(context: any) {
  const { data: isAdmin, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!isAdmin) throw new Error("forbidden");
}

const CityInput = z.object({
  code: z.string().trim().min(2).max(8).regex(/^[A-Z0-9]+$/, "الرمز حروف كبيرة/أرقام فقط"),
  country: z.enum(["SA", "EG"]),
  region_ar: z.string().trim().min(1).max(60),
  name_ar: z.string().trim().min(1).max(60),
  zone: z.number().int().min(1).max(5),
  active: z.boolean().optional(),
});

export const adminListShippingCities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureAdmin(context);
    const { data, error } = await context.supabase
      .from("shipping_cities")
      .select("id,code,country,region_ar,name_ar,zone,active,updated_at")
      .order("country", { ascending: true })
      .order("region_ar", { ascending: true })
      .order("name_ar", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const adminUpsertShippingCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => CityInput.parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shipping_cities" as never)
      .upsert(
        {
          code: data.code,
          country: data.country,
          region_ar: data.region_ar,
          name_ar: data.name_ar,
          zone: data.zone,
          active: data.active ?? true,
        } as never,
        { onConflict: "code" },
      );
    if (error) throw new Error(error.message);
    _invalidateZonesCache();
    return { ok: true };
  });

export const adminToggleShippingCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string(), active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shipping_cities" as never)
      .update({ active: data.active } as never)
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    _invalidateZonesCache();
    return { ok: true };
  });

export const adminDeleteShippingCity = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ code: z.string() }).parse(i))
  .handler(async ({ data, context }) => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("shipping_cities" as never)
      .delete()
      .eq("code", data.code);
    if (error) throw new Error(error.message);
    _invalidateZonesCache();
    return { ok: true };
  });
