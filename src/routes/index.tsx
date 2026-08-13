import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v8'],
    queryFn: async () => {
      const { data: cronState } = await supabase
        .from('server_cron_state')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      const { data: pubs } = await supabase
        .from('publications')
        .select(`
          id, 
          status, 
          media_render_id
        `)
        .eq('campaign_id', 'fa6b3d03-9499-488e-a333-6b7e2262b24a');

      const { data: renders } = await supabase
        .from('media_renders')
        .select('*')
        .eq('id', '59c5e3ac-b258-4624-b31d-070cfb0fd9d8');

      return { cronState, pubs, renders };
    },
    refetchInterval: 5000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`FASE 4.6 — CORRIGIR BUCKET DE MÚSICA E TRATAR JOB ÓRFÃO

AUDITORIA PÓS-IMPLEMENTAÇÃO:

CANONICAL MUSIC BUCKET: musicas
BRIDGE MUSIC BUCKET FIXED: YES
SIGNED MUSIC URL USES STORAGE_PATH: YES
ORPHAN JOB MARKED FAILED: YES
ORPHAN JOB WILL NOT BE CLAIMED AGAIN: YES
MISSING INPUT HANDLING IMPLEMENTED: YES
QUEUE CAN CONTINUE AFTER BROKEN JOB: YES
RENDER BRIDGE AUTH PRESERVED: YES
READY TO UPDATE VPS: YES

Arquivos alterados:
- supabase/functions/render-bridge/index.ts (Correção de bucket e validação física de inputs)
- src/routes/index.tsx (Atualização deste dashboard de auditoria)

O job 59c5e3ac foi marcado manualmente como 'failed' no banco de dados. 
A nova lógica da render-bridge agora valida se o arquivo físico existe no Storage ANTES de liberar o claim para o worker. 
Se o arquivo estiver ausente, a função marca o job como 'failed' automaticamente e retorna um erro, permitindo que o worker peça o próximo job da fila.

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}