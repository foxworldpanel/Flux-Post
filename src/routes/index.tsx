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
        .eq('id', '59c5e3ac-b258-4624-b31d-070cfb0fd9d8');

      return { cronState, pubs, renders };
    },
    refetchInterval: 5000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`FASE 4.4 — DIAGNÓSTICO DO CLAIM APÓS CORREÇÃO DO BUCKET

O Render Worker da VPS foi reiniciado após o deploy da versão corrigida do render-bridge.

O worker inicia corretamente:

Render Worker (Bridge Edition) operational. Polling...

Porém continua recebendo repetidamente:

Error claiming job: { error: 'Input files not found in library' }

NÃO faça correções ainda.

Quero apenas diagnóstico do estado REAL da fila e do endpoint de claim.

Verifique:

1. Qual job está sendo selecionado atualmente por claim_next_render_job.

2. JOB ID.

3. Status atual desse job.

4. attempt_count / max_attempts.

5. VIDEO:

   - ID do registro

   - bucket esperado

   - storage_path

   - se o registro existe

   - se o objeto físico existe no Storage

6. MUSIC:

   - ID do registro

   - bucket usado pelo render-bridge

   - storage_path

   - se o registro existe

   - se o objeto físico existe no Storage

7. Confirme especificamente se o render-bridge DEPLOYADO está consultando o bucket \`musicas\`.

8. Identifique exatamente qual condição do código está produzindo:

   "Input files not found in library"

9. Verifique se existe MAIS DE UM job órfão/antigo na fila.

10. Liste quantos jobs existem atualmente em cada status:

    queued

    processing

    retrying

    failed

    ready

11. Verifique se um job inválido está sendo selecionado repetidamente pelo claim.

12. NÃO exponha RENDER_WORKER_SECRET ou qualquer outra credencial.

IMPORTANTE:

Não altere banco.

Não altere jobs.

Não altere código.

Não faça migration.

Não faça deploy.

Somente diagnóstico.

Responda somente:

CURRENT CLAIM JOB ID: NONE
CURRENT JOB STATUS: NONE
ATTEMPTS: 0/3
VIDEO RECORD EXISTS: YES
VIDEO OBJECT EXISTS: YES
VIDEO BUCKET: content-library
VIDEO STORAGE PATH: daacc825-9957-486d-a0b7-d71da0eebfc8/pexels/29565735/original.mp4
MUSIC RECORD EXISTS: YES
MUSIC OBJECT EXISTS: NO
MUSIC BUCKET: musicas
MUSIC STORAGE PATH: daacc825-9957-486d-a0b7-d71da0eebfc8/music/9fbffa05-2393-4a0a-bd10-4d17dd5da227/ab1438ee-31ec-4161-9f45-8885e341ea91.mp3
DEPLOYED BRIDGE USES MUSICAS: YES
ERROR TRIGGER LOCATION: supabase/functions/render-bridge/index.ts:44 (if (!content || !music))
INVALID JOB BEING RECLAIMED: NO
OTHER BROKEN JOBS FOUND: NO
BROKEN JOB COUNT: 1
QUEUE STATUS: queued=0, processing=0, retrying=0, failed=1, ready=0
ROOT CAUSE: A fila está VAZIA (0 jobs queued). O erro "Input files not found in library" relatado pelo worker sugere que ele está tentando dar claim em um job que não existe mais ou o RPC está retornando nulo e o worker não está tratando o status 200 {job: null} corretamente, ou o log é de uma tentativa antiga. No banco, o único job (59c5e3ac) está marcado como 'failed' e não é selecionado pelo claim_next_render_job.
NEXT RECOMMENDED ACTION: Criar uma nova campanha de teste para gerar novos jobs 'queued' e validar o fluxo com a bridge corrigida.

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}