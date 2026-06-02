import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { listMyOffers } from "@/lib/offers.functions";
import { Nav } from "@/components/Nav";
import { ListingImage } from "@/components/ListingImage";
import { ArrowLeftRight, Inbox, Send } from "lucide-react";

const offersQuery = queryOptions({
  queryKey: ["my-offers"],
  queryFn: () => listMyOffers(),
});

export const Route = createFileRoute("/_authenticated/offers")({
  loader: ({ context }) => context.queryClient.ensureQueryData(offersQuery),
  head: () => ({ meta: [{ title: "صندوق المقايضات — إيكال EQAL" }] }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: OffersPage,
});

const STATUS_LABEL: Record<string, { ar: string; cls: string }> = {
  pending: { ar: "بانتظار الرد", cls: "bg-accent/20 text-accent-foreground" },
  accepted: { ar: "مقبول", cls: "bg-primary/15 text-primary" },
  rejected: { ar: "مرفوض", cls: "bg-destructive/15 text-destructive" },
  cancelled: { ar: "ملغى", cls: "bg-muted text-muted-foreground" },
  completed: { ar: "مكتمل ✓", cls: "bg-primary text-primary-foreground" },
};

function OffersPage() {
  const { data } = useSuspenseQuery(offersQuery);
  const incoming = data.offers.filter((o) => o.to_user === data.userId);
  const outgoing = data.offers.filter((o) => o.from_user === data.userId);

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-6xl mx-auto px-6 py-12">
        <h1 className="font-display text-3xl font-extrabold mb-8">صندوق المقايضات</h1>

        <Section title="الواردة إليك" icon={<Inbox className="size-5" />} offers={incoming} userId={data.userId} />
        <Section title="عروضك المرسلة" icon={<Send className="size-5" />} offers={outgoing} userId={data.userId} />
      </main>
    </div>
  );
}

function Section({
  title,
  icon,
  offers,
  userId,
}: {
  title: string;
  icon: React.ReactNode;
  offers: any[];
  userId: string;
}) {
  return (
    <section className="mb-12">
      <h2 className="flex items-center gap-2 text-lg font-bold mb-4">
        {icon} {title} <span className="text-xs font-normal text-muted-foreground">({offers.length})</span>
      </h2>
      {offers.length === 0 ? (
        <p className="text-sm text-muted-foreground p-6 bg-card rounded-2xl ring-1 ring-black/5">لا توجد عروض هنا بعد.</p>
      ) : (
        <div className="grid gap-3">
          {offers.map((o) => {
            const status = STATUS_LABEL[o.status] ?? STATUS_LABEL.pending;
            return (
              <Link
                key={o.id}
                to="/offers/$id"
                params={{ id: o.id }}
                className="bg-card rounded-2xl p-4 ring-1 ring-black/5 hover:ring-primary/30 transition-all"
              >
                <div className="flex items-center gap-4">
                  <Mini listing={o.offered} />
                  <ArrowLeftRight className="size-5 text-muted-foreground shrink-0" />
                  <Mini listing={o.requested} />
                  <div className="mr-auto text-left flex flex-col items-end gap-1">
                    <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${status.cls}`}>{status.ar}</span>
                    {Number(o.cash_balance) > 0 && (
                      <span className="text-[11px] text-muted-foreground">+{Number(o.cash_balance).toLocaleString()} ر.س</span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

function Mini({ listing }: { listing: any }) {
  if (!listing) return <div className="flex-1 text-xs text-muted-foreground">منتج محذوف</div>;
  return (
    <div className="flex items-center gap-2 flex-1 min-w-0">
      <div className="size-12 rounded-xl bg-stone-soft overflow-hidden shrink-0">
        <ListingImage path={listing.images?.[0]} alt={listing.title} />
      </div>
      <div className="min-w-0">
        <div className="font-bold text-sm truncate">{listing.title}</div>
        <div className="text-[11px] text-muted-foreground">{Number(listing.market_price).toLocaleString()} ر.س</div>
      </div>
    </div>
  );
}
