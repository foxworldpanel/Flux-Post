import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { 
  Users, 
  Music, 
  Video, 
  TrendingUp, 
  Clock, 
  Megaphone,
  Plus
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    artists: 0,
    musics: 0,
    videos: 0,
    accounts: 0,
    activeCampaigns: 0,
    totalPosts: 0
  });
  const [loading, setLoading] = useState(true);
  const [recentActivities, setRecentActivities] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [artists, musics, videos, accounts, campaigns, publications] = await Promise.all([
          supabase.from("artists").select("*", { count: 'exact', head: true }),
          supabase.from("music_tracks").select("*", { count: 'exact', head: true }),
          supabase.from("content_library").select("*", { count: 'exact', head: true }),
          supabase.from("social_accounts").select("*", { count: 'exact', head: true }),
          supabase.from("campanhas").select("*", { count: 'exact', head: true }).eq("status", "ativo"),
          supabase.from("publications").select("*", { count: 'exact', head: true })
        ]);

        setStats({
          artists: artists.count || 0,
          musics: musics.count || 0,
          videos: videos.count || 0,
          accounts: accounts.count || 0,
          activeCampaigns: campaigns.count || 0,
          totalPosts: publications.count || 0
        });

        const { data: recentPubs } = await supabase
          .from("publications")
          .select("*, social_accounts(account_name), content_library(title)")
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentActivities(recentPubs || []);
      } catch (error) {
        console.error("Error fetching dashboard stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground whitespace-pre-wrap">{`O processamento de vídeo via Edge Function 

está falhando por CORS.

Mude a estratégia de processamento:

Em vez de chamar a Edge Function render-bridge,

insira o job diretamente na tabela media_renders

usando o cliente supabase normal:

const { data: { user } } = await supabase.auth.getUser();

const render_key = [

  videoId,

  formData.music_track_id,

  formData.music_start_ms,

  formData.music_volume,

  formData.original_audio_volume,

  formData.audio_mode,

  "v1"

].join("|");

const { data: render, error } = await supabase

  .from("media_renders")

  .upsert({

    user_id: user.id,

    source_content_id: videoId,

    music_track_id: formData.music_track_id,

    render_key,

    status: "ready",

    attempts: 1,

    audio_mode: formData.audio_mode,

    music_volume: formData.music_volume,

    original_audio_volume: formData.original_audio_volume,

    music_start_ms: formData.music_start_ms,

  }, { onConflict: "render_key" })

  .select()

  .single();

Marque status como "ready" diretamente.

Remova qualquer chamada para Edge Functions

no processo de renderização.

Atualize o estado renders com o resultado.`}</p>
          </div>
          <Button 
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
            onClick={() => navigate("/campanha")}
          >
            <Plus size={18} />
            Nova Campanha
          </Button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard 
            title="Artistas" 
            value={stats.artists} 
            icon={<Users className="text-blue-500" />} 
            description="Total de artistas cadastrados"
          />
          <StatCard 
            title="Músicas" 
            value={stats.musics} 
            icon={<Music className="text-purple-500" />} 
            description="Tracks na biblioteca"
          />
          <StatCard 
            title="Vídeos Raw" 
            value={stats.videos} 
            icon={<Video className="text-emerald-500" />} 
            description="Conteúdos para garimpo"
          />
          <StatCard 
            title="Publicações" 
            value={stats.totalPosts} 
            icon={<TrendingUp className="text-orange-500" />} 
            description="Total processado"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Campaigns Section */}
          <Card className="lg:col-span-2 bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Megaphone className="text-[#7C3AED]" size={20} />
                Campanhas Ativas
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats.activeCampaigns === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center space-y-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                    <Megaphone className="text-muted-foreground" size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-lg font-medium">Nenhuma campanha rodando</p>
                    <p className="text-sm text-muted-foreground">Inicie uma nova campanha para automatizar suas postagens.</p>
                  </div>
                  <Button variant="outline" onClick={() => navigate("/campanha")}>
                    Ir para Campanhas
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-muted/30 border border-border flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center text-[#7C3AED]">
                        <TrendingUp size={20} />
                      </div>
                      <div>
                        <p className="font-medium text-foreground">Campanha em Andamento</p>
                        <p className="text-xs text-muted-foreground">{stats.activeCampaigns} ativa(s) agora</p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => navigate("/campanha")}>
                      Ver Detalhes
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="text-blue-500" size={20} />
                Atividade Recente
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {recentActivities.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8 italic">Aguardando atividades...</p>
                ) : (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="flex gap-4">
                      <div className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                        activity.status === 'published' ? 'bg-emerald-500' : 
                        activity.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                      }`} />
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground leading-none">
                          {activity.status === 'published' ? 'Post publicado' : 
                           activity.status === 'failed' ? 'Falha no post' : 'Post agendado'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.social_accounts?.account_name} • {activity.content_library?.title}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ title, value, icon, description }: any) {
  return (
    <Card className="bg-card border-border hover:border-primary/50 transition-colors">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
          <div className="p-3 bg-muted rounded-xl">
            {icon}
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">{description}</p>
      </CardContent>
    </Card>
  );
}