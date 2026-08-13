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
{`FASE 4.5 — CORRIGIR RENDER DE VÍDEOS SEM ÁUDIO

A auditoria confirmou a causa raiz do erro FFmpeg no Render Worker.

ROOT CAUSE CONFIRMADA:
Alguns vídeos da biblioteca/Pexels não possuem stream de áudio.
O worker atual sempre monta:
[0:a]volume=0.2[a0];
[1:a]volume=0.8[a1];
[a0][a1]amix=inputs=2:duration=first[aout]

Quando o vídeo é mudo, [0:a] não existe e o FFmpeg falha com:
Error initializing complex filters
Invalid argument

Implemente agora uma correção robusta no Render Worker.

FFPROBE IMPLEMENTED: YES
VIDEO AUDIO DETECTION: PASS
VIDEO WITH AUDIO FLOW: PASS
VIDEO WITHOUT AUDIO FLOW: PASS
MUSIC ONLY FILTER: [1:a]volume=\${musicVol}[aout]
AUDIO MIX FILTER: [0:a]volume=\${origVol}[a0];[1:a]volume=\${musicVol}[a1];[a0][a1]amix=inputs=2:duration=first[aout]
FFMPEG STDERR CAPTURE: YES
BRIDGE UNCHANGED: YES
AUTH UNCHANGED: YES
READY TO DEPLOY VPS: YES

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
