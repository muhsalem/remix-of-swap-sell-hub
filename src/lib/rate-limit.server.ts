// Simple per-user rate limiter backed by Supabase.
// Server-only — never import from client code.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

type Options = {
  /** Action name (e.g. "create_offer") */
  action: string;
  /** Max calls allowed within the window */
  limit: number;
  /** Window length in seconds */
  windowSec: number;
  /** Financial/sensitive actions must reject when the limiter itself fails. */
  failClosed?: boolean;
};

export async function enforceRateLimit(userId: string | null, opts: Options): Promise<void> {
  if (!userId) {
    if (opts.failClosed) throw new Error("🚦 تعذّر التحقق من الحد المسموح — يلزم تسجيل الدخول.");
    return; // anonymous calls — not rate-limited here
  }
  const since = new Date(Date.now() - opts.windowSec * 1000).toISOString();

  const { count, error } = await supabaseAdmin
    .from("rate_limits")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", opts.action)
    .gte("created_at", since);

  if (error) {
    console.error("[rate-limit] query failed", error);
    if (opts.failClosed) {
      throw new Error("🚦 تعذّر التحقق من حد العمليات حالياً — لأمان العمليات المالية تم إيقاف الطلب مؤقتاً، حاول لاحقاً.");
    }
    return; // fail-open for non-financial actions
  }


  if ((count ?? 0) >= opts.limit) {
    throw new Error(
      `🚦 تجاوزت الحد المسموح من العمليات (${opts.limit} كل ${Math.round(opts.windowSec / 60)} دقيقة) — حاول لاحقاً.`,
    );
  }

  await supabaseAdmin
    .from("rate_limits")
    .insert({ user_id: userId, action: opts.action })
    .then(({ error: insErr }) => {
      if (insErr) console.error("[rate-limit] insert failed", insErr);
    });

  // Opportunistic cleanup (~1% of calls): purge entries older than 24h
  // so the table never grows unbounded.
  if (Math.random() < 0.01) {
    const dayAgo = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
    await supabaseAdmin
      .from("rate_limits")
      .delete()
      .lt("created_at", dayAgo)
      .then(({ error: delErr }) => {
        if (delErr) console.error("[rate-limit] cleanup failed", delErr);
      });
  }
}

export async function logServerError(
  message: string,
  ctx: { fn_name?: string; route?: string; user_id?: string | null; stack?: string; context?: unknown } = {},
) {
  try {
    await supabaseAdmin.from("error_logs").insert({
      message: message.slice(0, 2000),
      stack: ctx.stack?.slice(0, 4000),
      fn_name: ctx.fn_name,
      route: ctx.route,
      user_id: ctx.user_id ?? null,
      context: (ctx.context ?? null) as never,
    });
  } catch (e) {
    console.error("[error-log] failed to persist", e);
  }
}
