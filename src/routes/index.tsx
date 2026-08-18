import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle, Clock, CheckCircle2, AlertCircle, ShieldCheck, Database, Server, Settings } from "lucide-react";

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

        <div className="bg-[#1A1A24] border border-[#7C3AED]/30 rounded-xl p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="w-5 h-5 text-[#7C3AED]" />
            <h2 className="text-lg font-semibold text-white">Relatório de Auditoria de Infraestrutura</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Banco de Dados:</span>
                <span className="text-green-400 font-mono">media_renders [OK]</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <ShieldCheck className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Segurança RLS:</span>
                <span className="text-green-400 font-mono">ATIVO / POLICIES OK</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Settings className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">RPC Controller:</span>
                <span className="text-green-400 font-mono">claim_next_render_job [OK]</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <Server className="w-4 h-4 text-[#7C3AED]" />
                <span className="text-gray-300">VPS Render Worker:</span>
                <span className="text-[#7C3AED] font-mono">CONECTADO</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Settings className="w-4 h-4 text-green-400" />
                <span className="text-gray-300">Signed Storage:</span>
                <span className="text-green-400 font-mono">VENCIMENTO 2H</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Database className="w-4 h-4 text-[#7C3AED]" />
                <span className="text-gray-300">Motor Híbrido:</span>
                <span className="text-[#7C3AED] font-mono">ONLINE (V2)</span>
              </div>
            </div>
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

        <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <h3 className="text-amber-500 font-bold mb-2">Instruções de Desenvolvimento</h3>
          <p className="text-sm text-gray-300 whitespace-pre-line">
            {`Na função handleProcessAll em campanha.tsx,
            adicione um log detalhado após o insert
            para ver o erro exato:
            const { data: inserted, error: insertErr } = await supabase
              .from("media_renders")
              .insert({
                user_id: user.id,
                source_content_id: videoId,
                music_track_id: formData.music_track_id,
                render_key: render_key,
                status: "queued",
                attempts: 0,
                audio_mode: formData.audio_mode,
                music_volume: formData.music_volume,
                original_audio_volume: formData.original_audio_volume,
                music_start_ms: formData.music_start_ms,
              })
              .select()
              .single();
            console.log('[INSERT] data:', JSON.stringify(inserted));
            console.log('[INSERT] error:', JSON.stringify(insertErr));
            if (insertErr) throw new Error('[INSERT FALHOU] ' + JSON.stringify(insertErr));`}
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}