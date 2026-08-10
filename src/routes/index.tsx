import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Layers,
  Cpu
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const [stats, setStats] = useState({
    totalRenders: 0,
    readyRenders: 0,
    failedRenders: 0,
    processingRenders: 0
  });

  useEffect(() => {
    async function fetchStats() {
      const { data } = await supabase
        .from('media_renders')
        .select('status');
      
      if (data) {
        setStats({
          totalRenders: data.length,
          readyRenders: data.filter(r => r.status === 'ready').length,
          failedRenders: data.filter(r => r.status === 'failed').length,
          processingRenders: data.filter(r => r.status === 'processing' || r.status === 'queued').length
        });
      }
    }
    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-700">
        <div>
          <h1 className="text-4xl font-bold text-white font-display tracking-tight">Flux Post <span className="text-[#7C3AED]">v3.5</span></h1>
          <p className="text-slate-400 mt-2 text-lg">Central de Processamento e Distribuição Inteligente.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total de Renders</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{stats.totalRenders}</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Layers className="text-primary" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Prontos / Cache</p>
                  <h3 className="text-3xl font-bold text-emerald-500 mt-1">{stats.readyRenders}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Em Fila / Proc.</p>
                  <h3 className="text-3xl font-bold text-blue-500 mt-1">{stats.processingRenders}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Cpu className="text-blue-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Falhas</p>
                  <h3 className="text-3xl font-bold text-red-500 mt-1">{stats.failedRenders}</h3>
                </div>
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <AlertCircle className="text-red-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#13131F] border-white/5 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Zap className="text-yellow-500" size={18} />
                    Media Render Engine Centralizada
                  </CardTitle>
                  <Badge className="bg-[#7C3AED]/20 text-[#7C3AED] border-[#7C3AED]/30">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Fluxo Automático</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Campanhas agora geram automaticamente a chave única de renderização e reutilizam arquivos existentes quando a composição é idêntica.
                    </p>
                  </div>
                  <div className="p-4 rounded-xl bg-white/5 border border-white/5">
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">Processamento Real</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      FFmpeg.wasm operando em regime de engine compartilhada entre o menu Manual e as Campanhas Automáticas.
                    </p>
                  </div>
                </div>
                <div className="pt-4">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-xs font-bold text-slate-500 uppercase">Capacidade do Worker Local</span>
                    <span className="text-xs text-emerald-500">Normal</span>
                  </div>
                  <Progress value={45} className="h-1.5 bg-white/5" />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-[#13131F] border-white/5">
              <CardHeader>
                <CardTitle className="text-white text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <a href="/processar" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
                  <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20">
                    <Play className="text-primary" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Render Manual</p>
                    <p className="text-[10px] text-slate-500">Testar composição única</p>
                  </div>
                </a>
                <a href="/campanha" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
                  <div className="p-2 bg-emerald-500/10 rounded-lg group-hover:bg-emerald-500/20">
                    <Zap className="text-emerald-500" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Nova Campanha</p>
                    <p className="text-[10px] text-slate-500">Distribuição com auto-render</p>
                  </div>
                </a>
                <a href="/agenda" className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
                  <div className="p-2 bg-yellow-500/10 rounded-lg group-hover:bg-yellow-500/20">
                    <Clock className="text-yellow-500" size={16} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Agenda</p>
                    <p className="text-[10px] text-slate-500">Verificar fila de postagens</p>
                  </div>
                </a>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
