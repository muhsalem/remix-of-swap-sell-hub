import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "search_listings",
  title: "Search barter listings",
  description:
    "Search active public barter listings on Baddel. Optionally filter by category or free-text keywords in the title/wants.",
  inputSchema: {
    query: z.string().trim().max(120).optional().describe("Free-text search over listing titles and wants."),
    category: z.string().trim().max(60).optional().describe("Category slug to filter by."),
    limit: z.number().int().min(1).max(50).optional().describe("Max results (default 20)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, category, limit }) => {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    let q = supabase
      .from("listings")
      .select("id,title,category,condition,market_price,wants,city,listing_type,created_at")
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(limit ?? 20);
    if (category) q = q.eq("category", category);
    if (query) q = q.or(`title.ilike.%${query}%,wants.ilike.%${query}%`);
    const { data, error } = await q;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: JSON.stringify(data ?? []) }],
      structuredContent: { listings: data ?? [] },
    };
  },
});
