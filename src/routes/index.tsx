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

PUBLICATION ID
scheduled_for
now()
DUE: YES/NO
status

Para cada publication que já estiver DUE, verificar:

DISPATCHER RUN AFTER scheduled_for: YES/NO

PUBLICATION CLAIMED: YES/NO

STATUS AFTER CLAIM:

RENDER REQUIRED: YES/NO

RENDER_KEY GENERATED: YES/NO

RENDER_KEY:

CACHE LOOKUP EXECUTED: YES/NO

CACHE HIT: YES/NO

MEDIA_RENDER INSERT ATTEMPTED: YES/NO

MEDIA_RENDER INSERT ERROR:

MEDIA_RENDER ROW EXISTS: YES/NO

MEDIA_RENDER ID:

MEDIA_RENDER STATUS:

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

DUE PUBLICATIONS:

DISPATCHER V6 EXECUTED AFTER DUE: YES/NO

CLAIM WORKED: YES/NO

RENDER KEY GENERATED: YES/NO

NUMBER OF UNIQUE RENDER KEYS:

CACHE LOOKUP:

MEDIA_RENDER INSERT ATTEMPTED: YES/NO

MEDIA_RENDER INSERT ERROR:

MEDIA_RENDER ROW COUNT:

MEDIA_RENDER STATUS:

3 PUBLICATIONS SHARE SAME RENDER: YES/NO/PENDING

EXACT BLOCKING STAGE:

ROOT CAUSE:

RENDER WORKER DEPLOY IS NOW THE NEXT STEP: YES/NO

RESULTADO: PASSOU/FALHOU

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
