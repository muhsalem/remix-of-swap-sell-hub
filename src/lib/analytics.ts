// Lightweight, privacy-preserving analytics client.
// Fires directly against public.analytics_events (INSERT-only for anon).
import { supabase } from "@/integrations/supabase/client";

const SESSION_KEY = "bd_sid";

function sid(): string {
  if (typeof window === "undefined") return "ssr";
  let s = sessionStorage.getItem(SESSION_KEY);
  if (!s) {
    s = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(SESSION_KEY, s);
  }
  return s;
}

function device(): string {
  if (typeof navigator === "undefined") return "ssr";
  const ua = navigator.userAgent.toLowerCase();
  if (/mobi|android|iphone/.test(ua)) return "mobile";
  if (/tablet|ipad/.test(ua)) return "tablet";
  return "desktop";
}

export async function track(event_name: string, meta: Record<string, unknown> = {}) {
  if (typeof window === "undefined") return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("analytics_events").insert({
      event_name: event_name.slice(0, 60),
      path: window.location.pathname + window.location.search,
      referrer: document.referrer || null,
      user_id: user?.id ?? null,
      session_id: sid(),
      device: device(),
      meta: meta as never,
    } as never);
  } catch {
    // fail silently — analytics must never break the app
  }
}

export function trackPageview(path: string) {
  return track("pageview", { path });
}
