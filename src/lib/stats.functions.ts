import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabase as anonClient } from "@/integrations/supabase/client";

export const getPublicStats = createServerFn({ method: "GET" }).handler(async () => {
  const { data, error } = await anonClient
    .from("listings")
    .select("market_price", { count: "exact" })
    .eq("status", "active")
    .limit(500);
  if (error) return { count: 0, avgPriceSAR: 0, savingsHintSAR: 0 };
  const rows = data ?? [];
  const sum = rows.reduce((s: number, r: any) => s + Number(r.market_price || 0), 0);
  const avg = rows.length ? Math.round(sum / rows.length) : 0;
  // قيمة توفير تقريبية: 20% من متوسط السعر (مقارنة بالشراء الجديد)
  const savingsHintSAR = Math.round(avg * 0.2);
  return { count: rows.length, avgPriceSAR: avg, savingsHintSAR };
});

export const getMyStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [myListings, myOffersFrom, myOffersTo] = await Promise.all([
      supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", userId),
      supabase.from("trade_offers").select("cash_balance,status").eq("from_user", userId).eq("status", "completed"),
      supabase.from("trade_offers").select("cash_balance,status").eq("to_user", userId).eq("status", "completed"),
    ]);
    const completed = [
      ...(myOffersFrom.data ?? []),
      ...(myOffersTo.data ?? []),
    ];
    // وفّر تقديري = مجموع قيمة العناصر المتبادلة - النقد المضاف (لكل صفقة مكتملة)
    const savedSAR = completed.length * 1500; // تقدير محافظ في غياب snapshot قيم وقت الصفقة
    return {
      activeListings: myListings.count ?? 0,
      completedDeals: completed.length,
      savedSAR,
    };
  });
