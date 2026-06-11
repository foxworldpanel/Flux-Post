import { Link, Outlet, useNavigate } from "@tanstack/react-router";
import { 
  LayoutDashboard, 
  Video, 
  Music, 
  Users, 
  Megaphone, 
  Calendar, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { loading } = useAuth();
  const navigate = useNavigate();

  // Temporary bypass for testing
  const user = { email: "dev@fluxpost.com" }; 


  const navItems = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Biblioteca de Vídeos", icon: Video, href: "/videos" },
    { label: "Biblioteca de Músicas", icon: Music, href: "/musics" },
    { label: "Contas TikTok", icon: Users, href: "/accounts" },
    { label: "Campanha Ativa", icon: Megaphone, href: "/campaigns" },
    { label: "Agendamentos", icon: Calendar, href: "/schedule" },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  if (loading) return <div className="flex h-screen items-center justify-center bg-background text-primary">Carregando...</div>;


  return (
    <div className="flex min-h-screen bg-background text-foreground overflow-hidden">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } fixed left-0 top-0 z-40 h-screen flex flex-col border-r border-border bg-card transition-all duration-300 ease-in-out`}
      >
        <div className="flex h-16 items-center justify-between px-4 shrink-0 border-b border-border">
          {isSidebarOpen ? (
            <span className="text-xl font-bold tracking-tight text-primary font-display truncate">Flux Post</span>
          ) : (
            <span className="text-xl font-bold text-primary font-display mx-auto">FP</span>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-muted-foreground hover:bg-accent shrink-0 ml-2"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>

        <nav className="flex-1 mt-6 space-y-1 px-3 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-accent">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all hover:bg-accent group active:scale-95 [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              <item.icon size={22} className="shrink-0" />
              {isSidebarOpen && <span className="truncate">{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="mt-auto p-4 border-t border-border shrink-0">
          <Button
            variant="ghost"
            className="flex w-full items-center justify-start gap-3 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
            onClick={handleLogout}
          >
            <LogOut size={22} className="shrink-0" />
            {isSidebarOpen && <span className="font-medium">Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${isSidebarOpen ? "ml-64" : "ml-20"} flex-1 h-screen overflow-y-auto transition-all duration-300 ease-in-out bg-background`}>
        <div className="max-w-7xl mx-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
