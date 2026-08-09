
import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Heart, MessageSquare, Share2, Play, ShieldCheck, Lock, Key, Server, RefreshCw } from "lucide-react";
import { socialService } from "@/services/social";

export default function Index() {
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
          <Badge className="bg-blue-600 mb-4 text-[10px] uppercase font-bold flex w-fit items-center gap-1">
            <ShieldCheck className="w-3 h-3" />
            FASE 3.2A — HARDENING DE SEGURANÇA CONCLUÍDO
          </Badge>
          <div className="text-sm text-slate-300 font-mono leading-relaxed space-y-4">
            <p className="text-blue-400 font-bold border-b border-white/5 pb-2">
              Auditoria de segurança e blindagem de tokens concluída.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <p className="flex items-center gap-2 text-white text-xs">
                  <Lock className="w-3 h-3 text-blue-500" />
                  CRIPTOGRAFIA AES-GCM
                </p>
                <p className="text-[11px] text-slate-400">
                  Tokens agora são criptografados em repouso usando Web Crypto API (Deno) com IV aleatório por entrada. Sem fallbacks de chave.
                </p>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-white text-xs">
                  <Server className="w-3 h-3 text-blue-500" />
                  DISCONNECT SERVER-SIDE
                </p>
                <p className="text-[11px] text-slate-400">
                  Fluxo de desconexão movido para Edge Function. Frontend não possui mais privilégios de DELETE em credenciais.
                </p>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-white text-xs">
                  <RefreshCw className="w-3 h-3 text-blue-500" />
                  REFRESH TOKEN AUTOMÁTICO
                </p>
                <p className="text-[11px] text-slate-400">
                  Implementada Edge Function <code>tiktok-token-refresh</code> para renovação segura de tokens sem exposição ao cliente.
                </p>
              </div>

              <div className="space-y-2">
                <p className="flex items-center gap-2 text-white text-xs">
                  <Key className="w-3 h-3 text-blue-500" />
                  PROTEÇÃO DE CALLBACK
                </p>
                <p className="text-[11px] text-slate-400">
                  Validação atômica de State (single-use), verificação de duplicidade de conta e sanitização rigorosa de logs de produção.
                </p>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-white/5 flex flex-wrap gap-4 text-[10px] text-slate-500 italic uppercase tracking-wider">
              <span>Algoritmo: AES-GCM (256-bit)</span>
              <span>•</span>
              <span>Scope: user.info.basic</span>
              <span>•</span>
              <span>Status: Pronto para Credenciais Reais</span>
            </div>
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
