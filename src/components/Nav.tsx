import { Link, useNavigate } from "@tanstack/react-router";
import { useAuth, signOut } from "@/lib/auth";
import { LogOut, Plus, User, Inbox, Wallet, History } from "lucide-react";

export function Nav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-display text-2xl font-extrabold tracking-tighter text-primary">
            إيكال <span className="text-foreground">EQAL</span>
          </Link>
          <div className="hidden md:flex gap-6 text-sm font-medium">
            <Link to="/" hash="engine" className="hover:text-primary transition-colors">المقايضة</Link>
            <Link to="/" hash="market" className="hover:text-primary transition-colors">السوق</Link>
            <Link to="/" hash="how" className="hover:text-primary transition-colors">كيف يعمل؟</Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {loading ? null : user ? (
            <>
              <Link
                to="/new-listing"
                className="hidden sm:inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all"
              >
                <Plus className="size-4" /> أضف عرضاً
              </Link>
              <Link
                to="/offers"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium hover:bg-stone-soft"
              >
                <Inbox className="size-4" /> الصندوق
              </Link>
              <Link
                to="/my-listings"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium hover:bg-stone-soft"
              >
                <User className="size-4" /> عروضي
              </Link>
              <Link
                to="/transactions"
                className="hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium hover:bg-stone-soft"
              >
                <History className="size-4" /> السجل
              </Link>
              <Link
                to="/profile"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium hover:bg-stone-soft"
              >
                <Wallet className="size-4" /> محفظتي
              </Link>
              <button
                onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                title="تسجيل الخروج"
                className="p-2 rounded-full hover:bg-stone-soft"
              >
                <LogOut className="size-4" />
              </button>
            </>
          ) : (
            <Link
              to="/auth"
              className="px-5 py-2 bg-foreground text-background rounded-full text-sm font-bold hover:bg-primary transition-all"
            >
              ابدأ الآن
            </Link>
          )}
        </div>
      </div>
    </nav>
  );
}
