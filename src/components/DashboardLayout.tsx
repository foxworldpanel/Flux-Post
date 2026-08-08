import { Link, useNavigate, useLocation } from "react-router-dom";
import { 
  LayoutDashboard, 
  Video, 
  Music, 
  Users, 
  Megaphone, 
  Calendar, 
  LogOut,
  Menu,
  X,
  Clapperboard,
  Search,
  History,
  BarChart3,
  Settings,
  ShieldCheck
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Campanhas", icon: Megaphone, href: "/campanha" },
    { label: "Artistas", icon: Users, href: "/artistas" },
    { label: "Músicas", icon: Music, href: "/musics" },
    { label: "Garimpo", icon: Search, href: "/garimpo" },
    { label: "Biblioteca", icon: Video, href: "/videos" },
    { label: "Contas Sociais", icon: Users, href: "/accounts" },
    { label: "Agenda", icon: Calendar, href: "/schedule" },
    { label: "Publicações", icon: History, href: "/publicacoes" },
    { label: "Analytics", icon: BarChart3, href: "/analytics" },
    { label: "Processar", icon: Clapperboard, href: "/processar" },
    { label: "Segurança", icon: ShieldCheck, href: "/security-report" },
  ];

  const handleLogout = () => {
    navigate("/auth");
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-[#0A0A0F] text-white">Carregando...</div>;

  return (
    <div className="flex h-screen bg-[#0A0A0F] text-white overflow-hidden font-inter">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-white/5 bg-[#0A0A0F] transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="flex h-16 items-center justify-between px-4 shrink-0 border-b border-white/5">
          {isSidebarOpen ? (
            <div className="flex items-center gap-2 px-2">
              <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold">F</span>
              </div>
              <span className="text-xl font-space font-bold tracking-tight text-white">Flux Post</span>
            </div>
          ) : (
            <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center mx-auto">
              <span className="text-white font-bold">F</span>
            </div>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-slate-400 hover:text-white hover:bg-white/5 shrink-0"
          >
            {isSidebarOpen ? <X size={18} /> : <Menu size={18} />}
          </Button>
        </div>

        <nav className="flex-1 mt-6 space-y-1 px-3 overflow-y-auto overflow-x-hidden scrollbar-none">
          {navItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-medium transition-all group relative",
                  isActive 
                    ? "bg-purple-600/10 text-purple-400 border border-purple-500/20" 
                    : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"
                )}
              >
                <item.icon size={20} className={cn("shrink-0", isActive ? "text-purple-400" : "group-hover:text-white")} />
                {isSidebarOpen && <span className="truncate">{item.label}</span>}
                {isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-purple-500 rounded-r-full" />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto p-4 border-t border-white/5 shrink-0">
          <Button
            variant="ghost"
            className="flex w-full items-center justify-start gap-3 text-slate-400 hover:text-white hover:bg-white/5 transition-colors rounded-xl px-3 py-3"
            onClick={handleLogout}
          >
            <LogOut size={20} className="shrink-0" />
            {isSidebarOpen && <span className="font-medium text-sm">Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 h-screen overflow-y-auto transition-all duration-300 ease-in-out",
        isSidebarOpen ? "ml-64" : "ml-20"
      )}>
        <div className="w-full max-w-7xl mx-auto min-h-full">
          {children}
        </div>
      </main>
    </div>
  );
}
