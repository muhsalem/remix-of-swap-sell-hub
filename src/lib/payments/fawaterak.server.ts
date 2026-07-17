// Fawaterak (فواتيرك) — server-only helpers.
// Reads FAWATERAK_API_KEY + FAWATERAK_VENDOR_KEY + FAWATERAK_MODE (sandbox|live)
// from environment. Never import this from client code.

import { createHmac, timingSafeEqual } from "node:crypto";

const LIVE_BASE = "https://app.fawaterk.com/api/v2";
const SANDBOX_BASE = "https://staging.fawaterk.com/api/v2";

function baseUrl(): string {
  return (process.env.FAWATERAK_MODE ?? "live") === "sandbox" ? SANDBOX_BASE : LIVE_BASE;
}

export interface FawaterakCustomer {
  first_name: string;
  last_name?: string;
  email: string;
  phone?: string;
  address?: string;
}

export interface CreateInvoiceInput {
  paymentId: string;              // our internal payments.id (used as invoiceNumber)
  amount: number;                 // in currency units (e.g. 50.00)
  currency: "SAR" | "EGP" | "USD" | "AED";
  itemName: string;               // Arabic label describing what's being paid for
  customer: FawaterakCustomer;
  successUrl: string;
  failUrl: string;
  pendingUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface CreateInvoiceResult {
  invoiceId: string;
  invoiceKey: string;
  url: string;
  raw: unknown;
}

/**
 * Creates a hosted-checkout invoice link on Fawaterak.
 * Throws with the provider error body on non-2xx so callers can surface it.
 */
export async function createFawaterakInvoice(
  input: CreateInvoiceInput,
): Promise<CreateInvoiceResult> {
  const apiKey = process.env.FAWATERAK_API_KEY;
  if (!apiKey) throw new Error("FAWATERAK_API_KEY is not configured");

  const body = {
    cartTotal: input.amount.toFixed(2),
    currency: input.currency,
    invoiceNumber: input.paymentId,
    customer: input.customer,
    redirectionUrls: {
      successUrl: input.successUrl,
      failUrl: input.failUrl,
      pendingUrl: input.pendingUrl ?? input.successUrl,
    },
    cartItems: [
      {
        name: input.itemName,
        price: input.amount.toFixed(2),
        quantity: "1",
      },
    ],
    payLoad: { paymentId: input.paymentId, ...(input.metadata ?? {}) },
    sendEmail: false,
  };

  const res = await fetch(`${baseUrl()}/createInvoiceLink`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Fawaterak createInvoiceLink failed [${res.status}]: ${text}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`Fawaterak returned non-JSON body: ${text.slice(0, 300)}`);
  }

  const root = parsed as { status?: string; data?: Record<string, unknown> };
  if (root.status && root.status !== "success") {
    throw new Error(`Fawaterak error body: ${text.slice(0, 500)}`);
  }
  const data = root.data ?? (parsed as Record<string, unknown>);
  const invoiceId = String(data.invoiceId ?? data.invoice_id ?? "");
  const invoiceKey = String(data.invoiceKey ?? data.invoice_key ?? "");
  const url = String(data.url ?? data.paymentUrl ?? data.checkoutUrl ?? "");
  if (!url) throw new Error(`Fawaterak response missing checkout URL: ${text.slice(0, 300)}`);

  return { invoiceId, invoiceKey, url, raw: parsed };
}

/**
 * Verifies the Fawaterak webhook signature.
 * Fawaterak sends an X-Hash header = HMAC_SHA256(rawBody, VENDOR_KEY) in hex.
 * Returns true when the signature matches; false otherwise.
 */
export function verifyFawaterakHash(rawBody: string, signature: string | null): boolean {
  const vendorKey = process.env.FAWATERAK_VENDOR_KEY;
  if (!vendorKey || !signature) return false;
  const expected = createHmac("sha256", vendorKey).update(rawBody).digest("hex");
  const a = Buffer.from(signature.trim().toLowerCase(), "utf8");
  const b = Buffer.from(expected.toLowerCase(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Maps Fawaterak invoice status text → our internal payment_status enum. */
export function mapFawaterakStatus(s: string | undefined | null):
  | "pending"
  | "paid"
  | "failed"
  | "expired" {
  const v = (s ?? "").toLowerCase();
  if (["paid", "success", "successful", "completed"].includes(v)) return "paid";
  if (["failed", "fail", "declined", "cancelled", "canceled"].includes(v)) return "failed";
  if (["expired", "timeout"].includes(v)) return "expired";
  return "pending";
}
