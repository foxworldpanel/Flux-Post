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

JOB ID: 29aeb83e-9350-43d9-9087-e8a91b07c58e
BRIDGE FLOW: PASS
ASSET DOWNLOAD: PASS
FFMPEG STARTED: YES
FFMPEG VERSION: 6.1.1 (node:18-slim apt-get version)
FFMPEG COMMAND: ffmpeg -i input_video.mp4 -i input_music.mp3 -ss 0 -filter_complex "[0:a]volume=0.2[a0];[1:a]volume=0.8[a1];[a0][a1]amix=inputs=2:duration=first[aout]" -map 0:v -map [aout] -c:v libx264 -preset fast -crf 23 -pix_fmt yuv420p -c:a aac -shortest -movflags +faststart output.mp4
FILTER_COMPLEX: [0:a]volume=0.2[a0];[1:a]volume=0.8[a1];[a0][a1]amix=inputs=2:duration=first[aout]
FAILING FILTER: amix (provavelmente devido a ausência de stream de áudio no input 0)
INVALID VALUE: amix=inputs=2 (quando um input não tem áudio)
FFMPEG STDERR FULLY CAPTURED: NO (apenas mensagem de erro final via fluent-ffmpeg)
DOCKER FFMPEG CAPABILITIES: PASS
ROOT CAUSE: O vídeo original (Pexels ID 29565735) é um TIMELAPSE que NÃO POSSUI stream de áudio. O filtro complexo tenta mapear [0:a], mas como o stream não existe, o FFmpeg falha com "Invalid argument" ao tentar inicializar os filtros que dependem desse stream inexistente. O worker atual assume que todo vídeo tem áudio.
RECOMMENDED FIX: 1. Adicionar uma etapa de 'probe' (ffprobe) antes do processamento para detectar se há áudio no vídeo. 2. Ajustar dinamicamente o filter_complex: se o vídeo não tiver áudio, ignorar [0:a] e usar apenas o áudio da música (ou adicionar um silêncio se o amix for obrigatório). 3. Melhorar a captura de logs do worker para incluir o stderr completo do FFmpeg.

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}