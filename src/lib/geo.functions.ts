import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

/**
 * Detect the visitor's country from edge headers (Cloudflare / Vercel / generic).
 * Launch scope: Saudi Arabia + Egypt. Everything else → SAR default.
 * Returns { country: "SAR" | "EGP", iso: string, source: string }.
 */
export const detectCountryServer = createServerFn({ method: "GET" }).handler(async () => {
  const iso = (
    getRequestHeader("cf-ipcountry") ||
    getRequestHeader("x-vercel-ip-country") ||
    getRequestHeader("x-country") ||
    ""
  ).toUpperCase();

  let country: "SAR" | "EGP" = "SAR";
  if (iso === "EG") country = "EGP";
  else if (iso === "SA") country = "SAR";

  return { country, iso, source: iso ? "edge-header" : "default" };
});
