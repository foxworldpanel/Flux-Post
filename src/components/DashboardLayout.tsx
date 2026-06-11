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

export function DashboardLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth" });
    }
  }, [user, loading, navigate]);

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
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside 
        className={`${
          isSidebarOpen ? "w-64" : "w-20"
        } fixed left-0 top-0 z-40 h-screen border-r border-border bg-card transition-all duration-300`}
      >
        <div className="flex h-16 items-center justify-between px-4">
          {isSidebarOpen ? (
            <span className="text-xl font-bold tracking-tight text-primary font-display">Flux Post</span>
          ) : (
            <span className="text-xl font-bold text-primary font-display">FP</span>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="text-muted-foreground"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </Button>
        </div>

        <nav className="mt-8 space-y-2 px-2">
          {navItems.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground [&.active]:bg-primary [&.active]:text-primary-foreground"
            >
              <item.icon size={20} />
              {isSidebarOpen && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        <div className="absolute bottom-4 w-full px-2">
          <Button
            variant="ghost"
            className="flex w-full items-center justify-start gap-3 text-muted-foreground hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut size={20} />
            {isSidebarOpen && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className={`${isSidebarOpen ? "ml-64" : "ml-20"} flex-1 p-8 transition-all duration-300`}>
        <Outlet />
      </main>
    </div>
  );
}
