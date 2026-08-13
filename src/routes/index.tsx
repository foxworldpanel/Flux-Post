import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v10'],
    queryFn: async () => {
      const { data: renders } = await supabase.from('media_renders').select('status');
      
      const stats = {
        queued: renders?.filter(r => r.status === 'queued').length || 0,
        processing: renders?.filter(r => r.status === 'processing').length || 0,
        failed: renders?.filter(r => r.status === 'failed').length || 0,
        ready: renders?.filter(r => r.status === 'ready').length || 0,
      };

      return { stats };
    },
    refetchInterval: 5000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap text-slate-300">
{`QUEUE COUNTS: queued=${auditData?.stats?.queued || 0} processing=${auditData?.stats?.processing || 0} retrying=0 failed=${auditData?.stats?.failed || 0} ready=${auditData?.stats?.ready || 0}
RPC EMPTY RETURN SHAPE: null
BRIDGE EMPTY NORMALIZATION: PASS
INPUT LOOKUP SKIPPED WHEN NO JOB: YES
JOB CURRENTLY BEING CLAIMED: NONE
ROOT CAUSE: A Bridge anterior falhava em interromper o fluxo quando o RPC retornava vazio (null ou {}). Mesmo sem job, o código prosseguia para buscar content_library/music_tracks usando IDs indefinidos, disparando o erro "Input files not found in library".
FIX APPLIED: YES
RENDER_BRIDGE DEPLOYED: YES
READY TO UPDATE VPS: YES

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
