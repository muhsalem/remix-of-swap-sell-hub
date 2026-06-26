import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-background mt-16">
      <div className="max-w-7xl mx-auto px-6 py-10 grid sm:grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div>
          <h3 className="font-bold mb-3">المنصة</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/about" className="hover:text-primary">من نحن</Link></li>
            <li><Link to="/sharia-committee" className="hover:text-primary">الهيئة الشرعية</Link></li>
            <li><Link to="/pricing-engine" className="hover:text-primary">محرك التسعير</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold mb-3">المساعدة</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/legal/$doc" params={{ doc: "sla" }} className="hover:text-primary">اتفاقية مستوى الخدمة</Link></li>
            <li><Link to="/legal/$doc" params={{ doc: "terms" }} className="hover:text-primary">الشروط والأحكام</Link></li>
            <li><Link to="/legal/$doc" params={{ doc: "privacy" }} className="hover:text-primary">سياسة الخصوصية</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold mb-3">للمستخدم</h3>
          <ul className="space-y-2 text-muted-foreground">
            <li><Link to="/new-listing" className="hover:text-primary">إضافة عرض</Link></li>
            <li><Link to="/" hash="how" className="hover:text-primary">كيف تعمل المنصة؟</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="font-bold mb-3">بدِّل</h3>
          <p className="text-muted-foreground leading-relaxed">
            منصة مقايضة ذكية متوافقة شرعياً. بدّل ما تملكه بما تحتاجه — دون ربا ودون هدر.
          </p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} بدِّل. جميع الحقوق محفوظة.
      </div>
    </footer>
  );
}
