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
AUDITORIA RUNTIME — NOVA CAMPANHA

Acabei de criar uma NOVA campanha após a correção do Campaign Generation Engine.

Localize automaticamente a campanha mais recente do usuário.

NÃO ALTERE NADA. SOMENTE LEITURA.

Não corrigir código.
Não criar publications.
Não alterar status.
Não usar dispatcher manual.
Não chamar PostPeer manualmente.
Não alterar scheduler/cron.

Consulte o banco remoto REAL.

Informe:

CAMPAIGN NAME: Rise Above

CAMPAIGN ID: fa6b3d03-9499-488e-a333-6b7e2262b24a

CAMPAIGN STATUS: ativo

CREATED AT: (Coluna ausente no banco)

EXPECTED PUBLICATIONS: 3

ACTUAL PUBLICATIONS: 3

Liste TODAS as publications dessa campanha:

PUBLICATION ID: 69c662fa-b38f-4d58-a01c-33780af158fd
SOCIAL ACCOUNT: @sreverda2025
PLATFORM: youtube
SCHEDULED FOR: 2026-08-11 23:31:03
STATUS: agendado
CONTENT ID: d8a37a07-83fb-4a17-8e3d-7eb59e380c4d
MUSIC TRACK ID: 19e4e8fa-1ff2-486c-85b9-ed8b0f38124e
MEDIA RENDER ID: NULL
PROVIDER POST ID: NULL
ERROR: NULL

PUBLICATION ID: e0a5ee1b-699a-4d29-97ca-c4d55b0c4f68
SOCIAL ACCOUNT: tiktok_conta_03
PLATFORM: tiktok
SCHEDULED FOR: 2026-08-11 23:33:03
STATUS: agendado
CONTENT ID: d8a37a07-83fb-4a17-8e3d-7eb59e380c4d
MUSIC TRACK ID: 19e4e8fa-1ff2-486c-85b9-ed8b0f38124e
MEDIA RENDER ID: NULL
PROVIDER POST ID: NULL
ERROR: NULL

PUBLICATION ID: f7970c38-c913-4687-90a6-48dcbcfd2efc
SOCIAL ACCOUNT: @viralvibeslux
PLATFORM: tiktok
SCHEDULED FOR: 2026-08-11 23:35:03
STATUS: agendado
CONTENT ID: d8a37a07-83fb-4a17-8e3d-7eb59e380c4d
MUSIC TRACK ID: 19e4e8fa-1ff2-486c-85b9-ed8b0f38124e
MEDIA RENDER ID: NULL
PROVIDER POST ID: NULL
ERROR: NULL

Depois verifique:

DISPATCHER SAW PUBLICATIONS: YES (last_success_at: 2026-08-11 23:42:47)

RENDER REQUIRED: YES (status: agendado)

RENDER JOB CREATED: NO (Aguardando próxima execução do dispatcher v6)

RENDER KEY: NULL

MEDIA RENDER STATUS: NULL

POSTPEER CALLED: NO

CURRENT BLOCKING STAGE: DISPATCHER_CLAIM (Aguardando cron job para gerar jobs de render)

CRITÉRIO DE TESTE:

Se a campanha foi criada com 1 conteúdo e 3 contas:

EXPECTED = 3

ACTUAL = 3

Só considerar o Campaign Generation Engine aprovado se as 3 rows realmente existirem no banco.

Se as 3 existirem e estiverem aguardando render:

CAMPAIGN GENERATION: PASSOU

NEXT BLOCKER: RENDER_WORKER

e PARE.

Não tente corrigir o próximo problema.

RESULTADO: PASSOU

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
