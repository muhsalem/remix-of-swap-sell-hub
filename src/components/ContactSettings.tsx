import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Phone, MessageCircle, Save } from "lucide-react";
import { updateMyContact, getMyContact } from "@/lib/post-match.functions";

export function ContactSettings() {
  const [phone, setPhone] = useState("");
  const [wa, setWa] = useState("");
  const fn = useServerFn(updateMyContact);
  const getFn = useServerFn(getMyContact);

  useEffect(() => {
    (async () => {
      try {
        const data = await getFn({});
        setPhone(data.contact_phone ?? "");
        setWa(data.whatsapp ?? "");
      } catch {
        /* not signed in */
      }
    })();
  }, [getFn]);

  const m = useMutation({
    mutationFn: () => fn({ data: { contact_phone: phone || null, whatsapp: wa || null } }),
    onSuccess: () => toast.success("تم حفظ بيانات التواصل"),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="rounded-2xl border border-border bg-card p-6">
      <h2 className="font-bold mb-1 flex items-center gap-2">
        <Phone className="size-4 text-primary" /> بيانات التواصل
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        تُكشف فقط للطرف الآخر بعد قبول العرض. تساعد على التنسيق المباشر للتسليم.
      </p>
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <Phone className="size-3" /> رقم الهاتف
          </label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+9665xxxxxxxx"
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground mb-1 flex items-center gap-1">
            <MessageCircle className="size-3" /> رقم واتساب
          </label>
          <input
            value={wa}
            onChange={(e) => setWa(e.target.value)}
            placeholder="+9665xxxxxxxx"
            className="w-full px-3 py-2 rounded-xl bg-stone-soft border border-border text-sm outline-none"
          />
        </div>
      </div>
      <button
        onClick={() => m.mutate()}
        disabled={m.isPending}
        className="mt-3 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold flex items-center gap-2 disabled:opacity-50"
      >
        <Save className="size-3.5" /> حفظ
      </button>
    </div>
  );
}
