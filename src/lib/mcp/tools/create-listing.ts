import { defineTool, type ToolContext } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { createClient } from "@supabase/supabase-js";

export default defineTool({
  name: "create_listing",
  title: "Create a barter listing",
  description:
    "Create a new Baddel barter listing for the signed-in user. Returns the created row.",
  inputSchema: {
    title: z.string().min(3).max(120),
    description: z.string().max(2000).optional(),
    category: z.string().min(1).max(60),
    condition: z.enum(["new", "like-new", "excellent", "good", "fair"]),
    age_months: z.number().int().min(0).max(360),
    market_price: z.number().positive().max(10_000_000),
    wants: z.string().min(2).max(200).describe("What the user wants in exchange."),
    city: z.string().min(2).max(60).optional(),
    listing_type: z.enum(["item", "service"]).optional(),
  },
  annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx: ToolContext) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_PUBLISHABLE_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${ctx.getToken()}` } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    );
    const { data, error } = await supabase
      .from("listings")
      .insert({
        ...input,
        description: input.description ?? "",
        listing_type: input.listing_type ?? "item",
        owner_id: ctx.getUserId(),
      })
      .select()
      .single();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    return {
      content: [{ type: "text", text: `Created listing ${data.id}` }],
      structuredContent: { listing: data },
    };
  },
});
