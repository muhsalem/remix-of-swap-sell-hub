import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { findThreeWayMatches } from "@/lib/matching.functions";
import { suggestNegotiation } from "@/lib/negotiator.functions";
import { myListings } from "@/lib/listings.functions";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/three-way")({
  component: ThreeWayPage,
  head: () => ({
    meta: [
      { title: "مقايضة ثلاثية A→B→C | بدِّل" },
      { name: "description", content: "اكتشف فرص المقايضة الدائرية بين ثلاثة أطراف بمساعدة الذكاء الاصطناعي" },
    ],
  }),
  errorComponent: ({ error, reset }) => {
    const router = useRouter();
    return (
      <div className="p-6 text-center">
        <p className="text-destructive mb-3">حدث خطأ: {error.message}</p>
        <Button onClick={() => { reset(); router.invalidate(); }}>إعادة المحاولة</Button>
      </div>
    );
  },
  notFoundComponent: () => <div className="p-6">الصفحة غير موجودة</div>,
});

function ThreeWayPage() {
  const [listingId, setListingId] = useState("");
  const [desired, setDesired] = useState("");
  const find = useServerFn(findThreeWayMatches);
  const negotiate = useServerFn(suggestNegotiation);
  const mine = useQuery({ queryKey: ["my-listings"], queryFn: () => myListings() });

  const search = useMutation({
    mutationFn: () => find({ data: { myListingId: listingId, desiredCategory: desired } }),
    onError: (e: any) => toast.error(e.message),
  });

  const negotiateAI = useMutation({
    mutationFn: (vars: { myItem: string; theirItem: string }) =>
      negotiate({ data: vars }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="container max-w-5xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="text-accent" /> مقايضة ثلاثية ذكية
        </h1>
        <p className="text-muted-foreground mt-2">
          عندما لا يملك الطرف الآخر ما تريد، نبحث عن سلسلة A→B→C تُغلق الصفقة لكل الأطراف.
        </p>
      </div>

      <Card className="p-5 mb-6 space-y-4">
        <div>
          <label className="text-sm font-medium block mb-2">إعلاني</label>
          <select
            className="w-full rounded-md border bg-background p-2"
            value={listingId}
            onChange={(e) => setListingId(e.target.value)}
          >
            <option value="">— اختر إعلاناً —</option>
            {mine.data?.listings.map((l: any) => (
              <option key={l.id} value={l.id}>{l.title}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-sm font-medium block mb-2">ما الذي تريده؟ (فئة/كلمة)</label>
          <Input value={desired} onChange={(e) => setDesired(e.target.value)} placeholder="مثال: لابتوب، دراجة، استشارة قانونية" />
        </div>
        <Button
          disabled={!listingId || !desired || search.isPending}
          onClick={() => search.mutate()}
          className="w-full"
        >
          {search.isPending && <Loader2 className="animate-spin ml-2 h-4 w-4" />}
          ابحث عن سلاسل مطابقة
        </Button>
      </Card>

      {search.data && search.data.chains.length === 0 && (
        <Card className="p-6 text-center text-muted-foreground">
          لم نجد سلاسل ثلاثية حالياً — جرب فئة أوسع أو عُد لاحقاً.
        </Card>
      )}

      <div className="space-y-4">
        {search.data?.chains.map((c, i) => (
          <Card key={i} className="p-5">
            <div className="flex flex-wrap items-center gap-3 text-sm">
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">أنت</span>
              <ArrowRight className="h-4 w-4" />
              <Link to="/listings/$id" params={{ id: c.bListing.id }} className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80">
                B: {c.bListing.title}
              </Link>
              <ArrowRight className="h-4 w-4" />
              <Link to="/listings/$id" params={{ id: c.cListing.id }} className="px-3 py-1 rounded-full bg-secondary hover:bg-secondary/80">
                C: {c.cListing.title}
              </Link>
              <ArrowRight className="h-4 w-4" />
              <span className="px-3 py-1 rounded-full bg-primary/10 text-primary font-medium">أنت تستلم {c.intermediateCategory}</span>
            </div>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  negotiateAI.mutate({
                    myItem: mine.data?.listings.find((l: any) => l.id === listingId)?.title ?? "",
                    theirItem: c.bListing.title,
                  })
                }
              >
                <Sparkles className="h-4 w-4 ml-1" /> اقتراح رسالة تفاوض
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {negotiateAI.data && (
        <Card className="p-5 mt-6 border-accent/40 bg-accent/5">
          <h3 className="font-bold mb-2">اقتراح المفاوض الذكي</h3>
          <p className="text-sm text-muted-foreground mb-2">
            عدالة: {negotiateAI.data.fairness} • فجوة القيمة: {negotiateAI.data.gapPct}٪
          </p>
          <div className="bg-background border rounded p-3 text-sm whitespace-pre-wrap">{negotiateAI.data.message}</div>
          {negotiateAI.data.tips?.length > 0 && (
            <ul className="mt-3 list-disc pr-5 text-sm space-y-1">
              {negotiateAI.data.tips.map((t, i) => <li key={i}>{t}</li>)}
            </ul>
          )}
        </Card>
      )}
    </div>
  );
}
