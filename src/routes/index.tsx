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
{`FASE 4.7 — VERIFICAR DEPLOY DA RENDER-BRIDGE

A correção da Fase 4.6 foi concluída e o repositório já foi atualizado na VPS.

Agora quero verificar SOMENTE se a versão corrigida da Edge Function:

supabase/functions/render-bridge/index.ts

está efetivamente DEPLOYADA e ATIVA no Lovable Cloud.

Confirme que a versão atualmente executada pelo backend contém:

- bucket de música = "musicas"

- geração da Signed URL usando storage_path

- tratamento de input físico ausente

- job com input ausente marcado como failed

- fila continua para o próximo job

- autenticação X-Render-Worker-Secret preservada

Se o código atualizado ainda NÃO estiver deployado, faça o deploy da Edge Function render-bridge.

NÃO altere nenhuma outra parte do sistema.

NÃO altere Secrets.

NÃO altere banco ou Storage.

NÃO crie jobs de teste.

Ao terminar responda somente:

RENDER_BRIDGE DEPLOYED: YES
DEPLOYED VERSION USES BUCKET MUSICAS: YES
MISSING INPUT HANDLING ACTIVE: YES
WORKER SECRET AUTH ACTIVE: YES
READY TO TEST VPS WORKER: YES

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}