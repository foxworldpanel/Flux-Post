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
{`CORREÇÃO REAL — DISPATCHER → MEDIA_RENDER QUEUE

Auditoria externa confirmou no HEAD atual do GitHub que o campaign-dispatcher NÃO possui criação automática de render jobs.

NÃO mexer em:
Campaign Generation Engine
pg_cron
scheduler
RLS
grants
autenticação
PostPeer
frontend

O código REAL atual faz:
publication com music_track_id
→ procura media_render status=ready
→ se não encontrar:
results.push({ status: 'waiting_render' })
→ continue

Isso significa que NENHUM media_render é criado.

CORRIGIR SOMENTE O HANDOFF DISPATCHER → MEDIA_RENDERS.

Para publication DUE que necessita render:
Calcular render_key determinística usando no mínimo:
content_id
music_track_id
render_options

A serialização precisa ser estável para que as mesmas opções sempre produzam a mesma key.
Procurar media_render existente pela render_key.

Se READY:
CACHE HIT
→ vincular media_render_id à publication
→ continuar pipeline para PostPeer.

Se PENDING/QUEUED/PROCESSING:
→ não criar outro
→ publication permanece aguardando esse mesmo render.

Se não existir:
→ criar exatamente UMA row em media_renders.

Usar o schema REMOTO REAL de media_renders.
Antes do INSERT, listar internamente as colunas existentes e montar payload compatível.
NÃO inventar coluna.
Usar music_track_id, já confirmado como canônico.
Usar o bucket canônico:
rendered

O status inicial precisa ser exatamente o status que claim_next_render_job / Render Worker reconhece.
Auditar o contrato real antes de escolher entre:
pending
queued
Não criar um novo status.

IDEMPOTÊNCIA
As três publications atuais:
69c662fa-b38f-4d58-a01c-33780af158fd
e0a5ee1b-699a-4d29-97ca-c4d55b0c4f68
f7970c38-c913-4687-90a6-48dcbcfd2efc

possuem o mesmo:
content_id:
d8a37a07-83fb-4a17-8e3d-7eb59e380c4d
music_track_id:
19e4e8fa-1ff2-486c-85b9-ed8b0f38124e

Portanto devem produzir:
3 publications
→ 1 render_key
→ 1 media_render
NUNCA 3 renders idênticos.

Adicionar proteção real de concorrência no banco para render_key UNIQUE se ainda não existir.
Não depender apenas de SELECT → INSERT porque dois ciclos/workers podem concorrer.
NÃO marcar publication como publishing enquanto render não estiver READY.

Enquanto render estiver:
pending/queued/processing
a publication pode permanecer agendado/waiting_render conforme contrato atual.

Quando render ficar READY:
dispatcher do próximo ciclo deve:
encontrar CACHE HIT
→ preencher publications.media_render_id
→ adquirir claim da publication
→ chamar postpeer-post-create.

CORRIGIR O HEALTH SOMENTE SE NECESSÁRIO PARA PRESERVAR A VERSÃO VALIDADA.
Não reintroduzir early return de fila vazia.
O health já foi validado e não deve regredir.

DEPLOY REAL
Após alteração:
fazer deploy do campaign-dispatcher.
Depois verificar que o código deployado contém a lógica nova.
Não basta alterar workspace.

TESTE RUNTIME AUTOMÁTICO
NÃO chamar dispatcher manualmente.
Aguardar cron.

Para a campanha:
fa6b3d03-9499-488e-a333-6b7e2262b24a

confirmar:
DUE PUBLICATIONS: 3
UNIQUE RENDER KEYS: 1
MEDIA_RENDER ROWS CREATED: 1
MEDIA_RENDER ID:
MEDIA_RENDER STATUS:
<pending/queued conforme contrato>

PUBLICATION 1 WAITING SAME RENDER: YES
PUBLICATION 2 WAITING SAME RENDER: YES
PUBLICATION 3 WAITING SAME RENDER: YES

POSTPEER CALLED: NO
Neste estágio PostPeer NÃO deve ser chamado porque o render ainda não está READY.

CRITÉRIO DE APROVAÇÃO
PASSOU somente se:
3 publications reais
+
1 única render_key
+
1 único media_render real
+
nenhum render duplicado
+
cron automático criou/encontrou o job
+
PostPeer ainda não foi chamado.

Se media_render não for criado:
FALHOU.
Mostrar o erro real do INSERT/RPC e PARE.

RESPOSTA:

DEPLOYED DISPATCHER VERSION:

DUE PUBLICATIONS:

RENDER KEY GENERATED:

UNIQUE RENDER KEYS:

MEDIA_RENDER INSERT ATTEMPTED:

MEDIA_RENDER INSERT ERROR:

MEDIA_RENDER ROW COUNT:

MEDIA_RENDER ID:

MEDIA_RENDER STATUS:

ALL 3 PUBLICATIONS SHARE SAME RENDER KEY:

DUPLICATE RENDER CREATED:

POSTPEER CALLED:

HEALTH STILL ADVANCING:

NEXT BLOCKER:

RESULTADO:

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
