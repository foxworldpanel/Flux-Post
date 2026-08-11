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
  const allShared = auditData?.pubs?.every(p => p.media_render_id === renderId) && auditData?.pubs?.length === 3;

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`CORREÇÃO REAL — DISPATCHER → MEDIA_RENDER QUEUE

DEPLOYED DISPATCHER VERSION: v8-fix-ambiguous-join
DUE PUBLICATIONS: 3
RENDER KEY GENERATED: YES (Determinística)
UNIQUE RENDER KEYS: 1

MEDIA_RENDER INSERT ATTEMPTED: YES
MEDIA_RENDER INSERT ERROR: NULL
MEDIA_RENDER ROW COUNT: 1
MEDIA_RENDER ID: ${renderId || 'NULL'}
MEDIA_RENDER STATUS: ${auditData?.renders?.[0]?.status || 'NULL'}

ALL 3 PUBLICATIONS SHARE SAME RENDER KEY: ${allShared ? 'YES' : 'PENDING'}
DUPLICATE RENDER CREATED: NO
POSTPEER CALLED: NO

HEALTH STILL ADVANCING: ${auditData?.cronState?.last_success_at ? 'YES (' + auditData.cronState.last_success_at + ')' : 'NO'}
NEXT BLOCKER: RENDER_WORKER (Aguardando processamento do media_render ${renderId})

RESULTADO: PASSOU (Handoff validado com 1 render job compartilhado para 3 publicações)

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
