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
        .eq('source_content_id', 'd8a37a07-83fb-4a17-8e3d-7eb59e380c4d')
        .eq('music_track_id', '19e4e8fa-1ff2-486c-85b9-ed8b0f38124e');

      return { cronState, pubs, renders };
    },
    refetchInterval: 5000,
  });

  const renderId = auditData?.renders?.[0]?.id;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`FASE 4 — RENDER WORKER FFmpeg SERVER-SIDE

O handoff foi validado.

Existe um job REAL aguardando processamento:
media_render_id = 59c5e3ac-b258-4624-b31d-070cfb0fd9d8
status = queued

Ele é compartilhado por 3 publications.

NÃO alterar:
 Campaign Engine
 campaign-dispatcher v8
 pg_cron
 scheduler
 health
 PostPeer
 frontend
 RLS/grants

1. Auditar worker atual
O diretório /workers/render-worker/ contém apenas Dockerfile e README.md. O CÓDIGO FONTE (index.js, package.json, etc.) está AUSENTE no workspace atual.

2. Auditar o job real (59c5...)
VIDEO INPUT: YES (source_content_id: d8a37a07)
MUSIC INPUT: YES (music_track_id: 19e4e8fa)
RENDER OPTIONS: YES (music_start_ms: 30000, profile: short_vertical_v1)
STORAGE PATHS: YES (content_library.storage_path e music_tracks.storage_path)

3. Contrato
O status 'queued' é compatível. O fluxo de transição está mapeado na media_renders.

4. FFmpeg
Configuração pendente de implementação (código ausente).

5. STORAGE
INPUT VIDEO: content-library / daacc825.../original.mp4
INPUT MUSIC: music-tracks / (path existente)
OUTPUT BUCKET: rendered

6. Segurança
Ambiente Supabase Cloud não permite execução de containers Docker arbitrários com FFmpeg 24/7.

7. Infraestrutura
LOVABLE CLOUD NÃO EXECUTA DOCKER WORKERS 24/7.
Requer infraestrutura externa (VPS, AWS ECS, ou DigitalOcean App Platform).

Responder:
WORKER CODE COMPLETE: NO (Arquivos index.js/package.json ausentes)
DOCKERFILE READY: YES
FFMPEG INCLUDED: YES (via apt-get no Dockerfile)
CLAIM RPC READY: NO (RPC claim_next_render_job não detectada)
JOB 59c5... HAS VIDEO INPUT: YES
JOB HAS MUSIC INPUT: YES
JOB HAS RENDER OPTIONS: YES
OUTPUT BUCKET: rendered
EXPECTED OUTPUT FORMAT: MP4 (Vertical)
RETRY IMPLEMENTED: NO
WORKER CAN RUN 24/7 IN CURRENT INFRASTRUCTURE: NO
EXTERNAL INFRASTRUCTURE REQUIRED: YES
RECOMMENDED DEPLOY TARGET: DigitalOcean / AWS / Railway
MISSING ITEMS BEFORE DEPLOY: Código fonte do worker (index.js), implementação do claim RPC.

NEXT ACTION: Escrever o código fonte do Render Worker e a RPC de claim.

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}