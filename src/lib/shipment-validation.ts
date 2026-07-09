/**
 * Pure validation for the shipping form (ShipmentPanel).
 * Kept framework-free so it can be exercised by vitest without a DOM.
 */

export type ShipmentCity = {
  code: string;
  name_ar: string;
  region_ar: string;
  country: string; // "SA" | "EG"
};

export type ShipmentIssueCode =
  | "no_from"
  | "no_to"
  | "bad_from"
  | "bad_to"
  | "cross_border"
  | "bad_weight"
  | "bad_value"
  | "same_city";

export type ShipmentIssue = {
  code: ShipmentIssueCode;
  msg: string;
  suggest?: { code: string; name_ar: string; region_ar: string }[];
};

export type ShipmentValidationInput = {
  from: string;
  to: string;
  weight: number;
  declared: number;
  cities: ShipmentCity[];
};

export type ShipmentValidationResult = {
  issue: ShipmentIssue | null;
  /** Safe to enable the "احسب سعر الشحن" button. */
  canCalculate: boolean;
  fromCity: ShipmentCity | undefined;
  toCity: ShipmentCity | undefined;
};

export const WEIGHT_MAX_KG = 200;
export const DECLARED_MAX_SAR = 500_000;

export function validateShipmentInput({
  from,
  to,
  weight,
  declared,
  cities,
}: ShipmentValidationInput): ShipmentValidationResult {
  const fromCity = cities.find((c) => c.code === from);
  const toCity = cities.find((c) => c.code === to);

  let issue: ShipmentIssue | null = null;

  if (!from) {
    issue = { code: "no_from", msg: "اختر مدينة المنشأ." };
  } else if (!fromCity) {
    issue = { code: "bad_from", msg: `الرمز "${from}" غير مدعوم — اختر من القائمة.` };
  } else if (!to) {
    issue = { code: "no_to", msg: "اختر مدينة الوجهة." };
  } else if (!toCity) {
    issue = { code: "bad_to", msg: `الرمز "${to}" غير مدعوم — اختر من القائمة.` };
  } else if (fromCity.country !== toCity.country) {
    const same = cities
      .filter((c) => c.country === fromCity.country && c.code !== fromCity.code)
      .sort((a, b) => (a.region_ar === fromCity.region_ar ? -1 : 1))
      .slice(0, 4)
      .map((c) => ({ code: c.code, name_ar: c.name_ar, region_ar: c.region_ar }));
    issue = {
      code: "cross_border",
      msg: `الشحن الدولي غير مفعّل. المنشأ في ${
        fromCity.country === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"
      } والوجهة في ${
        toCity.country === "SA" ? "🇸🇦 السعودية" : "🇪🇬 مصر"
      }. اختر وجهة داخل نفس البلد:`,
      suggest: same,
    };
  } else if (from === to) {
    issue = {
      code: "same_city",
      msg: "مدينة المنشأ والوجهة متطابقتان — اختر وجهة مختلفة.",
    };
  } else if (!Number.isFinite(weight) || weight <= 0) {
    issue = { code: "bad_weight", msg: "الوزن يجب أن يكون أكبر من صفر." };
  } else if (weight > WEIGHT_MAX_KG) {
    issue = { code: "bad_weight", msg: `الحد الأقصى للوزن ${WEIGHT_MAX_KG} كجم.` };
  } else if (!Number.isFinite(declared) || declared < 0) {
    issue = { code: "bad_value", msg: "القيمة المُعلنة يجب ألا تقل عن صفر." };
  } else if (declared > DECLARED_MAX_SAR) {
    issue = {
      code: "bad_value",
      msg: `الحد الأقصى للقيمة المُعلنة ${DECLARED_MAX_SAR.toLocaleString()} ر.س.`,
    };
  }

  return {
    issue,
    canCalculate: issue === null,
    fromCity,
    toCity,
  };
}
