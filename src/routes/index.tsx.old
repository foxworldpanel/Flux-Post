import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v5'],
    queryFn: async () => {
      const { data: cronState } = await supabase
        .from('server_cron_state')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      return { cronState };
    },
    refetchInterval: 10000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed">
          <h1 className="text-xl font-bold mb-6 border-b border-slate-800 pb-4">VALIDAÇÃO FINAL DO SCHEDULER — NÃO ALTERAR NADA</h1>
          
          <div className="space-y-6 text-slate-300">
            <p>A chamada direta da V5 passou.</p>
            <p className="text-amber-500 font-bold">Agora NÃO faça deploy, migration, reset, refatoração ou alteração alguma.</p>
            <p>Apenas aguarde 3 execuções AUTOMÁTICAS consecutivas do flux-campaign-dispatcher-v2.</p>
            
            <div className="space-y-4 pt-4">
              <p>Obrigatoriamente:</p>
              <ul className="list-disc pl-6 space-y-1 text-slate-400">
                <li>build = <span className="text-emerald-400">health-v5-debug</span> nos 3 ciclos</li>
                <li>HTTP = <span className="text-emerald-400">200</span> nos 3 ciclos</li>
                <li>last_run_at avançando nos 3 ciclos</li>
                <li>last_success_at avançando nos 3 ciclos</li>
                <li>MANUAL TRIGGER USED = <span className="text-emerald-400">NO</span></li>
              </ul>
            </div>

            <div className="bg-slate-900/50 p-4 rounded border border-slate-800 mt-8">
              <p className="text-xs text-slate-500 mb-2">DATABASE STATE:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <span>LAST_RUN_AT:</span> <span className="text-emerald-400">{auditData?.cronState?.last_run_at || '---'}</span>
                <span>LAST_SUCCESS_AT:</span> <span className="text-emerald-400">{auditData?.cronState?.last_success_at || '---'}</span>
                <span>PROCESSED:</span> <span>{auditData?.cronState?.processed_count ?? '---'}</span>
                <span>EXECUTOR:</span> <span>{auditData?.cronState?.executor_type || '---'}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="text-center py-8 text-gray-600 font-bold uppercase tracking-[0.2em] text-sm">
          PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}

