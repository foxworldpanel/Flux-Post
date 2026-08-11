import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData, isLoading } = useQuery({
    queryKey: ['security-audit-v4-final'],
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
            AUDITORIA V4 — HEALTH OPERATIONAL
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-white to-gray-500 bg-clip-text text-transparent mb-4">
            Relatório Final de Health
          </h1>
          <div className="max-w-2xl text-gray-400 text-sm space-y-2 text-left bg-black/40 p-6 rounded-xl border border-white/5">
            <p>O campaign-dispatcher foi refatorado para garantir a persistência de health em todos os caminhos.</p>
            <p>Aguardando comprovação de 3 ciclos consecutivos após o deploy da correção.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <Card className="bg-black/40 border-gray-800 p-6">
            <CardHeader className="px-0 pt-0">
              <CardTitle className="text-xl font-semibold flex items-center gap-2">
                <Activity className="h-5 w-5 text-purple-500" />
                Auditoria de Health (DADOS VIVOS)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-0 space-y-8">
              <div className="space-y-4">
                <div className="p-4 bg-black/20 rounded border border-white/5 font-mono text-xs space-y-2">
                  <p><span className="text-gray-500">current_db_last_run_at:</span> {auditData?.cronState?.last_run_at || 'Loading...'}</p>
                  <p><span className="text-gray-500">current_db_last_success_at:</span> {auditData?.cronState?.last_success_at || 'Loading...'}</p>
                  <p><span className="text-gray-500">processed_count:</span> {auditData?.cronState?.processed_count ?? 0}</p>
                </div>

                <div className="border border-white/5 rounded-lg overflow-hidden">
                  <div className="bg-white/5 p-3 text-xs font-bold uppercase tracking-wider text-gray-400">RUN 1: (Audit Post-Fix)</div>
                  <div className="p-4 grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-mono">
                    <div><span className="text-gray-500">horário:</span> --:--</div>
                    <div><span className="text-gray-500">HTTP:</span> ---</div>
                    <div><span className="text-gray-500">last_run_at:</span> {auditData?.cronState?.last_run_at}</div>
                  </div>
                </div>
              </div>

              <Alert className="bg-black/60 border-gray-800">
                <AlertTitle className="text-white font-bold mb-4">REPORT FINAL</AlertTitle>
                <AlertDescription className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
                  <div className="space-y-1">
                    <p>CAUSA RAIZ: <span className="text-gray-300">Return antecipado na fila vazia + health condicional.</span></p>
                    <p>HEALTH ADVANCED 3 TIMES: <span className="text-gray-300">AGUARDANDO CICLOS</span></p>
                    <p>MANUAL TRIGGER USED: <span className="text-emerald-500">NO</span></p>
                    <p>RESULTADO: <span className="text-yellow-500 font-bold">EM VALIDAÇÃO</span></p>
                  </div>
                </AlertDescription>
              </Alert>
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
