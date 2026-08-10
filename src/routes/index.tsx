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
  Target
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Link } from "react-router-dom";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardPage() {
  const [stats, setStats] = useState({
    artists: 0,
    musics: 0,
    videos: 0,
    accounts: 0,
    connected: 0
  });

  useEffect(() => {
    const loadStats = async () => {
      const [
        { count: artists },
        { count: musics },
        { count: videos },
        { data: accounts }
      ] = await Promise.all([
        supabase.from('artists').select('*', { count: 'exact', head: true }),
        supabase.from('music_tracks').select('*', { count: 'exact', head: true }),
        supabase.from('content_library').select('*', { count: 'exact', head: true }),
        supabase.from('social_accounts').select('connection_status')
      ]);

      setStats({
        artists: artists || 0,
        musics: musics || 0,
        videos: videos || 0,
        accounts: accounts?.length || 0,
        connected: accounts?.filter(a => a.connection_status === 'conectada').length || 0
      });
    };
    loadStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        
        <div className="flex justify-between items-end">
          <div>
            <h1 className="text-4xl font-bold text-white font-space mb-2">Dashboard</h1>
            <p className="text-slate-400">Visão geral da sua operação de distribuição musical.</p>
          </div>
          <div className="flex gap-3">
             <Link to="/accounts">
               <Button variant="outline" className="border-white/10 text-white bg-white/5 hover:bg-white/10">
                 <Globe className="w-4 h-4 mr-2" /> Central de Contas
               </Button>
             </Link>
             <Link to="/campanha">
               <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]">
                 <Target className="w-4 h-4 mr-2" /> Nova Campanha
               </Button>
             </Link>
          </div>
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
            title="Contas Sociais" 
            value={`${stats.connected}/${stats.accounts}`} 
            icon={<Globe className="w-5 h-5 text-[#7C3AED]" />} 
            link="/accounts"
            subtitle="Contas Conectadas"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
           <Card className="lg:col-span-2 bg-[#13131F] border-white/5 p-6 space-y-6">
              <div className="flex justify-between items-center">
                 <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-[#7C3AED]" /> Atividade Recente
                 </h3>
                 <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Últimos 7 dias</span>
              </div>
              
              <div className="h-[300px] flex items-center justify-center border border-white/5 rounded-xl bg-black/20">
                 <p className="text-slate-600 text-sm italic">Dados de analytics serão exibidos aqui após a primeira campanha.</p>
              </div>
           </Card>

           <Card className="bg-[#13131F] border-white/5 p-6 space-y-6">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                 <Calendar className="w-5 h-5 text-[#7C3AED]" /> Agenda de Hoje
              </h3>
              
              <div className="space-y-4">
                 <div className="p-4 rounded-lg bg-white/5 border border-white/5 flex items-center justify-center h-40">
                    <p className="text-slate-600 text-xs text-center">Nenhuma publicação agendada para hoje.</p>
                 </div>
                 
                 <Button variant="ghost" className="w-full text-xs text-slate-500 hover:text-white" asChild>
                    <Link to="/agenda">Ver agenda completa</Link>
                 </Button>
              </div>
           </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
           <QuickActionCard 
              title="Garimpo" 
              desc="Descobrir novos vídeos virais" 
              icon={<Layers className="w-6 h-6 text-purple-400" />}
              link="/garimpo"
           />
           <QuickActionCard 
              title="Analytics" 
              desc="Performance das publicações" 
              icon={<BarChart3 className="w-6 h-6 text-emerald-400" />}
              link="/analytics"
           />
           <QuickActionCard 
              title="Publicações" 
              desc="Gerenciar posts enviados" 
              icon={<TrendingUp className="w-6 h-6 text-blue-400" />}
              link="/publicacoes"
           />
        </div>
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ title, value, icon, link, subtitle }: { title: string; value: string; icon: React.ReactNode; link: string; subtitle?: string }) {
  return (
    <Link to={link}>
      <Card className="bg-[#13131F] border-white/5 p-6 hover:border-[#7C3AED]/30 transition-all group cursor-pointer relative overflow-hidden">
        <div className="absolute -right-4 -bottom-4 opacity-5 group-hover:opacity-10 transition-opacity">
           {icon}
        </div>
        <div className="flex justify-between items-start mb-4">
          <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-[#7C3AED]/50 transition-colors">
            {icon}
          </div>
        </div>
        <p className="text-sm text-slate-500 uppercase font-bold tracking-wider">{title}</p>
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
        <div>
           <h4 className="text-white font-bold">{title}</h4>
           <p className="text-xs text-slate-500">{desc}</p>
        </div>
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
