import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth, signOut } from "@/lib/auth";
import { LogOut, Plus, User, Inbox, Wallet, History, ShieldAlert, ChevronDown, UserCircle } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { checkIsAdmin } from "@/lib/admin.functions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ACCOUNT_PATHS = ["/offers", "/my-listings", "/transactions", "/profile"];

export function Nav() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const checkAdmin = useServerFn(checkIsAdmin);
  const { data: adminData } = useQuery({
    queryKey: ["is-admin", user?.id],
    queryFn: () => checkAdmin(),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });
  const isAdmin = adminData?.isAdmin ?? false;
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const accountActive = ACCOUNT_PATHS.some((p) => pathname.startsWith(p));



  return (
    <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/" className="font-display text-2xl font-extrabold tracking-tighter text-primary">
            بادل <span className="text-foreground">بادل</span>
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
              <DropdownMenu>
                <DropdownMenuTrigger
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium transition-colors outline-none ${
                    accountActive ? "bg-stone-soft text-primary" : "hover:bg-stone-soft"
                  }`}
                >
                  <UserCircle className="size-4" />
                  حسابي
                  <ChevronDown className="size-3.5 opacity-60" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuLabel className="text-xs text-muted-foreground">
                    {user.email ?? "حسابي"}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/offers" className="flex items-center gap-2 cursor-pointer">
                      <Inbox className="size-4" /> الصندوق
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/my-listings" className="flex items-center gap-2 cursor-pointer">
                      <User className="size-4" /> عروضي
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/transactions" className="flex items-center gap-2 cursor-pointer">
                      <History className="size-4" /> السجل
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/profile" className="flex items-center gap-2 cursor-pointer">
                      <Wallet className="size-4" /> محفظتي
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={async () => { await signOut(); navigate({ to: "/" }); }}
                    className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
                  >
                    <LogOut className="size-4" /> تسجيل الخروج
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {isAdmin && (
                <Link
                  to="/admin/disputes"
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-destructive/10 text-destructive hover:bg-destructive/20"
                  title="لوحة المشرف"
                >
                  <ShieldAlert className="size-4" />
                </Link>
              )}
              <NotificationBell />
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
