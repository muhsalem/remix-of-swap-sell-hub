import { uploadListingImage } from "@/lib/storage";
import { computeImageSignature } from "@/lib/image-hash";
import { adminSeedDemoListings } from "@/lib/listings-admin.functions";

import phoneImg from "@/assets/product-phone.jpg";
import headphonesImg from "@/assets/product-headphones.jpg";
import cameraImg from "@/assets/product-camera.jpg";
import scooterImg from "@/assets/product-scooter.jpg";
import watchImg from "@/assets/product-watch.jpg";
import keyboardImg from "@/assets/product-keyboard.jpg";

export type DemoListingSeed = {
  title: string;
  description: string;
  category: string;
  condition: "new" | "like-new" | "excellent" | "good" | "fair";
  age_months: number;
  market_price: number;
  wants: string;
  city: string;
  listing_type: "item" | "service";
  imageAsset: string;
};

export const DEMO_LISTINGS: DemoListingSeed[] = [
  {
    title: "آيفون 14 برو 256 جيجا",
    description:
      "جهاز بحالة ممتازة، بطارية 94%، مع شاحن أصلي وعلبة. لا يوجد خدوش على الشاشة، تم استخدامه بحماية زجاجية طوال الفترة.",
    category: "phones",
    condition: "excellent",
    age_months: 18,
    market_price: 3200,
    wants: "لابتوب أو كاش",
    city: "الرياض",
    listing_type: "item",
    imageAsset: phoneImg,
  },
  {
    title: "سماعات Sony WH-1000XM5",
    description:
      "سماعات لاسلكية بخاصية إلغاء الضجيج، شبه جديدة، استخدام خفيف لمدة 6 شهور فقط. مع الكرتون والكابلات.",
    category: "electronics",
    condition: "like-new",
    age_months: 6,
    market_price: 950,
    wants: "سماعات airpods pro أو ساعة ذكية",
    city: "الرياض",
    listing_type: "item",
    imageAsset: headphonesImg,
  },
  {
    title: "كاميرا Canon EOS R8 مع عدسة 24-50",
    description:
      "كاميرا فول فريم خفيفة الوزن، عدد نقرات منخفض، مع شاحن وبطارية إضافية. حالة ممتازة.",
    category: "electronics",
    condition: "excellent",
    age_months: 12,
    market_price: 4300,
    wants: "آيفون 15 أو مبالغ نقدية",
    city: "جدة",
    listing_type: "item",
    imageAsset: cameraImg,
  },
  {
    title: "سكوتر كهربائي قابل للطي",
    description:
      "سكوتر كهربائي بمدى 25 كم، سرعة 25 كم/س، تم صيانته مؤخرًا. حالة جيدة ومناسب للتنقل اليومي.",
    category: "vehicles",
    condition: "good",
    age_months: 24,
    market_price: 1150,
    wants: "دراجة هوائية أو كاش",
    city: "جدة",
    listing_type: "item",
    imageAsset: scooterImg,
  },
  {
    title: "ساعة Apple Watch Series 9 45mm",
    description:
      "ساعة ذكية بلون منتصف الليل، شبه جديدة، مع سوار إضافي. بطارية تكفي ليوم كامل بسهولة.",
    category: "electronics",
    condition: "like-new",
    age_months: 8,
    market_price: 650,
    wants: "سماعات احترافية أو كاش",
    city: "الدمام",
    listing_type: "item",
    imageAsset: watchImg,
  },
  {
    title: "كيبورد ميكانيكي Keychron K2",
    description:
      "كيبورد ميكانيكي لاسلكي، مفاتيح بنفضة حمراء، إضاءة خلفية RGB، حالة ممتازة ونظيف جدًا.",
    category: "electronics",
    condition: "excellent",
    age_months: 10,
    market_price: 320,
    wants: "ماوس ألعاب أو كاش",
    city: "الدمام",
    listing_type: "item",
    imageAsset: keyboardImg,
  },
];

export async function seedDemoListings(userId: string, progress?: (msg: string) => void) {
  const listings: {
    title: string;
    description: string;
    category: string;
    condition: string;
    age_months: number;
    area_sqm: number | undefined;
    market_price: number;
    wants: string;
    city: string;
    listing_type: "item" | "service";
    image: string;
    image_hashes: string[];
    image_signatures: { phash: string; csig?: string; esig?: string }[];
  }[] = [];

  for (const seed of DEMO_LISTINGS) {
    progress?.(`جارٍ رفع صورة ${seed.title}…`);
    const res = await fetch(seed.imageAsset);
    const blob = await res.blob();
    const file = new File([blob], `${seed.category}.jpg`, { type: "image/jpeg" });
    const path = await uploadListingImage(file, userId);
    const sig = await computeImageSignature(file);

    listings.push({
      title: seed.title,
      description: seed.description,
      category: seed.category,
      condition: seed.condition,
      age_months: seed.age_months,
      area_sqm: undefined,
      market_price: seed.market_price,
      wants: seed.wants,
      city: seed.city,
      listing_type: seed.listing_type,
      image: path,
      image_hashes: sig ? [sig.phash] : [],
      image_signatures: sig ? [sig] : [],
    });
  }

  progress?.("جارٍ إنشاء الإعلانات…");
  return adminSeedDemoListings({ data: { listings } });
}
