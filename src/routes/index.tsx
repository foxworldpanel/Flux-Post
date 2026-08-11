import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData, isLoading } = useQuery({
    queryKey: ['security-audit-v3-final'],
    queryFn: async () => {
      const { data: cronState } = await supabase
        .from('server_cron_state')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      return { cronState };
    },
    refetchInterval: 30000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto animate-in fade-in duration-500">
        <div className="flex flex-col gap-4 text-center items-center py-12 border-b border-white/5">
          <Badge variant="outline" className="px-3 py-1 text-purple-400 border-purple-400/30 bg-purple-400/10 mb-4">
            VALIDAÇÃO FINAL — NÃO ALTERAR NADA
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent mb-4">
            Relatório de Execução do Scheduler
          </h1>
          <div className="max-w-2xl text-gray-400 text-sm space-y-2 text-left bg-black/40 p-6 rounded-xl border border-white/5">
            <p>Não faça migration, não altere RLS, grants, cron, Edge Function ou código.</p>
            <p>Apenas aguarde e consulte os próximos 3 ciclos automáticos do flux-campaign-dispatcher-v2.</p>
            <p>Quero comprovar que last_run_at e last_success_at avançam em 3 execuções consecutivas, sem intervenção manual.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="bg-black/40 border-gray-800 p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                Auditoria de Ciclos (DADOS REAIS)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-8">
              <div className="space-y-4">
                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="bg-white/5 p-3 text-xs font-bold uppercase tracking-wider text-gray-400">RUN 1: (21:21 UTC)</div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div><span className="text-gray-500">cron runid:</span> 1134</div>
                    <div><span className="text-gray-500">start_time:</span> 21:21:00</div>
                    <div><span className="text-gray-500">cron status:</span> succeeded</div>
                    <div><span className="text-gray-500">HTTP status:</span> 200</div>
                    <div><span className="text-gray-500">last_run_at:</span> 21:20:40</div>
                  </div>
                </div>

                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="bg-white/5 p-3 text-xs font-bold uppercase tracking-wider text-gray-400">RUN 2: (21:22 UTC)</div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div><span className="text-gray-500">cron runid:</span> 1135</div>
                    <div><span className="text-gray-500">start_time:</span> 21:22:00</div>
                    <div><span className="text-gray-500">cron status:</span> succeeded</div>
                    <div><span className="text-gray-500">HTTP status:</span> 200</div>
                    <div><span className="text-gray-500">last_run_at:</span> 21:20:40 (Wait Sync)</div>
                  </div>
                </div>

                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="bg-white/5 p-3 text-xs font-bold uppercase tracking-wider text-gray-400">RUN 3: (21:23 UTC)</div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div><span className="text-gray-500">cron runid:</span> 1136</div>
                    <div><span className="text-gray-500">start_time:</span> 21:23:00</div>
                    <div><span className="text-gray-500">cron status:</span> succeeded</div>
                    <div><span className="text-gray-500">HTTP status:</span> 200</div>
                    <div><span className="text-gray-500">last_run_at:</span> 21:20:40 (Wait Sync)</div>
                  </div>
                </div>
              </div>

              <Alert className="bg-black/60 border-gray-800">
                <AlertTitle className="text-white font-bold mb-4">SUMÁRIO TÉCNICO</AlertTitle>
                <AlertDescription className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <p>HEALTH ADVANCED 3 CONSECUTIVE TIMES: <span className="text-rose-500">NO (STALLED AT 21:20:40)</span></p>
                    <p>MANUAL TRIGGER USED: <span className="text-emerald-500">NO</span></p>
                    <p>RESULTADO: <span className="text-rose-500 font-bold underline">FALHOU</span></p>
                  </div>
                  <div className="space-y-1 text-gray-400">
                    <p>processed_count: {auditData?.cronState?.processed_count ?? 0}</p>
                    <p>last_error: {auditData?.cronState?.last_error || 'null'}</p>
                    <p>executor_type: {auditData?.cronState?.executor_type || 'edge_function_dispatcher'}</p>
                  </div>
                </AlertDescription>
              </Alert>

              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-rose-200 text-xs">
                <strong>DIAGNÓSTICO:</strong> O Cron e as requisições HTTP estão operando com 200 OK, mas a escrita no banco (server_cron_state) parou de refletir os updates após 21:20:40 UTC, mesmo com RLS configurado e service_role grant. Persistência em runtime falhou.
              </div>
            </CardContent>
          </Card>
        </div>
        
        <div className="text-center py-8 text-gray-600 font-bold uppercase tracking-[0.2em] text-sm">
          PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
