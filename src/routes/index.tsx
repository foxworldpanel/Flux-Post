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

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`FASE 4.5 — DIAGNÓSTICO DO PRIMEIRO JOB DO RENDER WORKER

RESULTADOS DA AUDITORIA:

RENDER BRIDGE AUTH: PASS
JOB FOUND: YES
JOB ID: 59c5e3ac-b258-4624-b31d-070cfb0fd9d8

VIDEO RECORD EXISTS: YES
VIDEO OBJECT EXISTS: YES
VIDEO STORAGE PATH: daacc825-9957-486d-a0b7-d71da0eebfc8/pexels/29565735/original.mp4

MUSIC RECORD EXISTS: YES
MUSIC OBJECT EXISTS: NO
MUSIC STORAGE PATH: daacc825-9957-486d-a0b7-d71da0eebfc8/music/9fbffa05-2393-4a0a-bd10-4d17dd5da227/ab1438ee-31ec-4161-9f45-8885e341ea91.mp3

BROKEN INPUT: MUSIC
ORPHAN JOB: YES (Relacionado à campanha legada "Rise Above")
BRIDGE LOOKUP LOGIC CORRECT: NO

ROOT CAUSE:
O erro "Input files not found in library" ocorre porque o \`render-bridge\` tenta buscar a música no bucket \`music-tracks\` (linha 48), mas as músicas reais estão no bucket \`musicas\`. Além disso, o objeto físico da música para este job específico (59c5e3ac) não existe no storage, mesmo que o registro no banco aponte para ele. Este é um job "órfão" da fase de testes da campanha "Rise Above".

RECOMMENDED FIX:
1. Corrigir o bucket name no \`render-bridge\` de \`music-tracks\` para \`musicas\`.
2. O Render Worker deve reportar falha definitiva para jobs onde o arquivo físico não existe, ou o sistema deve limpar jobs órfãos que referenciam arquivos inexistentes.
3. Marcar o job 59c5e3ac como 'failed' manualmente para liberar a fila.

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}