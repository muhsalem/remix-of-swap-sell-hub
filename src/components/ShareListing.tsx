import { useState } from "react";
import { Share2, Check, MessageCircle, Link2 } from "lucide-react";

export function ShareListing({ title, wants }: { title: string; wants: string }) {
  const [copied, setCopied] = useState(false);

  const getUrl = () => (typeof window !== "undefined" ? window.location.href : "");
  const shareText = `${title} — للمقايضة بـ ${wants} على بادل`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(getUrl());
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  };

  const waHref = `https://wa.me/?text=${encodeURIComponent(`${shareText}\n${getUrl()}`)}`;

  const nativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator & { share: (d: ShareData) => Promise<void> }).share({
          title,
          text: shareText,
          url: getUrl(),
        });
      } catch {
        /* user cancelled */
      }
    } else {
      copy();
    }
  };

  return (
    <div className="flex items-center gap-2" role="group" aria-label="مشاركة الإعلان">
      <button
        type="button"
        onClick={nativeShare}
        aria-label="مشاركة"
        className="flex-1 px-4 py-2.5 bg-card border border-border rounded-xl text-sm font-bold hover:border-primary/40 transition flex items-center justify-center gap-2"
      >
        <Share2 className="size-4" aria-hidden /> مشاركة
      </button>
      <a
        href={waHref}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="مشاركة عبر واتساب"
        className="px-3 py-2.5 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 rounded-xl text-sm font-bold hover:bg-emerald-500/15 transition flex items-center justify-center gap-2"
      >
        <MessageCircle className="size-4" aria-hidden /> واتساب
      </a>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "تم نسخ الرابط" : "نسخ رابط الإعلان"}
        className="px-3 py-2.5 bg-card border border-border rounded-xl text-sm font-bold hover:border-primary/40 transition flex items-center justify-center gap-2"
      >
        {copied ? <Check className="size-4 text-emerald-600" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
        {copied ? "نُسخ" : "نسخ"}
      </button>
    </div>
  );
}
