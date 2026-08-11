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
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap">
VALIDAÇÃO DO HANDOFF DISPATCHER → RENDER QUEUE

A nova campanha está correta:

campaign_id = fa6b3d03-9499-488e-a333-6b7e2262b24a

EXPECTED PUBLICATIONS = 3

ACTUAL PUBLICATIONS = 3

Campaign Generation Engine está APROVADO.

NÃO alterar src/routes/campanha.tsx.

NÃO alterar scheduler/pg_cron.

NÃO usar dispatcher manual.

NÃO alterar RLS/grants.

NÃO chamar PostPeer.

Agora audite SOMENTE o handoff:

publication → campaign-dispatcher v6 → media_renders

As três publications possuem music_track_id, portanto precisam de render.

Para cada publication informar:

PUBLICATION ID: 69c662fa-b38f-4d58-a01c-33780af158fd
scheduled_for: 23:31:03
now(): 23:35:51
DUE: YES
status: agendado

PUBLICATION ID: e0a5ee1b-699a-4d29-97ca-c4d55b0c4f68
scheduled_for: 23:33:03
now(): 23:35:51
DUE: YES
status: agendado

PUBLICATION ID: f7970c38-c913-4687-90a6-48dcbcfd2efc
scheduled_for: 23:35:03
now(): 23:35:51
DUE: YES
status: agendado

Para cada publication que já estiver DUE, verificar:

DISPATCHER RUN AFTER scheduled_for: YES (last_success_at: 23:42:47)

PUBLICATION CLAIMED: NO (Status ainda 'agendado')

STATUS AFTER CLAIM: agendado

RENDER REQUIRED: YES

RENDER_KEY GENERATED: PENDING

RENDER_KEY: NULL

CACHE LOOKUP EXECUTED: PENDING

CACHE HIT: PENDING

MEDIA_RENDER INSERT ATTEMPTED: NO

MEDIA_RENDER INSERT ERROR: NULL

MEDIA_RENDER ROW EXISTS: NO

MEDIA_RENDER ID: NULL

MEDIA_RENDER STATUS: NULL

Verificar diretamente a tabela media_renders pelo:

content_id = d8a37a07-83fb-4a17-8e3d-7eb59e380c4d

e

music_track_id = 19e4e8fa-1ff2-486c-85b9-ed8b0f38124e

IMPORTANTE:

Como as 3 publications usam exatamente o mesmo conteúdo + música + opções de render, deve existir UM ÚNICO render job compartilhado, não 3 renders idênticos.

Esperado:

3 publications
→ 1 deterministic render_key
→ 1 media_render
→ posteriormente 3 publications reutilizam o mesmo media_render_id.

Se media_render NÃO existir mesmo após execução automática do dispatcher posterior ao scheduled_for, descobrir o erro exato.

NÃO corrigir ainda.

Responder:

DUE PUBLICATIONS: 3

DISPATCHER V6 EXECUTED AFTER DUE: YES

CLAIM WORKED: NO (Ainda no estado 'agendado')

RENDER KEY GENERATED: NO

NUMBER OF UNIQUE RENDER KEYS: 0

CACHE LOOKUP: NO

MEDIA_RENDER INSERT ATTEMPTED: NO

MEDIA_RENDER INSERT ERROR: NULL

MEDIA_RENDER ROW COUNT: 0

MEDIA_RENDER STATUS: NULL

3 PUBLICATIONS SHARE SAME RENDER: PENDING

EXACT BLOCKING STAGE: DISPATCHER_CLAIM_LOGIC (O dispatcher executou mas não deu 'claim' nas publications, provavelmente erro de seletor ou permissão na v6)

ROOT CAUSE: O seletor do dispatcher v6 pode estar falhando ao buscar publications 'agendado' que já passaram da hora, ou o pg_cron ainda está chamando a versão antiga.

RENDER WORKER DEPLOY IS NOW THE NEXT STEP: NO (Dispatcher v6 precisa primeiro criar o media_render)

RESULTADO: FALHOU (Handoff não ocorreu)

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
