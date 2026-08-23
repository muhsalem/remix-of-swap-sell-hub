import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Nav } from "@/components/Nav";
import { getDispute, sendDisputeMessage } from "@/lib/disputes.functions";
import { uploadDisputeAttachment, getDisputeAttachmentUrl } from "@/lib/storage";
import { AlertTriangle, Paperclip, Send, X, ShieldCheck, Clock, CheckCircle2, Ban } from "lucide-react";

const disputeQuery = (id: string) =>
  queryOptions({ queryKey: ["dispute", id], queryFn: () => getDispute({ data: { id } }) });

export const Route = createFileRoute("/_authenticated/disputes/$id")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(disputeQuery(params.id)),
  head: () => ({
    meta: [
      { title: "تفاصيل النزاع — بادل بادل" },
      { name: "description", content: "تابع طلب النزاع الخاص بصفقتك: المرفقات والرسائل وحالة المراجعة حتى الإغلاق." },
      { property: "og:title", content: "تفاصيل النزاع — بادل بادل" },
      { property: "og:description", content: "متابعة طلب النزاع والمرفقات والرسائل حتى إغلاق الحالة." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  errorComponent: ({ error }) => <div className="p-12 text-center">{error.message}</div>,
  notFoundComponent: () => <div className="p-12 text-center">النزاع غير موجود</div>,
  component: DisputeDetailPage,
});

const STEPS = [
  { key: "open", label: "تم الفتح", icon: AlertTriangle },
  { key: "under_review", label: "قيد المراجعة", icon: Clock },
  { key: "resolved", label: "تم الحسم", icon: CheckCircle2 },
] as const;

function statusIndex(status: string) {
  if (status === "open") return 0;
  if (status === "under_review") return 1;
  return 2;
}

function DisputeDetailPage() {
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(disputeQuery(id));
  const qc = useQueryClient();
  const d = data.dispute as any;
  const closed = d.status === "resolved" || d.status === "rejected";
  const idx = statusIndex(d.status);

  const sendFn = useServerFn(sendDisputeMessage);
  const [body, setBody] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const send = useMutation({
    mutationFn: async () => {
      setUploading(true);
      try {
        const paths: string[] = [];
        for (const f of files) paths.push(await uploadDisputeAttachment(f, data.userId));
        return await sendFn({ data: { dispute_id: id, body, attachments: paths } });
      } finally {
        setUploading(false);
      }
    },
    onSuccess: () => {
      setBody("");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
      qc.invalidateQueries({ queryKey: ["dispute", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div dir="rtl" className="min-h-screen bg-background font-body">
      <Nav />
      <main className="max-w-4xl mx-auto px-6 py-10">
        <Link to="/disputes" className="text-xs text-muted-foreground hover:text-primary mb-4 inline-block">← كل النزاعات</Link>

        <div className="bg-card rounded-3xl ring-1 ring-black/5 p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
            <h1 className="text-xl font-extrabold flex items-center gap-2">
              <AlertTriangle className="text-destructive size-5" /> طلب نزاع
            </h1>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                d.status === "resolved" ? "bg-primary/10 text-primary"
                : d.status === "rejected" ? "bg-muted text-muted-foreground"
                : "bg-destructive/10 text-destructive"
              }`}>
                {d.status === "open" ? "مفتوح" : d.status === "under_review" ? "قيد المراجعة" : d.status === "resolved" ? "محسوم" : "مرفوض"}
              </span>
              {data.offer && (
                <Link to="/offers/$id" params={{ id: data.offer.id }} className="text-xs text-primary font-bold hover:underline">
                  فتح الصفقة ←
                </Link>
              )}
            </div>
          </div>

          {/* Tracker */}
          <ol className="flex items-center gap-2 mb-5">
            {STEPS.map((s, i) => {
              const Icon = d.status === "rejected" && i === 2 ? Ban : s.icon;
              const active = i <= idx;
              return (
                <li key={s.key} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold ring-1 ${
                    active ? "bg-primary/10 text-primary ring-primary/20" : "bg-stone-soft text-muted-foreground ring-black/5"
                  }`}>
                    <Icon className="size-3.5" />
                    {d.status === "rejected" && i === 2 ? "مرفوض" : s.label}
                  </div>
                  {i < STEPS.length - 1 && <div className={`h-0.5 flex-1 rounded ${i < idx ? "bg-primary/40" : "bg-border"}`} />}
                </li>
              );
            })}
          </ol>

          <div className="rounded-2xl bg-stone-soft p-4 text-sm">
            <span className="text-xs text-muted-foreground block mb-1">سبب النزاع</span>
            {d.reason}
            {d.evidence && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{d.evidence}</p>}
          </div>

          {d.resolution && (
            <div className="mt-3 rounded-2xl bg-primary/5 ring-1 ring-primary/20 p-4 text-sm">
              <span className="text-xs font-bold block mb-1 flex items-center gap-1"><ShieldCheck className="size-4 text-primary" /> قرار الإدارة</span>
              {d.resolution}
            </div>
          )}

          <SlaBar d={d} messages={data.messages as any[]} />

          <Timeline d={d} messages={data.messages as any[]} />

          <div className="mt-3 text-[11px] text-muted-foreground">
            فُتح في {new Date(d.created_at).toLocaleString("ar")}
            {data.offer?.escrow_locked && " · المبلغ مجمّد في حساب الضمان حتى الحسم"}
          </div>
        </div>


        <section className="bg-card rounded-3xl ring-1 ring-black/5 p-6">
          <h2 className="font-bold mb-4 pb-3 border-b border-border">سجل النزاع والمراسلات</h2>
          <div className="space-y-3 mb-5">
            {data.messages.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">لا توجد رسائل بعد.</p>
            )}
            {data.messages.map((m: any) => {
              if (m.is_system) {
                return (
                  <div key={m.id} className="text-center text-[11px] text-muted-foreground">
                    <span className="bg-stone-soft px-3 py-1 rounded-full">{m.body}</span>
                  </div>
                );
              }
              const mine = m.sender_id === data.userId;
              return (
                <div key={m.id} className={`flex ${mine ? "justify-start" : "justify-end"}`}>
                  <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm ${mine ? "bg-primary text-primary-foreground" : "bg-stone-soft"}`}>
                    {m.body && <p className="whitespace-pre-wrap">{m.body}</p>}
                    {(m.attachments ?? []).length > 0 && (
                      <div className="mt-2 space-y-1">
                        {m.attachments.map((p: string) => <AttachmentLink key={p} path={p} mine={mine} />)}
                      </div>
                    )}
                    <div className={`text-[10px] mt-1 ${mine ? "opacity-70" : "text-muted-foreground"}`}>
                      {new Date(m.created_at).toLocaleString("ar")}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {closed ? (
            <p className="text-center text-xs text-muted-foreground bg-stone-soft rounded-2xl py-3">
              تم إغلاق هذا النزاع — لا يمكن إضافة رسائل جديدة.
            </p>
          ) : (
            <form
              onSubmit={(e) => { e.preventDefault(); if (body.trim() || files.length) send.mutate(); }}
              className="space-y-2"
            >
              {files.length > 0 && (
                <ul className="flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <li key={i} className="flex items-center gap-1 text-[11px] bg-stone-soft px-2 py-1 rounded-full">
                      {f.name}
                      <button type="button" onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}>
                        <X className="size-3" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 10))}
                  className="hidden"
                  id="dispute-files"
                />
                <label htmlFor="dispute-files" className="px-3 py-2.5 rounded-full bg-stone-soft cursor-pointer flex items-center" title="إرفاق ملف">
                  <Paperclip className="size-4" />
                </label>
                <input
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="أضف تفاصيل أو ردّاً..."
                  maxLength={2000}
                  className="flex-1 px-4 py-2.5 rounded-full bg-stone-soft border border-border text-sm outline-none focus:ring-2 ring-primary/30"
                />
                <button
                  type="submit"
                  disabled={(!body.trim() && files.length === 0) || send.isPending || uploading}
                  className="px-4 py-2.5 bg-primary text-primary-foreground rounded-full font-bold disabled:opacity-50"
                >
                  <Send className="size-4" />
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">يمكن إرفاق صور أو ملفات PDF (حتى 10 ملفات). المرفقات خاصة ولا يراها إلا أطراف الصفقة والإدارة.</p>
            </form>
          )}
        </section>
      </main>
    </div>
  );
}

function AttachmentLink({ path, mine }: { path: string; mine: boolean }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let cancelled = false;
    getDisputeAttachmentUrl(path).then((u) => { if (!cancelled) setUrl(u); });
    return () => { cancelled = true; };
  }, [path]);
  const name = path.split("/").pop() ?? "مرفق";
  if (!url) return <span className={`text-[11px] ${mine ? "opacity-70" : "text-muted-foreground"}`}>جارٍ تحميل المرفق…</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`flex items-center gap-1 text-[11px] underline ${mine ? "" : "text-primary"}`}>
      <Paperclip className="size-3" /> {name}
    </a>
  );
}

type Ev = { at: string; title: string; note?: string; tone: "start" | "info" | "good" | "bad" };

function Timeline({ d, messages }: { d: any; messages: any[] }) {
  const events: Ev[] = [];
  events.push({
    at: d.created_at,
    title: "إرسال الطلب",
    note: d.reason,
    tone: "start",
  });

  const first = messages[0];
  const docCount = messages.reduce((n, m) => n + ((m.attachments ?? []).length as number), 0);
  if (first) {
    events.push({
      at: first.created_at,
      title: "استلام الوثائق والمرفقات",
      note: docCount > 0 ? `${docCount} مرفق مُرسل` : "بدون مرفقات",
      tone: "info",
    });
  }

  const firstAdmin = messages.find((m) => m.is_admin);
  if (firstAdmin) {
    events.push({ at: firstAdmin.created_at, title: "أول ردّ من فريق المراجعة", tone: "info" });
  }

  if (d.status === "under_review") {
    events.push({ at: d.updated_at, title: "الطلب قيد المراجعة", tone: "info" });
  }
  if (d.status === "resolved") {
    events.push({ at: d.updated_at, title: "قرار: قبول الطلب وإغلاقه", note: d.resolution ?? undefined, tone: "good" });
  }
  if (d.status === "rejected") {
    events.push({ at: d.updated_at, title: "قرار: رفض الطلب وإغلاقه", note: d.resolution ?? undefined, tone: "bad" });
  }

  const sorted = events
    .filter((e) => e.at)
    .sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  const dot: Record<Ev["tone"], string> = {
    start: "bg-destructive",
    info: "bg-amber-500",
    good: "bg-primary",
    bad: "bg-muted-foreground",
  };

  return (
    <div className="mt-5 rounded-2xl bg-stone-soft/60 p-4">
      <h3 className="text-xs font-bold mb-3">الخط الزمني للطلب</h3>
      <ol className="relative border-r border-border pr-4 space-y-4">
        {sorted.map((e, i) => (
          <li key={i} className="relative">
            <span className={`absolute -right-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-background ${dot[e.tone]}`} />
            <div className="text-xs font-bold">{e.title}</div>
            {e.note && <div className="text-[11px] text-muted-foreground whitespace-pre-wrap">{e.note}</div>}
            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
              {new Date(e.at).toLocaleString("ar")}
            </div>
          </li>
        ))}
        {(d.status === "open" || d.status === "under_review") && (
          <li className="relative opacity-60">
            <span className="absolute -right-[21px] top-1.5 size-2.5 rounded-full ring-2 ring-background bg-border" />
            <div className="text-xs font-bold">الإغلاق وإصدار القرار</div>
            <div className="text-[10px] text-muted-foreground">بانتظار قرار فريق المراجعة</div>
          </li>
        )}
      </ol>
    </div>
  );
}
