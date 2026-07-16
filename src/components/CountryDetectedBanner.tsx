import { useEffect, useId, useMemo, useRef, useState } from "react";
import { FX_VS_SAR, loadCountry, saveCountry } from "@/lib/currency-fx";
import { detectCountryServer } from "@/lib/geo.functions";
import { getPreferredCountry } from "@/lib/currency-pref.functions";
import { queuePreferredCountry, flushPrefSyncQueue, getPendingPrefSync, MAX_PREF_SYNC_ATTEMPTS, type QueueEntry } from "@/lib/pref-sync-queue";
import { supabase } from "@/integrations/supabase/client";
import { track } from "@/lib/analytics";
import { MapPin, Check, X, Info, Globe2, Radio, Cloud, CloudOff, Loader2, RefreshCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

const DISMISS_KEY = "badel:country-banner-dismissed";
const CONFIRMED_KEY = "badel:country-confirmed";

// Launch markets get priority; the rest are available inside the modal.
const LAUNCH: Array<"SAR" | "EGP"> = ["SAR", "EGP"];

type SupportedCode = keyof typeof FX_VS_SAR;

/**
 * Small banner that appears on first visit. Clicking "تأكيد" or "خيارات"
 * opens a modal explaining how detection worked and lets the user pick
 * a different currency from all supported markets before saving.
 */
function classifyError(err: unknown): {
  kind: "network" | "server" | "unknown";
  message: string;
  status?: number;
} {
  const raw = (err as Error)?.message ?? String(err ?? "");
  const online = typeof navigator !== "undefined" ? navigator.onLine : true;
  const statusMatch = raw.match(/\b(4\d{2}|5\d{2})\b/);
  const status = statusMatch ? Number(statusMatch[1]) : undefined;

  if (!online || /NetworkError|Failed to fetch|network|ECONNRESET|ENOTFOUND|timeout|timed out|abort/i.test(raw)) {
    return {
      kind: "network",
      message: online
        ? "تعذّر الوصول إلى الخادم — تحقّق من اتصالك بالإنترنت."
        : "لا يوجد اتصال بالإنترنت.",
      status,
    };
  }
  if (status && status >= 500) {
    return { kind: "server", message: `خطأ في الخادم (${status}) — حاول لاحقاً.`, status };
  }
  if (status === 401 || status === 403) {
    return { kind: "server", message: "انتهت صلاحية جلستك — يرجى تسجيل الدخول مجدداً.", status };
  }
  if (status && status >= 400) {
    return { kind: "server", message: `طلب غير صالح (${status}).`, status };
  }
  return { kind: "unknown", message: raw ? raw.slice(0, 200) : "خطأ غير معروف." };
}

export function CountryDetectedBanner() {
  const [visible, setVisible] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detected, setDetected] = useState<SupportedCode>("SAR");
  const [selected, setSelected] = useState<SupportedCode>("SAR");
  const [source, setSource] = useState<string>("client-fallback");
  const [signedIn, setSignedIn] = useState<boolean>(false);
  const [syncStatus, setSyncStatus] = useState<
    "idle" | "syncing" | "saved" | "error" | "guest" | "queued" | "offline"
  >("idle");
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<{
    kind: "network" | "server" | "unknown";
    message: string;
    status?: number;
    stage: "fetch" | "save";
    at: Date;
  } | null>(null);
  const [pendingEntry, setPendingEntry] = useState<QueueEntry | null>(null);
  // Monotonic clock tick — driven by performance.now() so system-clock
  // jumps (NTP resync, user changing device time, DST) cannot alter the
  // countdown. Only used as a heartbeat; the actual remaining time is
  // computed against a captured anchor below.
  const perfNow = () =>
    typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  const [tickPerf, setTickPerf] = useState<number>(() => perfNow());
  // Anchor: captured once per distinct `nextRetryAt`. Stores the perf
  // timestamp when we observed it and the wall-clock remaining at that
  // instant. Subsequent ticks derive remaining purely from perf deltas.
  const anchorRef = useRef<{ key: string; anchorPerf: number; remainingAtAnchor: number } | null>(null);
  const trackedRef = useRef(false);
  const primaryBtnRef = useRef<HTMLButtonElement | null>(null);
  const titleId = useId();
  const descId = useId();
  const sourceId = useId();

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
      if (localStorage.getItem(CONFIRMED_KEY) === "1") return;
    } catch { /* ignore */ }

    const current = loadCountry() as SupportedCode;
    setDetected(current);
    setSelected(current);

    detectCountryServer()
      .then((r) => {
        const detectedCode: SupportedCode =
          r?.country && FX_VS_SAR[r.country] ? (r.country as SupportedCode) : current;
        const src = r?.source || "client-fallback";
        setSource(src);
        setDetected(detectedCode);
        setSelected(detectedCode);
        if (!trackedRef.current) {
          trackedRef.current = true;
          void track("country_detected", {
            detected: detectedCode,
            local: current,
            source: src,
            matches_local: detectedCode === current,
          });
        }
      })
      .catch(() => {
        if (!trackedRef.current) {
          trackedRef.current = true;
          void track("country_detected", {
            detected: current,
            local: current,
            source: "client-fallback",
            matches_local: true,
          });
        }
      });

    // Check sign-in status and fetch server-side preference to display last-sync info.
    (async () => {
      const t0 = performance.now();
      try {
        const { data } = await supabase.auth.getUser();
        if (!data.user) {
          setSignedIn(false);
          setSyncStatus("guest");
          void track("sync_pref_fetch", { stage: "guest", signed_in: false });
          return;
        }
        setSignedIn(true);
        setSyncStatus("syncing");
        void track("sync_pref_fetch", { stage: "start", signed_in: true });
        const res = await getPreferredCountry();
        const duration_ms = Math.round(performance.now() - t0);
        setLastSyncedAt(new Date());
        setSyncStatus("saved");
        void track("sync_pref_fetch", {
          stage: "success",
          signed_in: true,
          has_server_pref: !!res?.country,
          server_country: res?.country ?? null,
          duration_ms,
        });
        if (res?.country && FX_VS_SAR[res.country as SupportedCode]) {
          setSelected(res.country as SupportedCode);
        }
      } catch (err) {
        const info = classifyError(err);
        setLastError({ ...info, stage: "fetch", at: new Date() });
        setSyncStatus("error");
        void track("sync_pref_fetch", {
          stage: "error",
          duration_ms: Math.round(performance.now() - t0),
          error: info.message,
          error_kind: info.kind,
          error_status: info.status ?? null,
        });
      }
    })();

    setVisible(true);
  }, []);

  const sortedCodes = useMemo<SupportedCode[]>(() => {
    const all = Object.keys(FX_VS_SAR) as SupportedCode[];
    const rest = all.filter((c) => !LAUNCH.includes(c as "SAR" | "EGP"));
    return [...LAUNCH, ...rest];
  }, []);

  // Keyboard: Esc dismisses banner while modal is closed.
  useEffect(() => {
    if (!visible || modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        dismiss();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, modalOpen]);

  // Auto-hide after 10s of inactivity: silently accept the detected country
  // and persist so the banner does not re-appear next visit.
  useEffect(() => {
    if (!visible || modalOpen) return;
    const t = window.setTimeout(() => {
      try {
        saveCountry(detected);
        localStorage.setItem(CONFIRMED_KEY, "1");
      } catch { /* ignore */ }
      void track("country_confirmed", {
        action: "auto_timeout",
        country: detected,
        source,
        timeout_ms: 10000,
      });
      setVisible(false);
    }, 10000);
    return () => window.clearTimeout(t);
  }, [visible, modalOpen, detected, source]);

  // Track pending queue entry (attempts + next retry) while the modal is open.
  const exhaustionFiredRef = useRef<string | null>(null);
  useEffect(() => {
    if (!modalOpen) return;
    const read = () => {
      const entry = getPendingPrefSync();
      setPendingEntry(entry);
      if (entry && entry.attempts >= MAX_PREF_SYNC_ATTEMPTS && !entry.nextRetryAt) {
        const key = `${entry.queuedAt}:${entry.attempts}`;
        if (exhaustionFiredRef.current !== key) {
          exhaustionFiredRef.current = key;
          void track("pref_sync_exhausted", {
            country: entry.country,
            attempts: entry.attempts,
            max_attempts: MAX_PREF_SYNC_ATTEMPTS,
            next_retry_at: entry.nextRetryAt ?? null,
            queued_at: entry.queuedAt,
            last_error: entry.lastError ?? null,
            online: typeof navigator !== "undefined" ? navigator.onLine : null,
            sync_status: syncStatus,
          });
        }
      } else if (!entry) {
        exhaustionFiredRef.current = null;
      }
    };
    read();
    const tick = window.setInterval(() => {
      read();
      setTickPerf(perfNow());
    }, 1000);
    const onSync = () => read();
    window.addEventListener("badel:pref-sync", onSync as EventListener);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("badel:pref-sync", onSync as EventListener);
    };
  }, [modalOpen, syncStatus]);


  if (!visible) return null;

  const fx = FX_VS_SAR[detected];
  const selFx = FX_VS_SAR[selected];
  const sourceLabel =
    source === "edge-header"
      ? "من عنوان الاتصال (Edge Header)"
      : "من إعدادات المتصفح واللغة";
  const sourceShort = source === "edge-header" ? "شبكة الاتصال" : "لغة المتصفح";

  const openModal = () => setModalOpen(true);

  const runSync = async (isRetry = false) => {
    if (!(signedIn && (selected === "SAR" || selected === "EGP"))) return;
    setSyncStatus("syncing");
    const t0 = performance.now();
    void track("sync_pref_save", {
      stage: "start",
      country: selected,
      from: detected,
      source,
      retry: isRetry,
    });
    try {
      const online = typeof navigator !== "undefined" ? navigator.onLine : true;
      const res = await queuePreferredCountry(selected);
      const duration_ms = Math.round(performance.now() - t0);
      if (res.synced) {
        const now = new Date();
        setLastSyncedAt(now);
        setLastError(null);
        setSyncStatus("saved");
        void track("sync_pref_save", {
          stage: "success",
          country: selected,
          duration_ms,
          last_synced_at: now.toISOString(),
          retry: isRetry,
        });
        window.setTimeout(() => {
          setModalOpen(false);
          setVisible(false);
        }, 900);
      } else {
        setSyncStatus(online ? "queued" : "offline");
        void track("sync_pref_save", {
          stage: "queued",
          country: selected,
          online,
          duration_ms,
          retry: isRetry,
        });
      }
    } catch (err) {
      const info = classifyError(err);
      setLastError({ ...info, stage: "save", at: new Date() });
      setSyncStatus("error");
      void track("sync_pref_save", {
        stage: "error",
        country: selected,
        duration_ms: Math.round(performance.now() - t0),
        error: info.message,
        error_kind: info.kind,
        error_status: info.status ?? null,
        retry: isRetry,
      });
    }
  };

  const save = async () => {
    saveCountry(selected);
    try { localStorage.setItem(CONFIRMED_KEY, "1"); } catch { /* ignore */ }
    void track("country_confirmed", {
      action: selected === detected ? "confirm" : "switch",
      country: selected,
      from: detected,
      source,
    });

    if (signedIn && (selected === "SAR" || selected === "EGP")) {
      await runSync(false);
      return;
    }

    setModalOpen(false);
    setVisible(false);
  };

  const retrySync = async () => {
    void track("sync_pref_retry", { country: selected, from_status: syncStatus });

    // If there's a pending entry in the offline queue, try draining it first.
    // The queue's flush path already emits its own `pref_sync_flush` analytics;
    // we add a retry-scoped success event here so dashboards can attribute
    // successful drains to the retry button specifically.
    const pending = typeof window !== "undefined" ? getPendingPrefSync() : null;
    if (pending) {
      setSyncStatus("syncing");
      const t0 = performance.now();
      void track("pref_sync_flush", {
        stage: "retry_start",
        country: pending.country,
        reason: "retry_button",
        from_status: syncStatus,
      });
      try {
        await flushPrefSyncQueue("retry_button");
      } catch { /* flush handles its own errors */ }

      const drained = getPendingPrefSync() === null;
      const duration_ms = Math.round(performance.now() - t0);
      if (drained) {
        const now = new Date();
        setLastSyncedAt(now);
        setSyncStatus("saved");
        void track("pref_sync_flush", {
          stage: "retry_success",
          country: pending.country,
          reason: "retry_button",
          duration_ms,
          last_synced_at: now.toISOString(),
        });
        window.setTimeout(() => {
          setModalOpen(false);
          setVisible(false);
        }, 900);
        return;
      }
      void track("pref_sync_flush", {
        stage: "retry_incomplete",
        country: pending.country,
        reason: "retry_button",
        duration_ms,
      });
    }

    // Fallback: re-run the save path (covers no-queue error states).
    void runSync(true);
  };


  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, "1"); } catch { /* ignore */ }
    void track("country_confirmed", { action: "dismiss", country: detected, source });
    setModalOpen(false);
    setVisible(false);
  };

  return (
    <>
      <section
        className="fixed bottom-4 inset-x-4 md:inset-x-auto md:right-6 md:left-auto md:max-w-md z-40 rounded-2xl border border-border bg-white/95 backdrop-blur shadow-xl p-4 animate-in slide-in-from-bottom-4"
        role="region"
        aria-labelledby={titleId}
        aria-describedby={`${descId} ${sourceId}`}
        aria-live="polite"
      >
        <div className="flex items-start gap-3">
          <div className="shrink-0 size-10 rounded-full bg-primary/10 text-primary inline-flex items-center justify-center">
            <MapPin className="size-5" aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 id={titleId} className="text-sm font-bold text-foreground">
              اكتشفنا موقعك: <span aria-hidden="true">{fx.flag}</span> {fx.label}
            </h2>
            <p id={descId} className="text-xs text-muted-foreground mt-0.5">
              سنعرض الأسعار بـ <span className="font-bold text-foreground">{fx.symbol}</span>
            </p>
            <p
              id={sourceId}
              className="mt-2 inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-stone-soft/70 text-[11px] font-bold text-foreground"
            >
              <Radio className="size-3" aria-hidden="true" />
              <span className="sr-only">مصدر الاكتشاف: </span>
              اكتُشف عبر: {sourceShort}
            </p>
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                ref={primaryBtnRef}
                type="button"
                onClick={openModal}
                aria-haspopup="dialog"
                aria-expanded={modalOpen}
                aria-label={`تأكيد أو تغيير العملة الحالية ${fx.label} ${fx.symbol}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Check className="size-3.5" aria-hidden="true" /> تأكيد أو تغيير
              </button>
              <button
                type="button"
                onClick={openModal}
                aria-haspopup="dialog"
                aria-expanded={modalOpen}
                aria-label="عرض تفاصيل كيف تم اكتشاف الدولة"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-11 rounded-full border border-border bg-white text-xs font-bold hover:bg-stone-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              >
                <Info className="size-3.5" aria-hidden="true" /> كيف تم الاكتشاف؟
              </button>
            </div>
            <p className="sr-only">اضغط Escape لإغلاق هذه اللافتة.</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="إغلاق لافتة تأكيد الدولة"
            className="shrink-0 inline-flex items-center justify-center min-h-11 min-w-11 rounded-full hover:bg-stone-soft text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>
      </section>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe2 className="size-5 text-primary" aria-hidden />
              تأكيد الدولة والعملة
            </DialogTitle>
            <DialogDescription>
              اختر العملة التي تريد عرض الأسعار بها. يمكنك تغييرها لاحقاً من أعلى الصفحة.
            </DialogDescription>
          </DialogHeader>

          <div className="rounded-xl border border-border bg-stone-soft/60 p-3 text-xs leading-relaxed">
            <div className="font-bold text-foreground mb-1 flex items-center gap-1.5">
              <Info className="size-3.5" aria-hidden /> كيف اكتشفنا موقعك؟
            </div>
            <div className="text-muted-foreground">
              الاكتشاف الحالي: <span aria-hidden>{fx.flag}</span>{" "}
              <span className="font-bold text-foreground">{fx.label}</span> — المصدر: {sourceLabel}.
              {source === "edge-header"
                ? " نستخدم رأس CDN لتحديد الدولة تقريبياً دون تخزين عنوان IP."
                : " لم نتمكن من قراءة رأس الشبكة، فاعتمدنا على لغة المتصفح."}
            </div>
          </div>

          <div className="mt-2">
            <div className="text-xs font-bold text-foreground mb-2">اختر العملة</div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-64 overflow-y-auto pe-1">
              {sortedCodes.map((code) => {
                const c = FX_VS_SAR[code];
                const isSel = selected === code;
                const isDetected = detected === code;
                return (
                  <button
                    key={code}
                    type="button"
                    onClick={() => setSelected(code)}
                    className={`text-right rounded-xl border p-2.5 transition ${
                      isSel
                        ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                        : "border-border bg-white hover:bg-stone-soft"
                    }`}
                    aria-pressed={isSel}
                  >
                    <div className="flex items-center gap-2">
                      <span aria-hidden className="text-lg">{c.flag}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-foreground truncate">{c.label}</div>
                        <div className="text-[11px] text-muted-foreground">{code} · {c.symbol}</div>
                      </div>
                      {isSel && <Check className="size-4 text-primary shrink-0" aria-hidden />}
                    </div>
                    {isDetected && (
                      <div className="mt-1 text-[10px] text-primary font-bold">مكتشَف تلقائياً</div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sync status with the signed-in user's profile */}
          <div
            className="mt-3 rounded-xl border border-border bg-stone-soft/60 p-2.5 text-[11px] flex items-start gap-2"
            role="status"
            aria-live="polite"
          >
            {syncStatus === "guest" && (
              <>
                <CloudOff className="size-4 text-muted-foreground shrink-0" aria-hidden />
                <span className="text-muted-foreground">
                  لست مسجلاً الدخول — سيتم حفظ التفضيل على هذا الجهاز فقط.
                </span>
              </>
            )}
            {syncStatus === "syncing" && (
              <>
                <Loader2 className="size-4 text-primary animate-spin shrink-0" aria-hidden />
                <span className="text-foreground font-bold">جاري المزامنة مع حسابك…</span>
              </>
            )}
            {syncStatus === "saved" && (
              <>
                <Cloud className="size-4 text-emerald-600 shrink-0" aria-hidden />
                <span className="text-foreground">
                  <span className="font-bold text-emerald-700">تمّت المزامنة بنجاح</span>
                  {lastSyncedAt && (
                    <>
                      {" "}· آخر مزامنة:{" "}
                      <time dateTime={lastSyncedAt.toISOString()} className="font-bold">
                        {lastSyncedAt.toLocaleTimeString("ar", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </time>
                    </>
                  )}
                </span>
              </>
            )}
            {syncStatus === "error" && (
              <>
                <CloudOff className="size-4 text-red-600 shrink-0 mt-0.5" aria-hidden />
                <div className="flex-1 min-w-0">
                  <div className="text-red-700 font-bold">
                    تعذّر حفظ التفضيل في حسابك — تم الحفظ على الجهاز فقط.
                  </div>
                  {lastError && (
                    <div className="mt-1 text-[11px] text-red-700/90 leading-relaxed">
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-800 font-bold me-1">
                        {lastError.kind === "network"
                          ? "خطأ شبكة"
                          : lastError.kind === "server"
                          ? `خطأ الخادم${lastError.status ? ` (${lastError.status})` : ""}`
                          : "خطأ غير معروف"}
                      </span>
                      <span>{lastError.message}</span>
                      <span className="block text-red-700/70 mt-0.5">
                        وقت الفشل:{" "}
                        <time dateTime={lastError.at.toISOString()}>
                          {lastError.at.toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}
                        </time>
                        {" · "}المرحلة: {lastError.stage === "fetch" ? "قراءة التفضيل" : "حفظ التفضيل"}
                      </span>
                    </div>
                  )}
                </div>
              </>
            )}
            {syncStatus === "offline" && (
              <>
                <CloudOff className="size-4 text-amber-600 shrink-0" aria-hidden />
                <span className="text-amber-700 font-bold">
                  لا يوجد اتصال بالإنترنت — تم الحفظ محلياً وسيُزامَن تلقائياً عند عودة الاتصال.
                </span>
              </>
            )}
            {syncStatus === "queued" && (
              <>
                <Loader2 className="size-4 text-amber-600 animate-spin shrink-0" aria-hidden />
                <span className="text-amber-700 font-bold">
                  في طابور المزامنة — ستُعاد المحاولة تلقائياً.
                </span>
              </>
            )}
            {syncStatus === "idle" && (
              <>
                <Cloud className="size-4 text-muted-foreground shrink-0" aria-hidden />
                <span className="text-muted-foreground">جاهز للمزامنة عند الحفظ.</span>
              </>
            )}
          </div>

          {pendingEntry && (syncStatus === "queued" || syncStatus === "offline" || syncStatus === "error" || syncStatus === "syncing") && (() => {
            const attempts = pendingEntry.attempts;
            const max = MAX_PREF_SYNC_ATTEMPTS;
            // Capture / refresh the monotonic anchor whenever nextRetryAt
            // changes. From then on, remaining = anchorRemaining - perfDelta,
            // so device-clock changes cannot skew the countdown.
            const key = pendingEntry.nextRetryAt ?? "";
            if (key) {
              if (!anchorRef.current || anchorRef.current.key !== key) {
                anchorRef.current = {
                  key,
                  anchorPerf: perfNow(),
                  remainingAtAnchor: new Date(key).getTime() - Date.now(),
                };
              }
            } else if (anchorRef.current) {
              anchorRef.current = null;
            }
            const nextMs = anchorRef.current
              ? anchorRef.current.remainingAtAnchor - (tickPerf - anchorRef.current.anchorPerf)
              : null;
            const secs = nextMs !== null ? Math.max(0, Math.ceil(nextMs / 1000)) : null;
            const countdown = formatArabicCountdown(secs);
            const exhausted = attempts >= max && !pendingEntry.nextRetryAt;
            return (
              <div
                className="mt-2 rounded-xl border border-amber-200 bg-amber-50/70 p-2.5 text-[11px] leading-relaxed"
                role="status"
                aria-live="polite"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-amber-900">
                    <span className="font-bold">المحاولات:</span>{" "}
                    <span className="tabular-nums">{attempts}</span>
                    <span className="text-amber-700"> / {max}</span>
                  </div>
                  {countdown && !exhausted && (
                    <div className="text-amber-900">
                      <span className="font-bold">الإعادة القادمة خلال:</span>{" "}
                      <span className="tabular-nums font-bold">{countdown}</span>
                    </div>
                  )}
                </div>
                {exhausted && (
                  <div className="mt-1 text-amber-800">
                    استنفدت المحاولات التلقائية — لم يعد بالإمكان إعادة المحاولة تلقائياً.
                  </div>
                )}
                {!exhausted && pendingEntry.nextRetryAt && (
                  <div className="mt-1 text-amber-800/90">
                    وقت الإعادة القادمة:{" "}
                    <time dateTime={pendingEntry.nextRetryAt} className="font-bold">
                      {new Date(pendingEntry.nextRetryAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                    </time>
                  </div>
                )}
              </div>
            );
          })()}


          {(syncStatus === "error" || syncStatus === "queued" || syncStatus === "offline") && (() => {
            const retryExhausted = !!pendingEntry && pendingEntry.attempts >= MAX_PREF_SYNC_ATTEMPTS && !pendingEntry.nextRetryAt;
            return (
              <div className="mt-2 flex justify-end">
                <button
                  type="button"
                  onClick={retrySync}
                  disabled={retryExhausted}
                  aria-disabled={retryExhausted}
                  aria-label={retryExhausted ? "استنفدت محاولات إعادة المزامنة التلقائية" : "إعادة محاولة مزامنة تفضيل العملة مع حسابي"}
                  title={retryExhausted ? "استنفدت المحاولات التلقائية (5/5)" : undefined}
                  data-retry-exhausted={retryExhausted ? "true" : "false"}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-9 rounded-full border border-border bg-white text-[11px] font-bold hover:bg-stone-soft transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-white"
                >
                  <RefreshCw className="size-3.5" aria-hidden />
                  إعادة المحاولة
                </button>
              </div>
            );
          })()}




          <DialogFooter className="gap-2 sm:gap-2">
            <button
              type="button"
              onClick={dismiss}
              className="inline-flex items-center justify-center px-4 py-2 rounded-full border border-border bg-white text-xs font-bold hover:bg-stone-soft transition"
            >
              ليس الآن
            </button>
            <button
              type="button"
              onClick={save}
              className="inline-flex items-center gap-1.5 justify-center px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-bold hover:opacity-90 transition"
            >
              <Check className="size-3.5" aria-hidden />
              حفظ ({selFx.symbol} {selFx.label})
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
