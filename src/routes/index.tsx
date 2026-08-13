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
        .eq('source_content_id', 'd8a37a07-83fb-4a17-8e3d-7eb59e380c4d')
        .eq('music_track_id', '19e4e8fa-1ff2-486c-85b9-ed8b0f38124e');

      return { cronState, pubs, renders };
    },
    refetchInterval: 5000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`FASE 4.4 — CADASTRAR RENDER_WORKER_SECRET

Quero configurar agora o segredo compartilhado da arquitetura Bridge Server-to-Server v4.

Cadastre no ambiente seguro de Secrets do Lovable Cloud:

Nome:
 RENDER_WORKER_SECRET

Valor:
 e1af0567091f2616e47aa1c67b574e2f08faf3ed3bcf5fe45bb612baa52b6bb8



Requisitos:

 Armazene o valor somente como Secret server-side. 

 NÃO grave o valor no código. 

 NÃO grave em .env do repositório. 

 NÃO grave em migrations. 

 NÃO exponha no frontend. 

 NÃO mostre o valor em logs. 

 NÃO retorne o valor na resposta. 

 NÃO altere o valor fornecido. 

 A Edge Function render-bridge deve continuar lendo o segredo através de Deno.env.get("RENDER_WORKER_SECRET"). 

 NÃO altere outras partes do sistema. 

Depois de cadastrar, verifique apenas se RENDER_WORKER_SECRET está disponível para a Edge Function render-bridge.

Ao finalizar, responda somente:

RENDER_WORKER_SECRET CREATED: YES/NO
 RENDER_BRIDGE CAN ACCESS SECRET: YES/NO
 READY FOR VPS CONFIGURATION: YES/NO

Não exiba o valor do segredo na resposta. PARE após essa configuração.`}
        </div>
      </div>
    </DashboardLayout>
  );
}