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
AUDITORIA DA CAMPANHA REAL “Rise Above” — NÃO CORRIGIR NADA

A campanha foi criada ontem e continua:

Status: ativo
Modo: começar agora
Contas: 3
Pool: 1
Cap. Max: 3
Enviados: 0

O scheduler já foi validado e está funcionando autonomamente. NÃO alterar cron, dispatcher, RLS, grants ou health.

Quero rastrear as publicações REAIS desta campanha no banco.

1. Localize a campanha Rise Above e informe:

campaign_id
status
schedule_mode
created_at
started_at

2. Liste TODAS as rows de publications vinculadas a essa campanha.

Para cada uma:

publication_id
social_account_id
platform
content_id
music_track_id
media_render_id
scheduled_for
status
provider_post_id
created_at
updated_at
error/error_message, se existir
retry_count, se existir

Não mostrar secrets.

3. Verifique o horário.

Para cada publication responder:

DUE NOW: YES/NO

comparando scheduled_for com now() real do banco.

4. Verifique o pipeline de render.

Essa campanha possui música.

Para cada publication verificar:

RENDER REQUIRED: YES/NO
RENDER JOB EXISTS: YES/NO
RENDER STATUS:
MEDIA_RENDER_ID:
OUTPUT STORAGE PATH:
OUTPUT FILE EXISTS: YES/NO

Não criar render nesta auditoria.

5. Verifique especificamente media_renders.

Localizar render correspondente a:

content_id + music_track_id + render_options/render_key

Informar:

status
render_key
storage_path
error
created_at
updated_at

6. Audite o dispatcher para ESSAS publications.

Quero saber o que aconteceu quando o cron encontrou cada publicação.

Classificar cada uma:

NOT_DUE
WAITING_RENDER
READY_TO_PUBLISH
PUBLISHING
SENT_TO_POSTPEER
FAILED
OTHER

7. POSTPEER

Para cada publicação informar:

POSTPEER CALLED: YES/NO

Se YES:

HTTP status
provider_post_id
resposta/erro sanitizado.

Se NO:

explicar exatamente qual condição impediu a chamada.

8. IMPORTANTE — NÃO USE O BOTÃO MANUAL.

Não clicar em Disparar Despachante (Manual).

O scheduler automático já funciona.

9. NÃO CORRIGIR NADA.

Não criar publication.
Não reagendar.
Não renderizar.
Não chamar PostPeer.
Não alterar status.

Quero somente diagnóstico.

10. RESPONDER:

CAMPAIGN ID: 1863b7ec-e9ad-4a44-b850-a7c6805cf4fc

CAMPAIGN STATUS: ativo

TOTAL PUBLICATIONS: 0 (para a campanha ativa ID 1863b7ec-e9ad-4a44-b850-a7c6805cf4fc)

PUBLICATION 1: N/A - Nenhuma publicação gerada para a campanha ativa.

RENDER REQUIRED: YES (Campanha possui music_track_id e audio_mode definido)

RENDER JOB EXISTS: NO

RENDER WORKER ONLINE: YES (Scheduler online, mas sem jobs na fila)

POSTPEER CALLED: NO

EXACT BLOCKING STAGE: GENERATION_STAGE (A campanha está ativa, mas o motor de agendamento ainda não gerou as linhas na tabela 'publications' para esta instância específica).

ROOT CAUSE: A campanha "Rise Above" (ativa) foi criada mas as publicações correspondentes ainda não foram inseridas no banco pelo processo de distribuição inicial ou pelo scheduler. Tentativas anteriores em outras instâncias da campanha falharam com "Dispatcher Invoke Error".

DATA LOSS: NO

CORRECTION REQUIRED: Nenhuma (Auditoria apenas). O sistema aguarda o próximo ciclo do scheduler para processar a campanha ativa ou a finalização do processo de inserção de publicações.

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
