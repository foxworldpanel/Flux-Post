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
  Zap,
  Terminal
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
  const [dbData, setDbData] = useState<any>(null);

  useEffect(() => {
    fetchStats();
    runAudit();
    fetchRemoteData();
  }, []);

  async function fetchRemoteData() {
    try {
      const { data, error } = await supabase.rpc('read_query', {
        query: `
          SELECT 
            (SELECT jsonb_agg(t) FROM (SELECT jobid, jobname, schedule, active, command FROM cron.job) t) as cron_jobs,
            (SELECT jsonb_agg(t) FROM (SELECT runid, status, start_time, return_message FROM cron.job_run_details ORDER BY start_time DESC LIMIT 5) t) as cron_runs,
            (SELECT jsonb_agg(t) FROM (SELECT id, status_code, content, error_msg, created FROM net._http_response ORDER BY created DESC LIMIT 5) t) as net_responses,
            (SELECT jsonb_agg(t) FROM (SELECT * FROM public.server_cron_state) t) as cron_state
        `
      });
      if (!error) setDbData(data[0]);
    } catch (e) {
      console.error("Erro ao buscar dados remotos:", e);
    }
  }

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

      const { data: cronState } = await supabase
        .from("server_cron_state")
        .select("*")
        .eq("id", "campaign_dispatcher")
        .maybeSingle();

      const isDispatcherActive = cronState?.last_run_at && (new Date().getTime() - new Date(cronState.last_run_at).getTime() < 3600000); // 1h para folga
      
      results.push({
        id: "dispatcher",
        label: "Scheduler Server-Side (pg_cron)",
        status: isDispatcherActive ? "success" : "warning",
        message: isDispatcherActive 
          ? `ESTADO: ${cronState.status.toUpperCase()}. Última execução em ${new Date(cronState.last_run_at).toLocaleTimeString()}.` 
          : "OFFLINE/PENDENTE: O scheduler remoto está configurado mas ainda não registrou batimentos de sucesso."
      });

      results.push({
        id: "render_worker",
        label: "Render Worker (FFmpeg)",
        status: "warning",
        message: "AGUARDANDO PROVISIONAMENTO: Arquitetura server-side preparada."
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
      fetchRemoteData();
    } catch (e: any) {
      toast.error(`Erro ao disparar: ${e.message}`);
    } finally {
      setDiagnosing(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        
        {/* RELATÓRIO DE DADOS REAIS - FASE 3.9 */}
        <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 p-6 rounded-2xl mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="text-[#7C3AED] w-5 h-5" />
            <h2 className="text-xl font-bold text-[#7C3AED]">RELATÓRIO DE EXECUÇÃO REAL (DADOS DO BANCO)</h2>
          </div>
          
          <div className="space-y-6 text-sm">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Coluna 1: pg_cron status */}
              <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Server className="w-4 h-4 text-blue-400" /> pg_cron.job
                </h3>
                {dbData?.cron_jobs ? (
                  <div className="space-y-2 font-mono text-[10px] overflow-x-auto">
                    {dbData.cron_jobs.map((j: any) => (
                      <div key={j.jobid} className="border-b border-white/5 pb-2">
                        <div className="flex justify-between text-blue-300">
                          <span>ID: {j.jobid}</span>
                          <span>NAME: {j.jobname}</span>
                          <span>ACTIVE: {String(j.active)}</span>
                        </div>
                        <div className="text-white/40 truncate mt-1">{j.command}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Consultando ou sem acesso à tabela cron.job...</p>
                )}
              </div>

              {/* Coluna 2: pg_cron history */}
              <div className="bg-black/20 p-4 rounded-lg border border-white/5">
                <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-emerald-400" /> Últimas Execuções (cron.job_run_details)
                </h3>
                {dbData?.cron_runs ? (
                  <div className="space-y-2 font-mono text-[10px]">
                    {dbData.cron_runs.map((r: any) => (
                      <div key={r.runid} className="flex justify-between border-b border-white/5 pb-1">
                        <span className={r.status === 'failed' ? 'text-red-400' : 'text-emerald-400'}>
                          [{r.status.toUpperCase()}]
                        </span>
                        <span className="text-white/60">{new Date(r.start_time).toLocaleTimeString()}</span>
                        <span className="text-white/40 max-w-[150px] truncate">{r.return_message}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground italic">Sem histórico recente ou erro de sintaxe detectado.</p>
                )}
              </div>
            </div>

            <div className="bg-black/20 p-4 rounded-lg border border-white/5">
              <h3 className="font-bold text-foreground mb-2 flex items-center gap-2">
                <Cloud className="w-4 h-4 text-yellow-400" /> Respostas pg_net (net._http_response)
              </h3>
              {dbData?.net_responses ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 font-mono text-[10px]">
                  {dbData.net_responses.map((resp: any) => (
                    <div key={resp.id} className="bg-white/5 p-2 rounded">
                      <div className="flex justify-between">
                        <span className={resp.status_code >= 400 ? 'text-red-400' : 'text-emerald-400'}>
                          HTTP {resp.status_code}
                        </span>
                        <span className="text-white/40">{new Date(resp.created).toLocaleTimeString()}</span>
                      </div>
                      <div className="text-white/60 truncate mt-1">
                        {resp.error_msg || resp.content || "Sem corpo de resposta"}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-muted-foreground italic">Nenhuma resposta HTTP registrada no pg_net.</p>
              )}
            </div>

            <div className="pt-4 border-t border-[#7C3AED]/20 mt-4 text-[#7C3AED] font-medium flex justify-between items-center">
              <span>ESTADO ATUAL DO MOTOR: {dbData?.cron_state?.[0]?.status === 'idle' ? 'STANDBY / IDLE' : 'BUSY / RUNNING'}</span>
              <Button size="xs" variant="outline" className="h-7 text-[10px] border-[#7C3AED]/30" onClick={fetchRemoteData}>
                <RefreshCw className="w-3 h-3 mr-1" /> ATUALIZAR DADOS
              </Button>
            </div>
          </div>
        </div>

        <header className="flex flex-col gap-2">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-foreground">Flux Post Dashboard</h1>
            <Badge variant="outline" className="border-[#7C3AED] text-[#7C3AED] bg-[#7C3AED]/10">
              FASE 3.9 — REAL-TIME MONITOR
            </Badge>
          </div>
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
              <CardTitle>Auditoria de Infraestrutura</CardTitle>
              <CardDescription>Status dos componentes de automação server-side</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" className="bg-[#7C3AED]" onClick={handleManualDispatch} disabled={diagnosing}>
                <Server className="mr-2 h-4 w-4" />
                Disparar Dispatcher (UI Trigger)
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
          <p>Flux Post Engine v3.9 — Monitoramento de Dados Reais</p>
          <p>Motor: {dbData?.cron_jobs?.length > 0 ? 'CONFIGURADO' : 'AGENDADOR NÃO ENCONTRADO'}</p>
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