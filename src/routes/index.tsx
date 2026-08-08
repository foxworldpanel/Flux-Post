import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Heart, MessageSquare, Share2, Play } from "lucide-react";
import { socialService } from "@/services/social";

export default function Index() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalAccounts: 0, connected: 0, disconnected: 0 });

  const loadStats = async () => {
    try {
      const accounts = await socialService.getAccounts();
      setStats({
        totalAccounts: accounts.length,
        connected: accounts.filter((a: any) => a.connection_status === 'conectada').length,
        disconnected: accounts.filter((a: any) => a.connection_status === 'nao_conectada').length
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-8">
          <div>
            <h1 className="text-4xl font-space font-bold tracking-tight text-white mb-2">Operações</h1>
            <p className="text-slate-400 text-lg">Central de comando Flux Post</p>
          </div>
        </div>

        <div className="bg-[#13131F]/50 border border-white/5 rounded-2xl p-6">
          <Badge className="bg-purple-600 mb-4">FASE 3.1 — CENTRAL DE CONTAS SOCIAIS</Badge>
          <div className="text-sm text-slate-300 font-mono leading-relaxed space-y-2">
            <p>O Flux Post iniciou a <strong>Fase 3: Distribuição</strong>.</p>
            <p>A central de contas sociais foi arquitetada para suportar múltiplas plataformas, perfis editoriais, e estratégias de postagem.</p>
            <ul className="list-disc pl-5 mt-2 space-y-1 text-slate-400">
              <li>Reutilização da tabela <em>social_accounts</em>.</li>
              <li>Configuração de perfil editorial, categorias e posts/dia por conta.</li>
              <li>Preparação para OAuth em fases futuras.</li>
            </ul>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <section>
              <h2 className="text-xl font-space font-semibold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="text-purple-500 w-5 h-5" />
                Performance das Contas
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "Total", value: stats.totalAccounts, icon: Play },
                  { label: "Conectadas", value: stats.connected, icon: Heart },
                  { label: "Não Conectadas", value: stats.disconnected, icon: MessageSquare },
                  { label: "Posts Hoje", value: "0", icon: Share2 },
                ].map((stat, i) => (
                  <Card key={i} className="bg-[#13131F] border-white/5">
                    <CardContent className="p-5 space-y-2">
                      <div className="flex items-center gap-2">
                         <stat.icon className="w-4 h-4 text-purple-400" />
                         <span className="text-xs text-slate-500 uppercase">{stat.label}</span>
                      </div>
                      <p className="text-2xl font-bold text-white">{stat.value}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          </div>

          <div className="space-y-8">
            <section>
              <h2 className="text-xl font-space font-semibold text-white mb-6">Estoque Inteligente</h2>
              <Card className="bg-[#13131F] border-white/5">
                <CardContent className="p-6">
                  <p className="text-slate-400 text-sm">Aguardando sincronização de dados reais da Fase 2.2.</p>
                </CardContent>
              </Card>
            </section>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

