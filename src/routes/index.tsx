import { Card } from "@/components/ui/card";
import { 
  Users, 
  Music, 
  Video, 
  Globe,
  TrendingUp,
  Activity,
  Calendar,
  Layers,
  BarChart3,
  Target,
  ArrowRight,
  ShieldCheck,
  Zap
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    artists: 0,
    musics: 0,
    videos: 0,
    accounts: 0,
    connected: 0,
    publications: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      const [
        { count: artists },
        { count: musics },
        { count: videos },
        { data: accounts },
        { count: publications }
      ] = await Promise.all([
        supabase.from('artists').select('*', { count: 'exact', head: true }),
        supabase.from('music_tracks').select('*', { count: 'exact', head: true }),
        supabase.from('content_library').select('*', { count: 'exact', head: true }),
        supabase.from('social_accounts').select('connection_status'),
        supabase.from('publications').select('*', { count: 'exact', head: true })
      ]);

      setStats({
        artists: artists || 0,
        musics: musics || 0,
        videos: videos || 0,
        accounts: accounts?.length || 0,
        connected: accounts?.filter(a => a.connection_status === 'conectada').length || 0,
        publications: publications || 0
      });
    };
    loadStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-4xl font-bold text-white font-space">Dashboard</h1>
              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px] uppercase tracking-widest font-bold">Operacional</Badge>
            </div>
            <p className="text-slate-400">Visão geral da sua operação de distribuição musical no TikTok.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
             <Link to="/accounts" className="flex-1 md:flex-none">
               <Button variant="outline" className="w-full border-white/10 text-white bg-white/5 hover:bg-white/10 h-11 px-6">
                 <Globe className="w-4 h-4 mr-2" /> Central de Contas
               </Button>
             </Link>
             <Link to="/campanha" className="flex-1 md:flex-none">
               <Button className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] h-11 px-6 shadow-lg shadow-purple-500/20">
                 <Target className="w-4 h-4 mr-2" /> Nova Campanha
               </Button>
             </Link>
          </div>
        </div>

        {/* Status da Infraestrutura */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <InfrastructureCard 
            title="API PostPeer"
            status="CONECTADO"
            icon={<Zap className="w-4 h-4 text-amber-400" />}
            desc="Integração de publicação v1 ativa"
          />
          <InfrastructureCard 
            title="Database"
            status="SINCRONIZADO"
            icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
            desc="Tabelas de publicações auditadas"
          />
          <InfrastructureCard 
            title="Auth & Security"
            status="ATIVO"
            icon={<ShieldCheck className="w-4 h-4 text-blue-400" />}
            desc="RLS e Políticas de usuário configuradas"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard 
            title="Artistas" 
            value={stats.artists.toString()} 
            icon={<Users className="w-5 h-5 text-blue-400" />} 
            link="/artistas"
          />
          <MetricCard 
            title="Músicas" 
            value={stats.musics.toString()} 
            icon={<Music className="w-5 h-5 text-emerald-400" />} 
            link="/musicas"
          />
          <MetricCard 
            title="Biblioteca" 
            value={stats.videos.toString()} 
            icon={<Video className="w-5 h-5 text-amber-400" />} 
            link="/biblioteca"
          />
          <MetricCard 
            title="Publicações" 
            value={stats.publications.toString()} 
            icon={<TrendingUp className="w-5 h-5 text-[#7C3AED]" />} 
            link="/publicacoes"
            subtitle="Posts totais"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 bg-[#13131F] border-white/5 p-6 space-y-6">
              <div className="flex justify-between items-center">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2 font-space">
                    <Activity className="w-5 h-5 text-[#7C3AED]" /> Atividade Recente
                 </h3>
                 <div className="flex gap-2">
                   <Badge variant="outline" className="border-white/5 text-[9px] text-slate-500 uppercase font-bold tracking-widest">TikTok</Badge>
                   <Badge variant="outline" className="border-white/5 text-[9px] text-slate-500 uppercase font-bold tracking-widest">YouTube</Badge>
                 </div>
              </div>
              
              <div className="h-[300px] flex flex-col items-center justify-center border border-white/5 rounded-xl bg-black/20 text-center p-8">
                 <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-4">
                   <TrendingUp className="text-slate-700 w-6 h-6" />
                 </div>
                 <p className="text-slate-400 text-sm font-medium mb-1">Pronto para o primeiro teste real</p>
                 <p className="text-slate-600 text-xs max-w-xs">Os gráficos de performance serão exibidos automaticamente após as primeiras publicações agendadas.</p>
              </div>
           </Card>

           <Card className="bg-[#13131F] border-white/5 p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold text-white flex items-center gap-2 font-space">
                   <Calendar className="w-5 h-5 text-[#7C3AED]" /> Agenda
                </h3>
                <Link to="/agenda" className="text-[10px] text-purple-400 hover:text-purple-300 font-bold uppercase tracking-widest flex items-center gap-1">
                  Ver Tudo <ArrowRight size={10} />
                </Link>
              </div>
              
              <div className="space-y-4">
                  <div className="p-6 rounded-xl bg-white/5 border border-white/5 flex flex-col items-center justify-center h-40 text-center">
                     <Calendar className="text-slate-700 w-8 h-8 mb-3" />
                     <p className="text-slate-500 text-xs">Nenhuma publicação agendada para as próximas 24 horas.</p>
                  </div>
                  
                  <Link to="/campanha" className="block">
                    <Button variant="outline" className="w-full text-xs border-white/10 text-slate-300 hover:bg-white/5 hover:text-white h-9">
                       Agendar primeiro post
                    </Button>
                  </Link>
              </div>
           </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pb-8">
           <QuickActionCard 
              title="Garimpo" 
              desc="Descobrir novos vídeos virais" 
              icon={<Layers className="w-6 h-6 text-purple-400" />}
              link="/garimpo"
           />
           <QuickActionCard 
              title="Publicações" 
              desc="Gerenciar posts enviados" 
              icon={<TrendingUp className="w-6 h-6 text-blue-400" />}
              link="/publicacoes"
           />
           <QuickActionCard 
              title="Analytics" 
              desc="Performance das publicações" 
              icon={<BarChart3 className="w-6 h-6 text-emerald-400" />}
              link="/analytics"
           />
        </div>
      </div>
    </DashboardLayout>
  );
}

function InfrastructureCard({ title, status, icon, desc }: { title: string, status: string, icon: React.ReactNode, desc: string }) {
  return (
    <Card className="bg-[#13131F] border-white/5 p-4 flex items-start gap-4 hover:border-white/10 transition-colors">
      <div className="p-2 bg-white/5 rounded-lg border border-white/5">
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-0.5">
          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">{title}</h4>
          <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-1.5 py-0.5 rounded uppercase tracking-tighter">{status}</span>
        </div>
        <p className="text-xs text-white/70 font-medium">{desc}</p>
      </div>
    </Card>
  );
}

function MetricCard({ title, value, icon, link, subtitle }: { title: string; value: string; icon: React.ReactNode; link: string; subtitle?: string }) {
  return (
    <Link to={link}>
      <Card className="bg-[#13131F] border-white/5 p-6 hover:border-[#7C3AED]/30 transition-all group cursor-pointer relative overflow-hidden h-full">
        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
           {icon}
        </div>
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-[#7C3AED]/50 transition-colors">
            {icon}
          </div>
          <ArrowRight className="w-4 h-4 text-slate-700 group-hover:text-purple-500 transition-colors" />
        </div>
        <p className="text-xs text-slate-500 uppercase font-bold tracking-wider">{title}</p>
        <div className="flex items-baseline gap-2">
          <h3 className="text-3xl font-bold text-white mt-1 font-space">{value}</h3>
          {subtitle && <span className="text-[10px] text-slate-600 font-bold uppercase">{subtitle}</span>}
        </div>
      </Card>
    </Link>
  );
}

function QuickActionCard({ title, desc, icon, link }: { title: string; desc: string; icon: React.ReactNode; link: string }) {
  return (
    <Link to={link}>
      <Card className="bg-[#13131F] border-white/5 p-6 hover:bg-white/5 transition-all flex items-center gap-4 group cursor-pointer border-l-4 border-l-transparent hover:border-l-[#7C3AED]">
        <div className="p-3 bg-white/5 rounded-xl group-hover:bg-black/20 transition-colors">
           {icon}
        </div>
        <div className="flex-1">
           <h4 className="text-white font-bold font-space">{title}</h4>
           <p className="text-[11px] text-slate-500">{desc}</p>
        </div>
        <ArrowRight size={16} className="text-slate-700 group-hover:text-white transition-colors" />
      </Card>
    </Link>
  );
}

function Button({ className, ...props }: any) {
  const base = "inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 h-10 px-4 py-2";
  const variants: any = {
    default: "bg-[#7C3AED] text-white hover:bg-[#6D28D9]",
    outline: "border border-white/10 bg-white/5 text-white hover:bg-white/10",
    ghost: "hover:bg-white/5 text-slate-400 hover:text-white",
  };
  const v = props.variant || 'default';
  const Comp = props.asChild ? 'span' : 'button';
  return <Comp className={`${base} ${variants[v]} ${className}`} {...props} />;
}

