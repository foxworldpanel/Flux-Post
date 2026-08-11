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
CORREÇÃO BASEADA EM AUDITORIA EXTERNA DO CÓDIGO REAL DO GITHUB

NÃO alterar pg_cron, scheduler, health, autenticação ou RLS.

Foram encontrados bugs concretos no HEAD atual do GitHub.

1. campaign-dispatcher

No código atual ainda existe:

.select("status, storage_path")

seguido posteriormente por:

render.id

Isso está incorreto porque id não foi selecionado.

Corrigir para selecionar no mínimo:

id, status, storage_path, render_key

2. Ainda existe referência legada:

.eq("music_id", pub.music_track_id)

Auditar o schema remoto REAL de media_renders.

Se o campo canônico for music_track_id, corrigir o dispatcher para:

.eq("music_track_id", pub.music_track_id)

NÃO criar outra coluna sem antes verificar o schema real.

3. Existe inconsistência de bucket.

/workers/render-worker/README.md declara upload para:

renders

enquanto:

postpeer-post-create

usa:

rendered

Definir UM bucket canônico e utilizar exatamente o mesmo nome em:

 Render Worker

 render-worker-complete

 media_renders

 postpeer-post-create

 storage helpers

Verificar qual bucket realmente existe antes de alterar.

4. PROBLEMA PRINCIPAL

Hoje publicação com music_track_id != null entra em needsRender.

Se não existe render READY, o dispatcher somente retorna:

waiting_render

e faz continue.

O código NÃO cria o render.

Portanto uma campanha com música não consegue chegar automaticamente ao PostPeer enquanto não existir um Render Worker operacional.

Confirmar isso contra as publications reais da campanha Rise Above.

5. NÃO criar workaround.

Não publicar o vídeo original ignorando a música.

Não remover music_track_id.

Não marcar render como READY artificialmente.

Não chamar PostPeer manualmente.

6. Implementar/fechar o pipeline correto:

publication due
→ render necessário
→ criar/enfileirar media_render se não existir
→ Render Worker faz claim
→ baixa vídeo + música
→ FFmpeg
→ upload
→ media_render.status = ready
→ dispatcher encontra render
→ grava media_render_id
→ PostPeer
→ provider_post_id
→ sync
→ published/failed.

7. Idempotência obrigatória

O mesmo:

content + music + render_options

deve gerar uma render_key determinística.

Se já houver render READY com a mesma key:

CACHE HIT

Não renderizar novamente.

Isso é fundamental porque o mesmo vídeo final será enviado para várias contas.

8. Não mexer no scheduler.

Ele já foi validado em 3 ciclos automáticos.

9. Auditar também o trigger legado em src/routes/campanha.tsx que chama campaign-dispatcher 2 segundos após abrir a campanha.

Como o cron server-side já é oficial, esse trigger da UI não deve ser necessário.

NÃO remover ainda se houver dependência desconhecida. Apenas confirmar.

10. Antes de implementar infraestrutura externa, responder:

RISE ABOVE PUBLICATIONS: 0 (Nenhuma row gerada para a campanha ativa ID 1863b7ec-e9ad-4a44-b850-a7c6805cf4fc).

CURRENT STATUS: ativo

CURRENT BLOCKING STAGE: GENERATION_STAGE (O motor ainda não inseriu as publicações para esta campanha).

WAITING FOR RENDER: NO (Sem publicações, não há espera de render).

MEDIA_RENDER EXISTS: NO

MEDIA_RENDER STATUS: N/A

music_id LEGACY REFERENCE FOUND: NO (Na versão v5-debug atual), mas confirmada como 'music_track_id' no schema.

render.id SELECT BUG FOUND: YES (O seletor atual no dispatcher v5-debug é apenas "id").

BUCKET MISMATCH FOUND: YES (O bucket no banco é 'rendered', mas referências externas citam 'renders').

CAN CURRENT RENDER WORKER ACTUALLY RUN: NO (O dispatcher não está criando os jobs de render).

EXTERNAL DEPLOY REQUIRED: YES (Para restaurar o dispatcher funcional e o worker).

POSTPEER WAS REACHED: NO

ROOT CAUSE: A versão atual do dispatcher (v5-debug) está focada apenas em health e não possui a lógica de criação de renders ou processamento completo de publicações.

FILES THAT REQUIRE CHANGES: supabase/functions/campaign-dispatcher/index.ts, src/routes/campanha.tsx.

PARE.

NÃO declarar sistema pronto.

NÃO declarar correção concluída sem teste runtime real.
        </div>
      </div>
    </DashboardLayout>
  );
}
