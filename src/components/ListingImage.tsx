import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ImageIcon } from "lucide-react";

export function ListingImage({ path, alt, className = "w-full h-full object-cover" }: { path?: string; alt: string; className?: string }) {
  const [url, setUrl] = useState<string>("");

  useEffect(() => {
    if (!path) { setUrl(""); return; }
    if (path.startsWith("http")) { setUrl(path); return; }
    let cancelled = false;
    supabase.storage.from("listing-images").createSignedUrl(path, 60 * 60).then(({ data }) => {
      if (!cancelled && data?.signedUrl) setUrl(data.signedUrl);
    });
    return () => { cancelled = true; };
  }, [path]);

  if (!path || !url) {
    return (
      <div className={`flex items-center justify-center bg-stone-soft text-muted-foreground ${className.includes("h-") ? "" : "w-full h-full"}`}>
        <ImageIcon className="size-8 opacity-30" />
      </div>
    );
  }
  return <img src={url} alt={alt} loading="lazy" className={className} />;
}
