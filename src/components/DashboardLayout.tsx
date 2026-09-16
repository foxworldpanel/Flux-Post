import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  History,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  Music,
  Search,
  Users,
  Video,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { ModeToggle } from "./mode-toggle";

const navItems = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/" },
  { label: "Campanhas", icon: Megaphone, href: "/campanha" },
  { label: "Artistas", icon: Users, href: "/artistas" },
  { label: "Músicas", icon: Music, href: "/musicas" },
  { label: "Garimpo", icon: Search, href: "/garimpo" },
  { label: "Biblioteca", icon: Video, href: "/biblioteca" },
  { label: "Redes Sociais", icon: Users, href: "/accounts" },
  { label: "Publicações", icon: History, href: "/publicacoes" },
  { label: "Analytics", icon: BarChart3, href: "/analytics" },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (isMobile) setIsSidebarOpen(false);
  }, [isMobile, location.pathname]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth", { replace: true });
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background text-foreground">
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          Carregando...
        </div>
      </div>
    );
  }

  const desktopWidth = isSidebarOpen ? "md:w-[236px]" : "md:w-[76px]";
  const desktopMargin = isSidebarOpen ? "md:ml-[236px]" : "md:ml-[76px]";

  return (
    <div className="flex h-screen overflow-hidden bg-transparent text-foreground">
      {isMobile && isSidebarOpen && (
        <button
          type="button"
          aria-label="Fechar menu"
          className="fixed inset-0 z-40 bg-black/55 backdrop-blur-sm md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] text-[var(--sidebar-foreground)] backdrop-blur-2xl transition-all duration-300",
          desktopWidth,
          isMobile && !isSidebarOpen && "-translate-x-full",
        )}
      >
        <div className="flex h-[72px] shrink-0 items-center justify-between px-4">
          <Link to="/" className="flex min-w-0 items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 shadow-lg shadow-purple-950/20">
              <span className="text-base font-black text-white">F</span>
            </div>
            {isSidebarOpen && (
              <div className="min-w-0 leading-none">
                <span className="block truncate font-display text-[17px] font-bold tracking-[-0.04em]">
                  FLUX POST
                </span>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                  Social Studio
                </span>
              </div>
            )}
          </Link>

          {isMobile ? (
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(false)}>
              <X size={18} />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen((open) => !open)}
              className="h-8 w-8 shrink-0 text-muted-foreground"
              aria-label={isSidebarOpen ? "Recolher menu" : "Expandir menu"}
            >
              {isSidebarOpen ? <ChevronLeft size={17} /> : <ChevronRight size={17} />}
            </Button>
          )}
        </div>

        <nav className="scrollbar-none flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-3">
          {isSidebarOpen && <p className="eyebrow px-3 pb-2 pt-1">Workspace</p>}
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                title={!isSidebarOpen ? item.label : undefined}
                className={cn(
                  "group relative flex h-11 items-center gap-3 rounded-full px-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-[var(--surface-hover)] hover:text-foreground",
                  !isSidebarOpen && "justify-center px-0",
                )}
              >
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.3 : 1.8}
                  className={cn(
                    "shrink-0 transition-colors",
                    isActive ? "text-primary" : "group-hover:text-foreground",
                  )}
                />
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
                {isActive && (
                  <span className="absolute right-3 h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="shrink-0 border-t border-[var(--sidebar-border)] p-3">
          <div
            className={cn(
              "mb-1 flex items-center rounded-full bg-[var(--surface-hover)] p-1",
              isSidebarOpen ? "justify-between pl-3" : "justify-center",
            )}
          >
            {isSidebarOpen && <span className="text-xs text-muted-foreground">Aparência</span>}
            <ModeToggle />
          </div>
          <Button
            variant="ghost"
            className={cn(
              "h-11 w-full gap-3 text-muted-foreground hover:text-foreground",
              isSidebarOpen ? "justify-start px-3" : "justify-center px-0",
            )}
            onClick={handleLogout}
            title={!isSidebarOpen ? "Sair" : undefined}
          >
            <LogOut size={18} className="shrink-0" />
            {isSidebarOpen && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      <main
        className={cn(
          "h-screen min-w-0 flex-1 overflow-y-auto transition-all duration-300",
          desktopMargin,
        )}
      >
        <div className="sticky top-0 z-30 flex h-14 items-center border-b border-border/60 bg-background/75 px-4 backdrop-blur-xl md:hidden">
          <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(true)}>
            <Menu size={20} />
          </Button>
          <span className="ml-3 font-display text-sm font-bold tracking-tight">FLUX POST</span>
        </div>
        <div className="mx-auto min-h-full w-full max-w-[1600px]">{children}</div>
      </main>
    </div>
  );
}
