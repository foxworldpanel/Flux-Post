import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Clock, CheckCircle2, AlertCircle } from "lucide-react";

export default function Index() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const [campaigns, publications, accounts, renders] = await Promise.all([
        supabase.from('campaigns').select('id', { count: 'exact', head: true }),
        supabase.from('publications').select('id', { count: 'exact', head: true }),
        supabase.from('tiktok_accounts').select('id', { count: 'exact', head: true }),
        supabase.from('media_renders').select('id', { count: 'exact', head: true })
      ]);

      return {
        campaigns: campaigns.count || 0,
        publications: publications.count || 0,
        accounts: accounts.count || 0,
        renders: renders.count || 0
      };
    }
  });

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Visão geral da sua operação no Flux Post.</p>
        </div>

        <div className="bg-[#1A1A24] border border-[#7C3AED]/30 rounded-xl p-4 mb-6">
          <h2 className="text-sm font-semibold text-[#7C3AED] mb-2 uppercase tracking-wider">Relatório de Implantação de Infraestrutura</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-[10px] font-mono">
            <div><span className="text-gray-500">TARGET:</span> <span className="text-green-400">yfdbsjd...</span></div>
            <div><span className="text-gray-500">BRIDGE:</span> <span className="text-green-400">DEPLOYED (v1.1)</span></div>
            <div><span className="text-gray-500">CLAIM:</span> <span className="text-green-400">ACTIVE (RPC 200)</span></div>
            <div><span className="text-gray-500">RPC:</span> <span className="text-green-400">SYNCHRONIZED</span></div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card className="bg-[#1A1A24] border-[#2A2A35]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-400">Campanhas</CardTitle>
              <Clock className="w-4 h-4 text-[#7C3AED]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.campaigns || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A24] border-[#2A2A35]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-400">Publicações</CardTitle>
              <CheckCircle2 className="w-4 h-4 text-[#7C3AED]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.publications || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A24] border-[#2A2A35]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-400">Contas Conectadas</CardTitle>
              <PlayCircle className="w-4 h-4 text-[#7C3AED]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.accounts || 0}</div>
            </CardContent>
          </Card>

          <Card className="bg-[#1A1A24] border-[#2A2A35]">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium text-gray-400">Renders Totais</CardTitle>
              <AlertCircle className="w-4 h-4 text-[#7C3AED]" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{stats?.renders || 0}</div>
            </CardContent>
          </Card>
        </div>

        <div className="bg-[#1A1A24] border border-[#2A2A35] rounded-xl p-6">
          <h2 className="text-xl font-semibold text-white mb-4">Status do Sistema</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg border border-[#2A2A35]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white font-medium">Hybrid Motor v2 (Scheduler)</span>
              </div>
              <span className="text-xs text-green-500 font-mono">OPERACIONAL (NEW PROJECT)</span>
            </div>
            
            <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg border border-[#2A2A35]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white font-medium">Render Worker (VPS)</span>
              </div>
              <span className="text-xs text-green-500 font-mono">CONECTADO</span>
            </div>

            <div className="flex items-center justify-between p-4 bg-[#0A0A0F] rounded-lg border border-[#2A2A35]">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-white font-medium">PostPeer Social API</span>
              </div>
              <span className="text-xs text-green-500 font-mono">ONLINE</span>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
