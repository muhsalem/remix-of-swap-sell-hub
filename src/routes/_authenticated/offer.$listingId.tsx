import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { listMyListingsForOffer, getListingForOffer, createOffer, getDiWallet } from "@/lib/offers.functions";
import { logConsent } from "@/lib/consent.functions";
import { Nav } from "@/components/Nav";
import { ListingImage } from "@/components/ListingImage";
import { LocalPrice, useUserCurrency } from "@/components/LocalPrice";
import { OfferPreviewPanel } from "@/components/OfferPreviewPanel";
import { ConsentCheckbox } from "@/components/ConsentCheckbox";
import { ArrowLeftRight, Plus, Coins } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

const myQ = queryOptions({ queryKey: ["my-active-listings"], queryFn: () => listMyListingsForOffer() });
const diQ = queryOptions({ queryKey: ["di-wallet"], queryFn: () => getDiWallet() });
const targetQ = (id: string) => queryOptions({ queryKey: ["target-listing", id], queryFn: () => getListingForOffer({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/offer/$listingId")({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(myQ),
      context.queryClient.ensureQueryData(targetQ(params.listingId)),
    ]);
  },
  head: () => ({ meta: [{ title: "اقترح مقايضة — بادل بادل" }] }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">غير موجود</div>,
  component: NewOfferPage,
});

function NewOfferPage() {
  const { listingId } = Route.useParams();
  const navigate = useNavigate();
  const { data: mine } = useSuspenseQuery(myQ);
  const { data: target } = useSuspenseQuery(targetQ(listingId));
  const targetListing = target.listing as any;

  const [selectedId, setSelectedId] = useState<string>("");
  const [cash, setCash] = useState(0);
  const [di, setDi] = useState(0);
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const { country } = useUserCurrency();
  const diWallet = useQuery(diQ);

  const myListing = mine.listings.find((l) => l.id === selectedId);
  const sarPerDi = diWallet.data?.sarPerDi ?? 5;
  const gapSar = Math.max(
    0,
    Math.round((Number(targetListing?.market_price ?? 0) - Number(myListing?.market_price ?? 0)) * 100) / 100,
  );
  const remainingGap = Math.max(0, Math.round((gapSar - cash - di * sarPerDi) * 100) / 100);
  const diNeeded = Math.ceil(Math.max(0, gapSar - cash) / sarPerDi);
  const diAvailable = diWallet.data?.balance ?? 0;
  const canCoverWithDi = Boolean(diWallet.data?.enabled) && diNeeded > 0 && diAvailable >= diNeeded;

  const createFn = useServerFn(createOffer);
  const consentFn = useServerFn(logConsent);
  const m = useMutation({
    mutationFn: async () => {
      const res = await createFn({
        data: { requested_listing: listingId, offered_listing: selectedId, cash_balance: cash, di_balance: di, message },
      });
      try {
        await consentFn({
          data: {
            country_code: (country === "EG" ? "EG" : "SA") as "SA" | "EG",
            context: "create_offer",
            docs: ["terms", "privacy", "barter"],
            offer_id: res.id,
            listing_id: listingId,
            user_agent: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 500) : null,
          },
        });
      } catch (e) { console.warn("consent log failed", e); }
      return res;
    },
    onSuccess: ({ id }) => {
      toast.success("تم إرسال عرض المقايضة");
      navigate({ to: "/offers/$id", params: { id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!targetListing) return <div className="p-12 text-center">العرض المطلوب غير موجود</div>;

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <h1 className="font-display text-3xl font-extrabold mb-2">اقترح مقايضة</h1>
        <p className="text-sm text-muted-foreground mb-8">
          على عرض <strong className="text-foreground">{targetListing.title}</strong> من{" "}
          <strong className="text-foreground">{targetListing.profiles?.display_name ?? "مستخدم"}</strong>
        </p>

        <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 mb-6">
          <h2 className="font-bold mb-4">١. اختر عرضك للمقايضة</h2>
          {mine.listings.length === 0 ? (
            <div className="text-center p-8 bg-stone-soft rounded-2xl">
              <p className="text-sm text-muted-foreground mb-4">ليس لديك عروض نشطة بعد</p>
              <Link to="/new-listing" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full text-sm font-bold">
                <Plus className="size-4" /> أضف عرضاً
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {mine.listings.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  onClick={() => setSelectedId(l.id)}
                  className={`bg-stone-soft rounded-2xl p-3 text-right transition-all ${
                    selectedId === l.id ? "ring-2 ring-primary" : "hover:ring-1 ring-border"
                  }`}
                >
                  <div className="aspect-[4/3] rounded-xl overflow-hidden mb-2 bg-card">
                    <ListingImage path={l.images?.[0]} alt={l.title} />
                  </div>
                  <div className="font-bold text-xs truncate">{l.title}</div>
                  <div className="text-[10px] text-muted-foreground"><LocalPrice sar={l.market_price} /></div>
                </button>
              ))}
            </div>
          )}
        </div>

        {selectedId && (
          <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 mb-6">
            <h2 className="font-bold mb-4">٢. تفاصيل العرض</h2>

            <div className="flex items-center justify-center gap-4 mb-6 p-4 bg-stone-soft rounded-2xl">
              <Preview listing={mine.listings.find((l) => l.id === selectedId)} />
              <ArrowLeftRight className="size-6 text-primary" />
              <Preview listing={targetListing} />
            </div>

            <label className="block mb-4">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">
                مبلغ نقدي للموازنة (اختياري — ر.س)
              </span>
              <input
                type="number"
                min={0}
                value={cash}
                onChange={(e) => setCash(Number(e.target.value) || 0)}
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none focus:ring-2 ring-primary/30"
              />
            </label>

            {gapSar > 0 && diWallet.data?.enabled && (
              <div className="mb-6 rounded-2xl border border-primary/25 bg-primary/5 p-4">
                <div className="flex items-start gap-3">
                  <Coins className="size-5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1">
                    <p className="font-bold text-sm">
                      الفرق {gapSar.toLocaleString("ar-EG")} ر.س → غطِّها بـ {diNeeded.toLocaleString("ar-EG")} DI
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      رصيدك: {diAvailable.toLocaleString("ar-EG")} DI ({sarPerDi} ر.س لكل DI). سدّ الفرق بعملة بَدِّل بدل التفاوض النقدي.
                    </p>

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        type="button"
                        disabled={!canCoverWithDi}
                        onClick={() => setDi(diNeeded)}
                        className="px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50"
                      >
                        غطِّ الفرق بـ DI
                      </button>
                      {di > 0 && (
                        <button
                          type="button"
                          onClick={() => setDi(0)}
                          className="px-4 py-2 rounded-full bg-stone-soft text-xs font-bold"
                        >
                          إلغاء
                        </button>
                      )}
                      <input
                        type="number"
                        min={0}
                        max={diAvailable}
                        value={di}
                        onChange={(e) => setDi(Math.max(0, Math.min(diAvailable, Number(e.target.value) || 0)))}
                        className="w-28 px-3 py-2 rounded-xl bg-card border border-border text-xs outline-none focus:ring-2 ring-primary/30"
                        aria-label="مقدار DI"
                      />
                    </div>

                    {!canCoverWithDi && diNeeded > 0 && (
                      <p className="text-xs text-amber-600 mt-2">
                        رصيدك لا يكفي لتغطية الفرق كاملاً — يمكنك تغطية جزء منه أو إضافة مبلغ نقدي.
                      </p>
                    )}
                    <p className="text-xs mt-2">
                      {remainingGap > 0
                        ? `المتبقي بعد التغطية: ${remainingGap.toLocaleString("ar-EG")} ر.س`
                        : "✅ الفرق مُغطّى بالكامل"}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      يُخصم DI من رصيدك ويُضاف للطرف الآخر عند اكتمال الصفقة فقط.
                    </p>
                  </div>
                </div>
              </div>
            )}

            <label className="block mb-6">
              <span className="text-xs uppercase tracking-widest text-muted-foreground font-bold block mb-1.5">
                رسالة للطرف الآخر
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={1000}
                rows={4}
                placeholder="عرّف بنفسك واشرح سبب المقايضة..."
                className="w-full px-4 py-3 rounded-xl bg-stone-soft border border-border outline-none focus:ring-2 ring-primary/30"
              />
            </label>

            <OfferPreviewPanel
              mine={mine.listings.find((l) => l.id === selectedId) as never}
              target={targetListing}
              cash={cash}
            />

            <div className="mt-4 mb-3">
              <ConsentCheckbox checked={consent} onChange={setConsent} context="create_offer" />
            </div>

            <button
              onClick={() => {
                if (!consent) { toast.error("يجب الموافقة على الشروط أولاً"); return; }
                m.mutate();
              }}
              disabled={m.isPending || !consent}
              className="w-full px-6 py-3.5 bg-foreground text-background rounded-xl font-bold hover:bg-primary transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {m.isPending ? "جاري الإرسال..." : "تأكيد وإرسال عرض المقايضة"}
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

function Preview({ listing }: { listing: any }) {
  if (!listing) return null;
  return (
    <div className="text-center flex-1">
      <div className="size-20 mx-auto rounded-2xl bg-card overflow-hidden mb-2">
        <ListingImage path={listing.images?.[0]} alt={listing.title} />
      </div>
      <div className="text-xs font-bold truncate">{listing.title}</div>
      <div className="text-[10px] text-muted-foreground"><LocalPrice sar={listing.market_price} /></div>
    </div>
  );
}
