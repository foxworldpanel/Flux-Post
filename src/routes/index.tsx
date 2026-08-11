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

CAMPAIGN NAME:

CAMPAIGN ID:

CAMPAIGN STATUS:

CREATED AT:

EXPECTED PUBLICATIONS:

ACTUAL PUBLICATIONS:

Liste TODAS as publications dessa campanha:

PUBLICATION ID:
SOCIAL ACCOUNT:
PLATFORM:
SCHEDULED FOR:
STATUS:
CONTENT ID:
MUSIC TRACK ID:
MEDIA RENDER ID:
PROVIDER POST ID:
ERROR:

Depois verifique:

DISPATCHER SAW PUBLICATIONS: YES/NO

RENDER REQUIRED: YES/NO

RENDER JOB CREATED: YES/NO

RENDER KEY:

MEDIA RENDER STATUS:

POSTPEER CALLED: YES/NO

CURRENT BLOCKING STAGE:

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

RESULTADO: PASSOU/FALHOU

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
