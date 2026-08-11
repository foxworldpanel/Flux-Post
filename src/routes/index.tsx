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
import { toast } from "sonner";

export default function Index() {
  const [stats, setStats] = useState({
    campanhas: 0,
    publications: 0,
    accounts: 0,
    renders: 0
  });
  const [audit, setAudit] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [diagnosing, setDiagnosing] = useState(false);

  useEffect(() => {
    fetchStats();
    runAudit();
  }, []);

  async function fetchStats() {
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
    }
  }

  async function runAudit() {
    setLoading(true);
    const results = [];

    try {
      // 1. Reconciliação de Schema
      const { error: schemaError } = await supabase
        .from("publications")
        .select("music_track_id, render_options")
        .limit(1);
      
      results.push({
        id: "schema_sync",
        label: "Sincronização de Schema (Contrato v1)",
        status: schemaError ? "error" : "success",
        message: schemaError ? `Divergência: ${schemaError.message}` : "Contrato canônico verificado (music_track_id, render_options)."
      });

      // 2. Executor Server-Side (Dispatcher)
      const { data: cronState } = await supabase
        .from("server_cron_state")
        .select("*")
        .eq("id", "00000000-0000-0000-0000-000000000001")
        .maybeSingle();

      const isDispatcherActive = cronState?.last_run_at && (new Date().getTime() - new Date(cronState.last_run_at).getTime() < 300000); // 5 min
      
      results.push({
        id: "dispatcher",
        label: "Scheduler Server-Side (pg_cron)",
        status: isDispatcherActive ? "success" : "warning",
        message: isDispatcherActive 
          ? `ONLINE: Última execução em ${new Date(cronState.last_run_at).toLocaleTimeString()}.` 
          : "OFFLINE: Scheduler automático não detectado (Aguardando primeiro ciclo)."
      });

      // 3. Render Worker
      results.push({
        id: "render_worker",
        label: "Render Worker (FFmpeg)",
        status: "warning",
        message: "AGUARDANDO DEPLOY: Arquitetura server-side preparada, aguardando provisionamento de container."
      });

      // 4. Fila de Automação
      const { count: queuedRenders } = await supabase.from("media_renders").select("*", { count: 'exact', head: true }).eq("status", "queued");
      results.push({
        id: "queue_status",
        label: "Fila de Processamento",
        status: queuedRenders && queuedRenders > 0 ? "warning" : "success",
        message: `${queuedRenders || 0} renders na fila. ${stats.renders} no cache.`
      });

      setAudit(results);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  async function handleManualDispatch() {
    setDiagnosing(true);
    try {
      const { data, error } = await supabase.functions.invoke('campaign-dispatcher');
      if (error) throw error;
      toast.success(`Fila processada: ${data.processed} publicações.`);
      runAudit();
    } catch (e: any) {
      toast.error(`Erro ao disparar: ${e.message}`);
    } finally {
      setDiagnosing(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Flux Post Dashboard</h1>
            <Badge variant="outline" className="border-red-500 text-red-500 bg-red-500/10">
              AUDITORIA CRÍTICA ATIVA
            </Badge>
          </div>
          <p className="text-muted-foreground italic">
            "NÃO declarar sistema pronto para produção enquanto scheduler autônomo e render server-side não estiverem comprovadamente implementados."
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard label="Campanhas" value={stats.campanhas} icon={<Activity className="text-primary" />} />
          <StatCard label="Publicações" value={stats.publications} icon={<Cloud className="text-blue-500" />} />
          <StatCard label="Contas Sociais" value={stats.accounts} icon={<Zap className="text-yellow-500" />} />
          <StatCard label="Renders" value={stats.renders} icon={<Database className="text-emerald-500" />} />
        </div>

        <Card className="bg-card border-border">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Auditoria de Sistema (v3.8)</CardTitle>
              <CardDescription>Zero Schema Drift & Contract Check</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={runAudit} disabled={loading}>
                <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Recarregar
              </Button>
              <Button size="sm" className="bg-[#7C3AED]" onClick={handleManualDispatch} disabled={diagnosing}>
                <Server className="mr-2 h-4 w-4" />
                Disparar Dispatcher (Manual)
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {audit.map((item) => (
              <div key={item.id} className="flex items-start gap-4 p-4 rounded-xl border border-border bg-muted/30">
                <div className="mt-1">
                  {item.status === "success" && <CheckCircle2 className="text-emerald-500 w-5 h-5" />}
                  {item.status === "warning" && <AlertTriangle className="text-yellow-500 w-5 h-5" />}
                  {item.status === "error" && <XCircle className="text-red-500 w-5 h-5" />}
                </div>
                <div>
                  <h4 className="font-bold text-foreground">{item.label}</h4>
                  <p className="text-sm text-muted-foreground">{item.message}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <footer className="pt-8 border-t border-border/50 text-xs text-muted-foreground flex justify-between">
          <p>Flux Post Engine v3.8 — Auditoria Baseada em Código Versionado</p>
          <p>Estado do Motor: HÍBRIDO (SCHEDULER PENDENTE)</p>
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