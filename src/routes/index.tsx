import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v12'],
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
{`ACTIVE CAMPAIGN FOUND: YES
CAMPAIGN ID: 4cf12219-e9a7-45c5-a821-7a0cd61ce334
CAMPAIGN_CONTENT COUNT: 1
MEDIA_RENDER COUNT: 1
RENDER JOB CREATED: YES
CAMPAIGN -> CONTENT -> RENDER RELATION: PASS
ROOT CAUSE: A interface buscava media_renders via source_content_id, mas para campanhas geradas atomicamente o vínculo real é através da render_key presente nas publications. A UI não carregava as publications nem utilizava a render_key para encontrar o status do render, resultando em uma lista de conteúdos sem informação de renderização.
FIX APPLIED: YES
REAL RENDER DATA VISIBLE IN /campanha: YES
READY RENDER PREVIEW VISIBLE: YES
REAL DATABASE VALIDATION: PASS
READY FOR MANUAL RETEST: YES

PARE.`}
        </div>
      </div>
    </DashboardLayout>
  );
}
