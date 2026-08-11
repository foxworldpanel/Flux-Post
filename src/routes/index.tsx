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

CAMPAIGN NAME: TESTE ATOMICIDADE

CAMPAIGN ID: 1530e461-8cf1-4560-a7d0-1c002bc0f7ba

CAMPAIGN STATUS: ativo

CREATED AT: 2026-08-11T23:36:26.549247+00:00

EXPECTED PUBLICATIONS: 3

ACTUAL PUBLICATIONS: 3

Liste TODAS as publications dessa campanha:

PUBLICATION ID: 902c33ba-6415-467f-856d-e448bca6129c
SOCIAL ACCOUNT: @ph.shox
PLATFORM: tiktok
SCHEDULED FOR: 2026-08-11T23:36:00+00:00
STATUS: agendado
CONTENT ID: 054a11f9-90d1-4a57-b08e-5b682662058b
MUSIC TRACK ID: d701777d-cd61-460d-9b57-69c7ccba4e89
MEDIA RENDER ID: NULL
PROVIDER POST ID: NULL
ERROR: NULL

PUBLICATION ID: a074811b-8519-485a-85d1-9f931d87f71c
SOCIAL ACCOUNT: @ph.shox
PLATFORM: tiktok
SCHEDULED FOR: 2026-08-12T00:36:00+00:00
STATUS: agendado
CONTENT ID: 054a11f9-90d1-4a57-b08e-5b682662058b
MUSIC TRACK ID: d701777d-cd61-460d-9b57-69c7ccba4e89
MEDIA RENDER ID: NULL
PROVIDER POST ID: NULL
ERROR: NULL

PUBLICATION ID: 7c54d19f-d3c2-421f-8854-ce2679e0a05a
SOCIAL ACCOUNT: @ph.shox
PLATFORM: tiktok
SCHEDULED FOR: 2026-08-12T01:36:00+00:00
STATUS: agendado
CONTENT ID: 054a11f9-90d1-4a57-b08e-5b682662058b
MUSIC TRACK ID: d701777d-cd61-460d-9b57-69c7ccba4e89
MEDIA RENDER ID: NULL
PROVIDER POST ID: NULL
ERROR: NULL

Depois verifique:

DISPATCHER SAW PUBLICATIONS: YES (last_success_at: 23:37:37)

RENDER REQUIRED: YES (status: agendado)

RENDER JOB CREATED: NO (Aguardando próxima execução do dispatcher)

RENDER KEY: NULL

MEDIA RENDER STATUS: NULL

POSTPEER CALLED: NO

CURRENT BLOCKING STAGE: DISPATCHER_CLAIM (Aguardando cron de 1 min)

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
