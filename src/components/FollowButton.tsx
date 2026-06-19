import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, UserCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { followUser, unfollowUser, getFollowStats } from "@/lib/social.functions";

export function FollowButton({ userId, currentUserId }: { userId: string; currentUserId: string | null }) {
  const qc = useQueryClient();
  const follow = useServerFn(followUser);
  const unfollow = useServerFn(unfollowUser);

  const { data } = useQuery({
    queryKey: ["follow", userId],
    queryFn: () => getFollowStats({ data: { userId } }),
    enabled: !!currentUserId && currentUserId !== userId,
  });

  const m = useMutation({
    mutationFn: async () => {
      if (data?.isFollowing) {
        await unfollow({ data: { userId } });
      } else {
        await follow({ data: { userId } });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["follow", userId] });
      qc.invalidateQueries({ queryKey: ["social-self"] });
      toast.success(data?.isFollowing ? "تم إلغاء المتابعة" : "تمت المتابعة");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!currentUserId || currentUserId === userId) return null;

  const following = data?.isFollowing ?? false;
  return (
    <button
      type="button"
      onClick={() => m.mutate()}
      disabled={m.isPending}
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
        following
          ? "bg-primary/10 border-primary/30 text-primary hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive"
          : "bg-card border-border hover:bg-stone-soft"
      }`}
      aria-label={following ? "إلغاء المتابعة" : "متابعة"}
    >
      {m.isPending ? <Loader2 className="size-3 animate-spin" />
        : following ? <UserCheck className="size-3" />
        : <UserPlus className="size-3" />}
      {following ? "تتابعه" : "متابعة"}
      {typeof data?.followers === "number" && (
        <span className="opacity-70">· {data.followers}</span>
      )}
    </button>
  );
}
