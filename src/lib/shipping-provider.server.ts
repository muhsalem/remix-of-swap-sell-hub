/* Real shipping-provider adapters (server-only).
 * Bosta (Egypt) and SMSA Express (Saudi Arabia) are used when their API keys
 * are configured; otherwise the BadelShip sandbox provider is used.  */

export type ProviderEvent = {
  status: string;
  description: string;
  location: string;
  event_at: string;
};

export type CreateShipmentParams = {
  country: "SA" | "EG";
  fromCity: string;
  toCity: string;
  weightKg: number;
  declaredValueSar: number;
  reference: string;
};

export type ShippingAdapter = {
  name: string;
  live: boolean;
  createShipment(p: CreateShipmentParams): Promise<{ tracking_number: string; expected_delivery?: string | null }>;
  fetchEvents(tracking: string): Promise<ProviderEvent[] | null>;
};

/** Normalize any provider state string into our internal status vocabulary. */
export function normalizeStatus(raw: string): string {
  const s = (raw || "").toLowerCase();
  if (/deliver(ed)?$|تم التسليم/.test(s)) return "delivered";
  if (/out[_ -]?for[_ -]?delivery|خرجت/.test(s)) return "out_for_delivery";
  if (/picked|pickup|استلام/.test(s)) return "picked_up";
  if (/transit|route|طريق/.test(s)) return "in_transit_out";
  if (/sorting|hub|warehouse|فرز/.test(s)) return "in_transit";
  if (/created|new|pending|إنشاء/.test(s)) return "created";
  return "in_transit";
}

function genTracking(country: "SA" | "EG") {
  const prefix = country === "SA" ? "BSA" : "BEG";
  const n = Math.floor(Math.random() * 9_000_000_000) + 1_000_000_000;
  return `${prefix}${n}`;
}

const sandbox: ShippingAdapter = {
  name: "BadelShip Sandbox",
  live: false,
  async createShipment(p) {
    return { tracking_number: genTracking(p.country) };
  },
  async fetchEvents() {
    return null; // caller falls back to deterministic synthetic events
  },
};

/* ------------------------------- Bosta (EG) ------------------------------ */
function bostaAdapter(apiKey: string): ShippingAdapter {
  const base = process.env["BOSTA_BASE_URL"] || "https://app.bosta.co/api/v2";
  const headers = { Authorization: apiKey, "Content-Type": "application/json" };
  return {
    name: "Bosta",
    live: true,
    async createShipment(p) {
      const res = await fetch(`${base}/deliveries`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          type: 10,
          specs: { packageDetails: { itemsCount: 1, description: p.reference }, weight: p.weightKg },
          cod: 0,
          dropOffAddress: { city: p.toCity, firstLine: p.toCity },
          pickupAddress: { city: p.fromCity, firstLine: p.fromCity },
          businessReference: p.reference,
        }),
      });
      if (!res.ok) throw new Error(`Bosta: ${res.status} ${await res.text()}`);
      const j: any = await res.json();
      const t = j?.data?.trackingNumber ?? j?.trackingNumber;
      if (!t) throw new Error("Bosta: لم يُرجِع المزوّد رقم تتبع");
      return { tracking_number: String(t), expected_delivery: j?.data?.promisedDate ?? null };
    },
    async fetchEvents(tracking) {
      const res = await fetch(`${base}/deliveries/business/${encodeURIComponent(tracking)}`, { headers });
      if (!res.ok) return null;
      const j: any = await res.json();
      const logs: any[] = j?.data?.transitEvents ?? j?.data?.timeline ?? [];
      if (!Array.isArray(logs) || logs.length === 0) return null;
      return logs.map((e) => ({
        status: normalizeStatus(e.state ?? e.value ?? ""),
        description: e.reason || e.state || e.value || "تحديث من المزوّد",
        location: e.hub?.name ?? e.city ?? "—",
        event_at: new Date(e.timestamp ?? e.time ?? Date.now()).toISOString(),
      }));
    },
  };
}

/* ------------------------------- SMSA (SA) ------------------------------- */
function smsaAdapter(apiKey: string): ShippingAdapter {
  const base = process.env["SMSA_BASE_URL"] || "https://ecomapis.smsaexpress.com/api";
  const headers = { apikey: apiKey, "Content-Type": "application/json" };
  return {
    name: "SMSA Express",
    live: true,
    async createShipment(p) {
      const res = await fetch(`${base}/shipment/b2c/new`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          ConsigneeAddress: { ContactName: "Badel Recipient", City: p.toCity, Country: "SA" },
          ShipperAddress: { ContactName: "Badel Sender", City: p.fromCity, Country: "SA" },
          OrderNumber: p.reference,
          DeclaredValue: p.declaredValueSar,
          Parcels: 1,
          Weight: p.weightKg,
          ContentDescription: p.reference,
        }),
      });
      if (!res.ok) throw new Error(`SMSA: ${res.status} ${await res.text()}`);
      const j: any = await res.json();
      const t = j?.sawb ?? j?.awbNumber ?? j?.trackingNumber;
      if (!t) throw new Error("SMSA: لم يُرجِع المزوّد رقم تتبع");
      return { tracking_number: String(t) };
    },
    async fetchEvents(tracking) {
      const res = await fetch(`${base}/shipment/b2c/track/${encodeURIComponent(tracking)}`, { headers });
      if (!res.ok) return null;
      const j: any = await res.json();
      const logs: any[] = j?.Waybills?.[0]?.Scans ?? j?.scans ?? [];
      if (!Array.isArray(logs) || logs.length === 0) return null;
      return logs.map((e) => ({
        status: normalizeStatus(e.Activity ?? e.status ?? ""),
        description: e.Activity ?? e.description ?? "تحديث من المزوّد",
        location: e.Location ?? e.city ?? "—",
        event_at: new Date(e.DateTime ?? e.date ?? Date.now()).toISOString(),
      }));
    },
  };
}

export function getShippingAdapter(country: "SA" | "EG"): ShippingAdapter {
  if (country === "EG") {
    const k = process.env["BOSTA_API_KEY"];
    if (k) return bostaAdapter(k);
  } else {
    const k = process.env["SMSA_API_KEY"];
    if (k) return smsaAdapter(k);
  }
  return sandbox;
}
