import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const userIdSchema = z.object({ userId: z.string().uuid() });

export const followUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => userIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    if (data.userId === context.userId) throw new Error("لا يمكنك متابعة نفسك");
    const { error } = await context.supabase
      .from("follows" as never)
      .insert({ follower_id: context.userId, following_id: data.userId } as never);
    if (error && !error.message.includes("duplicate")) throw error;
    return { ok: true };
  });

export const unfollowUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => userIdSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("follows" as never)
      .delete()
      .eq("follower_id", context.userId)
      .eq("following_id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const getFollowStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid().optional() }).parse(d))
  .handler(async ({ data, context }) => {
    const uid = data.userId ?? context.userId;
    const [followers, following, isFollowing, badges] = await Promise.all([
      context.supabase.from("follows" as never).select("id", { count: "exact", head: true }).eq("following_id", uid),
      context.supabase.from("follows" as never).select("id", { count: "exact", head: true }).eq("follower_id", uid),
      uid === context.userId
        ? Promise.resolve({ count: 0 })
        : context.supabase.from("follows" as never).select("id", { count: "exact", head: true })
            .eq("follower_id", context.userId).eq("following_id", uid),
      context.supabase.from("user_badges" as never).select("badge, awarded_at").eq("user_id", uid),
    ]);
    return {
      followers: followers.count ?? 0,
      following: following.count ?? 0,
      isFollowing: (isFollowing.count ?? 0) > 0,
      badges: ((badges.data ?? []) as Array<{ badge: string; awarded_at: string }>),
    };
  });
