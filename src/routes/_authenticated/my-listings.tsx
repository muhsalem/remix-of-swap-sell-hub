import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { myListings, deleteListing } from "@/lib/listings.functions";
import { Nav } from "@/components/Nav";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { ListingImage } from "@/components/ListingImage";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({ meta: [{ title: "عروضي — إيكال EQAL" }] }),
  component: MyListings,
});

function MyListings() {
  const fn = useServerFn(myListings);
  const delFn = useServerFn(deleteListing);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["my-listings"], queryFn: () => fn() });

  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success("تم الحذف");
      qc.invalidateQueries({ queryKey: ["my-listings"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "فشل الحذف"),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="font-display text-3xl font-extrabold">عروضي</h1>
          <Link to="/new-listing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all">
            <Plus className="size-4" /> عرض جديد
          </Link>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20"><Loader2 className="size-8 animate-spin text-muted-foreground" /></div>
        ) : !data?.listings.length ? (
          <div className="bg-card rounded-3xl p-12 text-center ring-1 ring-black/5">
            <p className="text-muted-foreground mb-4">لم تنشر أي عرض بعد.</p>
            <Link to="/new-listing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
              <Plus className="size-4" /> أنشئ عرضك الأول
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.listings.map((l) => (
              <div key={l.id} className="bg-card rounded-3xl p-4 ring-1 ring-black/5">
                <Link to="/listings/$id" params={{ id: l.id }} className="block">
                  <div className="aspect-[3/4] bg-stone-soft rounded-2xl mb-3 overflow-hidden">
                    <ListingImage path={l.images?.[0]} alt={l.title} />
                  </div>
                  <h3 className="font-bold mb-1 truncate">{l.title}</h3>
                  <p className="text-xs text-muted-foreground">{Number(l.market_price).toLocaleString()} ر.س · {l.status}</p>
                </Link>
                <div className="flex gap-2 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={() => { if (confirm("حذف هذا العرض؟")) del.mutate(l.id); }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 text-destructive text-xs font-bold hover:bg-destructive/10 rounded-lg"
                  >
                    <Trash2 className="size-3.5" /> حذف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
