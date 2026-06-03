import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function NotificationBell() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      if (!user) return { items: [], unread: 0 };
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw new Error(error.message);
      const items = data ?? [];
      return { items, unread: items.filter((n: any) => !n.read).length };
    },
    enabled: !!user,
    refetchInterval: 60_000,
  });

  const markRead = async (id?: string) => {
    if (!user) return;
    let query = supabase.from("notifications").update({ read: true }).eq("user_id", user.id);
    if (id) query = query.eq("id", id);
    const { error } = await query;
    if (error) throw new Error(error.message);
  };

  useEffect(() => {
    if (!user) return;
    const ch = supabase
      .channel(`notif:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["notifications"] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, qc]);

  if (!user) return null;
  const items = data?.items ?? [];
  const unread = data?.unread ?? 0;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-full hover:bg-stone-soft"
        title="الإشعارات"
      >
        <Bell className="size-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-destructive text-destructive-foreground text-[10px] min-w-4 h-4 rounded-full px-1 flex items-center justify-center font-bold">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute left-0 mt-2 w-80 bg-card rounded-2xl ring-1 ring-black/10 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="font-bold text-sm">الإشعارات</span>
            {unread > 0 && (
              <button
                onClick={async () => { await markRead(); qc.invalidateQueries({ queryKey: ["notifications", user.id] }); }}
                className="text-xs text-primary hover:underline"
              >
                تعليم الكل كمقروء
              </button>
            )}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="p-6 text-center text-xs text-muted-foreground">لا توجد إشعارات</p>
            ) : (
              items.map((n: any) => (
                <Link
                  key={n.id}
                  to={n.link ?? "/"}
                  onClick={async () => { if (!n.read) await markRead(n.id); setOpen(false); qc.invalidateQueries({ queryKey: ["notifications", user.id] }); }}
                  className={`block px-4 py-3 text-sm border-b border-border hover:bg-stone-soft ${!n.read ? "bg-primary/5" : ""}`}
                >
                  <div className="font-bold text-xs">{n.title}</div>
                  {n.body && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</div>}
                  <div className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleString("ar")}</div>
                </Link>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
