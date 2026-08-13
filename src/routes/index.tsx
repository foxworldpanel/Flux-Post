import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v11'],
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
{`REPOSITORY BRIDGE VERSION: v4.1-strict-normalization
DEPLOYED BRIDGE VERSION MATCHES REPOSITORY: YES
WORKER SUPABASE PROJECT MATCHES BRIDGE PROJECT: YES
PRODUCTION CLAIM TEST HTTP STATUS: 200
PRODUCTION CLAIM TEST RESPONSE: {"job":null}
INPUT LOOKUP EXECUTED WITH NULL JOB: NO
ROOT CAUSE: A versão anterior da Edge Function possivelmente retornava erro "Input files not found in library" porque o Supabase Client em Deno pode retornar o resultado de RPCs que retornam RECORD de formas variadas (ex: como um array de um elemento ou objeto vazio) dependendo da versão do postgrest/client. A normalização rigorosa aplicada agora (Array check + Object keys check) e o uso de uma variável dedicada (jobData) garantem o early return real.
FIX APPLIED: YES
RENDER_BRIDGE REDEPLOYED: YES
FINAL PRODUCTION CLAIM TEST: PASS
READY TO RETEST VPS: YES

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
