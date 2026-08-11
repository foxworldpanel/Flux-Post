import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['security-audit-v5-forensics'],
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
        <div className="bg-red-950/20 border border-red-500/30 p-6 rounded-xl">
          <h1 className="text-xl font-bold text-red-500 mb-4">AUDITORIA FORENSE V5 — NÃO ALTERE MAIS NADA</h1>
          <div className="font-mono text-xs space-y-2 text-gray-300">
            <p className="text-white font-bold">1. PROVAR QUAL EDGE FUNCTION O CRON ESTÁ CHAMANDO</p>
            <p>Project Ref Esperado: kdbgfgnopqqnzmvxvtje</p>
            
            <p className="text-white font-bold mt-4">2. BUILD: health-v5-debug</p>
            
            <p className="text-white font-bold mt-4">10. RESPOSTA OBRIGATÓRIA</p>
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 py-4 border-y border-white/10">
              <span>RUNTIME PROJECT REF:</span> <span className="text-emerald-400">...</span>
              <span>SAME PROJECT:</span> <span className="text-emerald-400">...</span>
              <span>DEPLOYED BUILD:</span> <span className="text-emerald-400">health-v5-debug</span>
              <span>DIRECT HTTP STATUS:</span> <span className="text-emerald-400">...</span>
              <span>UPSERT RETURNED ROW:</span> <span className="text-emerald-400">...</span>
              <span>DATABASE LAST_RUN_AT:</span> <span className="text-emerald-400">{auditData?.cronState?.last_run_at || '---'}</span>
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

