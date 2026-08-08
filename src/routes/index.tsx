import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Heart, 
  MessageSquare, 
  Share2, 
  Activity, 
  Lightbulb,
  ArrowUpRight,
  Sparkles,
  Music2,
  Play
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [stats, setStats] = useState({
    views: "0",
    likes: "0",
    comments: "0",
    shares: "0"
  });

  useEffect(() => {
    async function fetchActiveCampaign() {
      try {
        const { data, error } = await supabase
          .from("campanhas")
          .select("*, music_tracks(nome, artista), artists(name)")
          .eq("status", "ativo")
          .maybeSingle();
        
        if (error) throw error;
        setActiveCampaign(data);
      } catch (err: any) {
        console.error("Erro ao buscar campanha:", err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchActiveCampaign();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-space font-bold tracking-tight text-white mb-2">Operações</h1>
            <p className="text-slate-400 text-lg">Central de comando Flux Post — Gravadora Sourcee</p>
          </div>
          <div className="flex items-center gap-3 bg-[#13131F] p-1.5 rounded-full border border-white/5">
            <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-4 py-1.5 text-sm font-medium">
              <Activity className="w-3.5 h-3.5 mr-2" />
              Sistemas Operantes
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-space font-semibold text-white flex items-center gap-2">
                  <Activity className="text-purple-500 w-5 h-5" />
                  Campanha em Andamento
                </h2>
                {activeCampaign && (
                  <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 px-3">
                    Operacional
                  </Badge>
                )}
              </div>
              
              <Card className="bg-[#13131F] border-white/5 overflow-hidden group hover:border-purple-500/20 transition-all duration-300">
                <CardContent className="p-0">
                  {activeCampaign ? (
                    <div className="p-8 space-y-6">
                      <div className="flex flex-col md:flex-row justify-between gap-6">
                        <div className="space-y-4">
                          <div className="space-y-1">
                            <span className="text-xs font-bold text-purple-400 uppercase tracking-widest">Ativa agora</span>
                            <h3 className="text-3xl font-space font-bold text-white">{activeCampaign.nome}</h3>
                          </div>
                          <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5 w-fit">
                            <div className="bg-purple-500/20 p-2 rounded-lg">
                              <Music2 className="text-purple-400 w-5 h-5" />
                            </div>
                            <div>
                              <p className="text-white font-medium">{activeCampaign.music_tracks?.nome || 'Música'}</p>
                              <p className="text-slate-400 text-xs">{activeCampaign.artists?.name || activeCampaign.music_tracks?.artista || 'Artista'}</p>
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center min-w-[120px]">
                            <p className="text-slate-400 text-xs mb-1">Posts Hoje</p>
                            <p className="text-2xl font-space font-bold text-white">0</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-2xl border border-white/5 text-center min-w-[120px]">
                            <p className="text-slate-400 text-xs mb-1">Total</p>
                            <p className="text-2xl font-space font-bold text-white">0</p>
                          </div>
                        </div>
                      </div>
                      <div className="pt-6 border-t border-white/5 flex items-center justify-between text-sm">
                        <span className="text-slate-400">Aguardando <span className="text-white font-medium">automação</span></span>
                        <div className="flex items-center gap-2 text-emerald-400">
                          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                          TikTok / Instagram / Shorts
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-12 text-center space-y-6">
                      <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-500">
                        <Sparkles className="w-10 h-10 text-slate-700" />
                      </div>
                      <div className="max-w-xs mx-auto space-y-2">
                        <h3 className="text-white font-space font-bold text-xl">Nenhuma campanha ativa</h3>
                        <p className="text-slate-500 text-sm">Inicie uma nova campanha para começar a distribuir conteúdos.</p>
                      </div>
                      <button className="bg-purple-600 hover:bg-purple-700 text-white px-8 py-3 rounded-xl font-medium transition-all transform hover:scale-105 shadow-xl shadow-purple-500/10">
                        Configurar Nova Campanha
                      </button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-space font-semibold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="text-purple-500 w-5 h-5" />
                Performance Global
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Visualizações", value: stats.views, icon: Play, color: "text-blue-400" },
                  { label: "Curtidas", value: stats.likes, icon: Heart, color: "text-rose-400" },
                  { label: "Comentários", value: stats.comments, icon: MessageSquare, color: "text-emerald-400" },
                  { label: "Partilhas", value: stats.shares, icon: Share2, color: "text-purple-400" },
                ].map((stat, i) => (
                  <Card key={i} className="bg-[#13131F] border-white/5 hover:border-white/10 transition-colors">
                    <CardContent className="p-5 space-y-3">
                      <div className={`p-2 rounded-lg bg-white/5 w-fit ${stat.color}`}>
                        <stat.icon className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs mb-1 font-medium">{stat.label}</p>
                        <p className="text-2xl font-space font-bold text-white leading-none">{stat.value}</p>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
                        <ArrowUpRight className="w-3 h-3" />
                        0%
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-space font-semibold text-white mb-6 flex items-center gap-2">
                <Lightbulb className="text-purple-500 w-5 h-5" />
                Flux Intelligence
              </h2>
              <Card className="bg-gradient-to-br from-[#13131F] to-[#0A0A0F] border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Sparkles className="w-16 h-16 text-purple-500" />
                </div>
                <CardContent className="p-8 space-y-6 relative z-10">
                  <div className="space-y-4">
                    <div className="p-4 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                      <p className="text-purple-300 text-sm leading-relaxed italic">
                        "Aguardando dados suficientes para gerar recomendações."
                      </p>
                    </div>
                  </div>
                  <div className="pt-4">
                    <button className="w-full bg-white/5 hover:bg-white/10 text-white py-3 rounded-xl text-sm font-medium border border-white/10 transition-all flex items-center justify-center gap-2 group">
                      Gerar Relatório IA
                      <ArrowUpRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-all" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section>
              <h2 className="text-xl font-space font-semibold text-white mb-6">Contas Conectadas</h2>
              <div className="space-y-3">
                <div className="py-8 text-center border border-dashed border-white/10 rounded-2xl">
                  <p className="text-white/40 text-sm">Nenhuma conta conectada</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

