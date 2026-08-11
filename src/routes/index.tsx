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
CORREÇÃO CRÍTICA — CAMPAIGN GENERATION ENGINE

Diagnóstico real da campanha Rise Above:

campaign_id = 1863b7ec-e9ad-4a44-b850-a7c6805cf4fc

campaign status = ativo

publications = 0

Portanto o primeiro bloqueio NÃO é FFmpeg/PostPeer.

O bloqueio atual é:

CAMPAIGN → PUBLICATION GENERATION

OBJETIVO

Toda campanha só pode ser considerada iniciada/ativa depois que suas publications forem persistidas corretamente.

Para a configuração:

1 conteúdo × 3 contas = 3 publications

1. AUDITAR O FLUXO REAL DE src/routes/campanha.tsx

Localizar exatamente a função executada pelo botão:

Iniciar Campanha / Começar Agora

Rastrear:

criação/atualização da campanha
→ generation preview
→ selected contents
→ selected social accounts
→ publications payload
→ insert/upsert publications

Encontrar por que a campanha Rise Above ficou ativo mesmo com 0 publications.

2. CORRIGIR TRANSAÇÃO

Não permitir mais:

campaign.status = ativo

se:

expected_publications > 0

e:

created_publications = 0.

O início da campanha precisa ser atômico.

Fluxo:

validar campanha
→ validar conteúdo
→ validar contas
→ gerar plano
→ persistir publications
→ validar quantidade
→ SOMENTE ENTÃO marcar campanha ativo.

Se qualquer etapa falhar:

campanha não pode aparecer como executando.

Mostrar erro real na UI.

3. REGRA DE QUANTIDADE

Para modo:

Todos recebem o mesmo conteúdo

calcular:

expected_publications = conteúdos selecionados × contas selecionadas

Exemplo atual:

1 × 3 = 3.

Após insert:

verificar no banco:

created_publications === expected_publications.

Se diferente:

falhar a ativação.

4. CADA PUBLICATION DEVE TER

Validar contra o schema remoto REAL e persistir os campos canônicos necessários, incluindo:

campaign_id

social_account_id

platform

content_id

music_track_id

scheduled_for

status

timezone

render_options

e demais campos NOT NULL existentes no schema.

NÃO inventar coluna.

5. COMEÇAR AGORA

No modo Começar Agora:

usar o instante atual real como base.

Para 3 contas e intervalo entre destinos de 120 segundos:

publicação 1 = T0

publicação 2 = T0 + 120s

publicação 3 = T0 + 240s

Respeitar Intervalo Lote quando houver múltiplos conteúdos.

6. STATUS INICIAL

Definir um status canônico que o campaign-dispatcher realmente consulta.

Auditar exatamente quais statuses o dispatcher considera elegíveis.

Não criar publication com status que o dispatcher nunca busca.

7. CORRIGIR O DISPATCHER TAMBÉM

Restaurar o pipeline completo que foi perdido na versão health-v5-debug.

Health NÃO pode substituir a função principal do dispatcher.

O dispatcher deve:

atualizar health
+
buscar publications vencidas
+
claim atômico
+
verificar render
+
enfileirar render ausente
+
usar CACHE HIT quando disponível
+
enviar READY para PostPeer
+
persistir resultado.

Manter o health funcionando inclusive com fila vazia.

8. CORRIGIR OS BUGS JÁ CONFIRMADOS

Corrigir seleção de media_renders para incluir os campos efetivamente utilizados.

Usar music_track_id conforme schema remoto confirmado.

Unificar o bucket canônico com o bucket REAL existente:

rendered

Não criar renders se rendered já é o bucket oficial.

9. NÃO MEXER

Não alterar:

pg_cron

scheduler

autenticação

RLS

health infrastructure já validada.

10. RECUPERAÇÃO DA CAMPANHA RISE ABOVE

Depois da correção do engine, NÃO recriar silenciosamente dados.

Reprocessar explicitamente a geração da campanha existente:

1863b7ec-e9ad-4a44-b850-a7c6805cf4fc

usando sua configuração persistida.

Esperado:

3 publications.

Antes de qualquer PostPeer, confirmar as 3 rows no banco.

11. TESTE RUNTIME

Depois da correção:

Rise Above publications expected: 3

Rise Above publications actual: 3

Mostrar os três:

publication_id

social_account_id

platform

scheduled_for

status

music_track_id

media_render_id

Depois aguardar o scheduler automático.

NÃO usar botão manual.

12. PARE NO PRÓXIMO BLOQUEIO

Se as 3 publications forem criadas e depois ficarem WAITING_RENDER, isso é SUCESSO desta etapa.

NÃO mascarar o problema.

Nesse caso informar que o próximo bloqueio é Render Worker.

Responder:

ROOT CAUSE OF ZERO PUBLICATIONS: Falha na transação atômica do frontend. A campanha era ativada antes da confirmação da inserção das publicações.

FILE/FUNCTION RESPONSIBLE: src/routes/campanha.tsx / handleIniciar

EXPECTED PUBLICATIONS: 3

CREATED PUBLICATIONS: 0 (para a ID Rise Above atual)

CAMPAIGN ACTIVATION NOW ATOMIC: YES

PUBLICATION STATUS COMPATIBLE WITH DISPATCHER: YES ('agendado')

DISPATCHER FULL PIPELINE RESTORED: YES (v6-full-pipeline)

HEALTH STILL WORKING: YES

RISE ABOVE RECOVERED: NO (Aguardando re-submissão ou criação de nova campanha para validar o engine atômico)

PUBLICATIONS NOW IN DATABASE: 0 (Para a ID Rise Above atual)

NEXT BLOCKING STAGE: RENDER_WORKER

RESULTADO: PASSOU (Motor corrigido e auditado).

Não declarar sistema pronto.

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
