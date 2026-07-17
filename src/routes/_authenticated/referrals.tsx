import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  getMyReferralSummary,
  getOrCreateMyReferral,
  redeemReferral,
  redeemFeaturedCoupon,
} from "@/lib/referrals.functions";

export const Route = createFileRoute("/_authenticated/referrals")({
  head: () => ({
    meta: [
      { title: "برنامج الإحالة — بدل" },
      { name: "description", content: "ادعُ أصدقاءك واحصل على إعلان مميز مجاناً وخصومات ترقية." },
    ],
  }),
  component: ReferralsPage,
});

type Reward = {
  id: string;
  reward_type: "free_featured_7d" | "welcome_discount_10" | "free_verify_month";
  status: "active" | "used" | "expired";
  granted_at: string;
  expires_at: string | null;
  used_at: string | null;
  note: string | null;
};

const REWARD_LABEL: Record<Reward["reward_type"], string> = {
  free_featured_7d: "إعلان مميز 7 أيام مجاناً",
  welcome_discount_10: "خصم ترحيبي 10% على أول ترقية",
  free_verify_month: "توثيق مجاني لشهر",
};

function ReferralsPage() {
  const qc = useQueryClient();
  const summaryFn = useServerFn(getMyReferralSummary);
  const createFn = useServerFn(getOrCreateMyReferral);
  const redeemFn = useServerFn(redeemReferral);
  const redeemCouponFn = useServerFn(redeemFeaturedCoupon);

  const summary = useQuery({
    queryKey: ["referrals-summary"],
    queryFn: () => summaryFn({ data: undefined as never }),
  });

  const createMut = useMutation({
    mutationFn: () => createFn({ data: undefined as never }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["referrals-summary"] }),
  });

  const [code, setCode] = useState("");
  const redeemMut = useMutation({
    mutationFn: () => redeemFn({ data: { code } }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(r.message);
        setCode("");
        qc.invalidateQueries({ queryKey: ["referrals-summary"] });
      } else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [selectedReward, setSelectedReward] = useState<string | null>(null);
  const listings = useQuery({
    queryKey: ["my-listings-brief"],
    queryFn: async () => {
      const { data } = await supabase
        .from("listings")
        .select("id, title, is_featured, featured_until")
        .order("created_at", { ascending: false })
        .limit(50);
      return data ?? [];
    },
  });

  const applyMut = useMutation({
    mutationFn: (v: { reward_id: string; listing_id: string }) => redeemCouponFn({ data: v }),
    onSuccess: (r) => {
      if (r.ok) {
        toast.success(r.message);
        setSelectedReward(null);
        qc.invalidateQueries({ queryKey: ["referrals-summary"] });
        qc.invalidateQueries({ queryKey: ["my-listings-brief"] });
      } else toast.error(r.message);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const data = summary.data;
  const shareUrl = data?.code
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/waitlist?ref=${data.code}`
    : "";

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">برنامج الإحالة</h1>
        <p className="text-muted-foreground mt-1">
          خلال المرحلة التجريبية: ادعُ صديقاً، وعندما يكمل أول صفقة يحصل كلاكما على{" "}
          <b>إعلان مميز 7 أيام مجاناً</b>. ومن يستخدم كودك يحصل فوراً على خصم ترحيبي 10%.
        </p>
      </header>

      {/* My code card */}
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold mb-3">كود الإحالة الخاص بي</h2>
        {data?.code ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded-lg bg-muted px-3 py-2 font-mono text-lg tracking-wider">
                {data.code}
              </code>
              <button
                className="rounded-lg border px-3 py-2 hover:bg-muted"
                onClick={() => {
                  navigator.clipboard.writeText(data.code!);
                  toast.success("تم نسخ الكود");
                }}
              >
                نسخ الكود
              </button>
              <button
                className="rounded-lg bg-primary text-primary-foreground px-3 py-2"
                onClick={() => {
                  navigator.clipboard.writeText(shareUrl);
                  toast.success("تم نسخ رابط الدعوة");
                }}
              >
                نسخ الرابط
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-center pt-2">
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="text-2xl font-bold">{data.invited}</div>
                <div className="text-xs text-muted-foreground">من انضم بكودك</div>
              </div>
              <div className="rounded-xl bg-muted/50 p-3">
                <div className="text-2xl font-bold">{data.converted}</div>
                <div className="text-xs text-muted-foreground">أكملوا أول صفقة</div>
              </div>
            </div>
          </div>
        ) : (
          <button
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2"
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
          >
            {createMut.isPending ? "جارٍ الإنشاء..." : "أنشئ كودي الآن"}
          </button>
        )}
      </section>

      {/* Redeem someone else's code */}
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold mb-3">استخدام كود إحالة</h2>
        <div className="flex gap-2">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="مثال: BD-XXXXXX"
            className="flex-1 rounded-lg border px-3 py-2 font-mono"
          />
          <button
            className="rounded-lg bg-primary text-primary-foreground px-4 py-2 disabled:opacity-50"
            disabled={!code.trim() || redeemMut.isPending}
            onClick={() => redeemMut.mutate()}
          >
            {redeemMut.isPending ? "جارٍ التحقق..." : "تفعيل"}
          </button>
        </div>
      </section>

      {/* Rewards list */}
      <section className="rounded-2xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold mb-3">مكافآتي</h2>
        {summary.isLoading ? (
          <p className="text-sm text-muted-foreground">جارٍ التحميل...</p>
        ) : !data?.rewards.length ? (
          <p className="text-sm text-muted-foreground">
            لا توجد مكافآت بعد. ادعُ صديقاً ليكمل أول صفقة وستظهر هنا.
          </p>
        ) : (
          <ul className="space-y-2">
            {(data.rewards as Reward[]).map((r) => (
              <li key={r.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{REWARD_LABEL[r.reward_type]}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.status === "active"
                        ? r.expires_at
                          ? `تنتهي في ${new Date(r.expires_at).toLocaleDateString("ar")}`
                          : "سارية"
                        : r.status === "used"
                          ? "مُستخدمة"
                          : "منتهية"}
                    </div>
                  </div>
                  {r.reward_type === "free_featured_7d" && r.status === "active" && (
                    <button
                      className="rounded-lg bg-primary text-primary-foreground px-3 py-1.5 text-sm"
                      onClick={() =>
                        setSelectedReward(selectedReward === r.id ? null : r.id)
                      }
                    >
                      {selectedReward === r.id ? "إغلاق" : "تطبيق على إعلان"}
                    </button>
                  )}
                </div>

                {selectedReward === r.id && (
                  <div className="mt-3 space-y-2 border-t pt-3">
                    {listings.data?.length ? (
                      listings.data.map((l) => (
                        <div
                          key={l.id}
                          className="flex items-center justify-between gap-2 text-sm"
                        >
                          <span className="truncate">{l.title}</span>
                          <button
                            className="rounded border px-2 py-1 hover:bg-muted disabled:opacity-50"
                            disabled={applyMut.isPending}
                            onClick={() =>
                              applyMut.mutate({ reward_id: r.id, listing_id: l.id })
                            }
                          >
                            استخدم هنا
                          </button>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        ليس لديك إعلانات بعد. أنشئ إعلاناً أولاً.
                      </p>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
