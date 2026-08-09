import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Music, 
  Video, 
  TrendingUp, 
  ShieldCheck, 
  Globe,
  Share2,
  AlertCircle
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Link } from "react-router-dom";

export default function DashboardPage() {
  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        {/* Banner de Status da Fase 3.2B */}
        <div className="bg-[#7C3AED]/10 border border-[#7C3AED]/20 p-6 rounded-2xl flex items-start gap-4">
          <div className="w-12 h-12 rounded-full bg-[#7C3AED]/20 flex items-center justify-center shrink-0">
            <Share2 className="text-[#7C3AED] w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-bold text-white font-space">Fase 3.2B — PostPeer Social Integration</h2>
            <p className="text-slate-400 text-sm leading-relaxed max-w-3xl">
              Infraestrutura PostPeer implementada com sucesso. O Flux Post agora utiliza o PostPeer como provedor principal para conexão de contas sociais (TikTok, Instagram, Facebook e YouTube).
            </p>
            <div className="flex gap-3 pt-2">
              <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                <Globe className="w-3 h-3 mr-1" /> Multi-Plataforma
              </Badge>
              <Badge variant="outline" className="border-purple-500/30 text-purple-400 bg-purple-500/5">
                <ShieldCheck className="w-3 h-3 mr-1" /> SocialProvider Ready
              </Badge>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Artistas" value="0" icon={<Users className="w-5 h-5" />} />
          <MetricCard title="Músicas" value="0" icon={<Music className="w-5 h-5" />} />
          <MetricCard title="Vídeos" value="0" icon={<Video className="w-5 h-5" />} />
          <MetricCard title="Contas Sociais" value="0" icon={<Globe className="w-5 h-5" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-[#13131F] border-white/5 p-8 flex flex-col items-center justify-center text-center space-y-4 py-16">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-white/10">
              <TrendingUp className="text-slate-600 w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold text-white font-space">Aguardando Dados</h3>
            <p className="text-slate-500 max-w-sm">
              Cadastre seus primeiros artistas, músicas e vídeos para começar a visualizar as métricas de performance e campanhas.
            </p>
            <Link to="/artistas">
              <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] mt-4">Começar Agora</Button>
            </Link>
          </Card>

          <Card className="bg-[#13131F] border-white/5 p-8 space-y-6">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-bold text-white font-space">Estoque Inteligente</h3>
              <Badge variant="outline" className="border-amber-500/30 text-amber-400">FASE 2.2</Badge>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-slate-600" />
                  <span className="text-sm text-slate-300">Nenhuma categoria ativa</span>
                </div>
                <span className="text-xs text-slate-500">0/0 vídeos</span>
              </div>
              
              <div className="bg-white/5 border border-dashed border-white/10 p-6 rounded-xl text-center">
                <p className="text-xs text-slate-600 uppercase font-bold tracking-wider mb-2">Relatório de Descoberta</p>
                <p className="text-sm text-slate-500 italic">Configure a automação no Garimpo para gerar dados reais de estoque.</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Diagnóstico de Infraestrutura */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#13131F] border-white/5 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-500" /> Auditoria PostPeer
            </h3>
            <div className="space-y-2">
              <StatusItem label="SocialProvider Abstraction" status="ready" />
              <StatusItem label="Edge Function: postpeer-connect" status="ready" />
              <StatusItem label="Edge Function: postpeer-callback" status="ready" />
              <StatusItem label="Edge Function: disconnect" status="updated" />
              <StatusItem label="TikTok Direct (Fallback)" status="preserved" />
            </div>
          </Card>

          <Card className="bg-[#13131F] border-white/5 p-6 space-y-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-amber-500" /> Próximos Passos
            </h3>
            <p className="text-sm text-slate-400 leading-relaxed">
              A infraestrutura está pronta para testes reais. Certifique-se de configurar a secret <code className="text-purple-400">POSTPEER_API_KEY</code> no Lovable Cloud antes de tentar conectar contas oficiais.
            </p>
            <div className="pt-2">
              <Link to="/accounts">
                <Button variant="outline" className="w-full border-white/10 text-xs">Acessar Central de Contas</Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="bg-[#13131F] border-white/5 p-6 hover:border-[#7C3AED]/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-[#7C3AED]/50 transition-colors">
          {icon}
        </div>
      </div>
      <p className="text-sm text-slate-500 uppercase font-bold tracking-wider">{title}</p>
      <h3 className="text-3xl font-bold text-white mt-1 font-space">{value}</h3>
    </Card>
  );
}

function StatusItem({ label, status }: { label: string; status: 'ready' | 'updated' | 'preserved' }) {
  const colors = {
    ready: 'text-emerald-400 bg-emerald-500/10',
    updated: 'text-purple-400 bg-purple-500/10',
    preserved: 'text-slate-400 bg-white/5'
  };
  
  return (
    <div className="flex justify-between items-center text-xs py-1 border-b border-white/5 last:border-0">
      <span className="text-slate-400">{label}</span>
      <Badge className={`text-[9px] px-1.5 py-0 border-0 ${colors[status]}`}>
        {status.toUpperCase()}
      </Badge>
    </div>
  );
}
