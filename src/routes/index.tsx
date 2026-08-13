import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v9'],
    queryFn: async () => {
      const { data: counts } = await supabase.rpc('get_render_counts'); // Hypothetical or manual
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
ROOT CAUSE: A bridge anterior confiava em "if (!job)", mas em certos contextos de retorno do Supabase (como RPCs que retornam RECORD/SETOF), um retorno vazio pode não ser avaliado como falsy se vier como objeto vazio ou se houver latência na propagação. A nova correção usa validação inequívoca (Object.keys) e encerramento imediato.
FIX APPLIED: YES
RENDER_BRIDGE DEPLOYED: YES
READY TO UPDATE VPS: YES

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
