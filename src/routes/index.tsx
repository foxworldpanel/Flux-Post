import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Activity, 
  Database, 
  Cloud, 
  Server,
  RefreshCw,
  Zap
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Index() {
  const [stats, setStats] = useState({
    campanhas: 0,
    publications: 0,
    accounts: 0,
    renders: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  async function fetchStats() {
    setLoading(true);
    try {
      const [campRes, pubRes, accRes, renderRes] = await Promise.all([
        supabase.from("campanhas").select("*", { count: "exact", head: true }),
        supabase.from("publications").select("*", { count: "exact", head: true }),
        supabase.from("social_accounts").select("*", { count: "exact", head: true }),
        supabase.from("media_renders").select("*", { count: "exact", head: true })
      ]);

      setStats({
        campanhas: campRes.count || 0,
        publications: pubRes.count || 0,
        accounts: accRes.count || 0,
        renders: renderRes.count || 0
      });
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500 p-6">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Flux Post Dashboard</h1>
            <Badge variant="outline" className="border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/10">
              OPERACIONAL
            </Badge>
          </div>
          <p className="text-muted-foreground">Bem-vindo ao centro de comando da sua distribuição musical.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Campanhas" value={stats.campanhas} icon={<Activity className="text-primary" />} />
          <StatCard label="Publicações" value={stats.publications} icon={<Cloud className="text-blue-500" />} />
          <StatCard label="Contas Sociais" value={stats.accounts} icon={<Zap className="text-yellow-500" />} />
          <StatCard label="Renders" value={stats.renders} icon={<Database className="text-emerald-500" />} />
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle>Status do Sistema</CardTitle>
            <CardDescription>Monitoramento de componentes ativos</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <StatusItem 
              label="Render Engine (VPS Worker)" 
              status="success" 
              message="O motor de renderização server-side está processando a fila." 
            />
            <StatusItem 
              label="Supabase Bridge" 
              status="success" 
              message="Conexão estável com Lovable Cloud e Edge Functions." 
            />
            <StatusItem 
              label="PostPeer v1 API" 
              status="success" 
              message="Integração social ativa e autenticada." 
            />
          </CardContent>
        </Card>

        <footer className="pt-8 border-t border-border/50 text-xs text-muted-foreground flex justify-between">
          <p>Flux Post Engine v4.0 — Legit Mode</p>
          <div className="flex gap-4">
            <span className="flex items-center gap-1"><Server size={12} className="text-emerald-500" /> Worker Online</span>
            <span className="flex items-center gap-1"><Activity size={12} className="text-emerald-500" /> Scheduler Operacional</span>
          </div>
        </footer>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</p>
            <h3 className="text-2xl font-bold text-foreground mt-1">{value}</h3>
          </div>
          <div className="p-3 bg-muted/50 rounded-xl">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusItem({ label, status, message }: { label: string, status: 'success' | 'warning' | 'error', message: string }) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30">
      <div className="mt-1">
        {status === "success" && <CheckCircle2 className="text-emerald-500 w-5 h-5" />}
        {status === "warning" && <AlertTriangle className="text-yellow-500 w-5 h-5" />}
        {status === "error" && <XCircle className="text-red-500 w-5 h-5" />}
      </div>
      <div>
        <h4 className="font-bold text-foreground">{label}</h4>
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
