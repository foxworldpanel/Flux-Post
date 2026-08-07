import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Megaphone, Music, Calendar, Clock, RotateCcw, Play, Pause, Square, User } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { artistService } from "@/services/artists";

type MusicTrack = {
  id: string;
  nome: string;
  artista: string;
  artist_id: string;
};

type Artist = {
  id: string;
  name: string;
};

type Campanha = {
  id: string;
  nome: string;
  artist_id: string;
  music_track_id: string;
  posts_por_dia: number;
  intervalo_min: number;
  intervalo_max: number;
  hora_inicio: number;
  hora_fim: number;
  data_inicio: string;
  data_fim: string;
  status: string;
  music_tracks?: MusicTrack;
  artists?: Artist;
};

export default function CampanhaPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [campanhaAtiva, setCampanhaAtiva] = useState<Campanha | null>(null);
  const [musicas, setMusicas] = useState<MusicTrack[]>([]);
  const [artistas, setArtistas] = useState<Artist[]>([]);
  const [totalPosts, setTotalPosts] = useState(0);

  // Form states
  const [formData, setFormData] = useState({
    nome: "",
    artist_id: "",
    music_track_id: "",
    posts_por_dia: 3,
    hora_inicio: "09:00",
    hora_fim: "22:00",
    intervalo_min: 40,
    intervalo_max: 90,
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
  });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      // 1. Check for active campaign
      const { data: campanhas, error: campError } = await supabase
        .from("campanhas")
        .select("*, music_tracks(id, nome, artista), artists(id, name)")
        .eq("status", "ativo")
        .maybeSingle();

      if (campError) throw campError;

      if (campanhas) {
        setCampanhaAtiva(campanhas as any);
        
        // Count posts realized
        const { count, error: countError } = await supabase
          .from("posts_agendados")
          .select("*", { count: "exact", head: true })
          .eq("campanha_id", campanhas.id)
          .eq("status", "postado");
        
        if (!countError) setTotalPosts(count || 0);
      } else {
        // Fetch data for new campaign
        const [artistsRes, tracksRes] = await Promise.all([
          artistService.getArtists(),
          supabase.from("music_tracks").select("id, nome, artista, artist_id")
        ]);

        if (tracksRes.error) throw tracksRes.error;
        setArtistas(artistsRes || []);
        setMusicas(tracksRes.data || []);
      }
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleIniciar() {
    if (!formData.nome || !formData.music_track_id || !formData.artist_id) {
      toast.error("Preencha o nome, escolha um artista e uma música");
      return;
    }

    setSaving(true);
    try {
      // Parse hours to integers
      const startHour = parseInt(formData.hora_inicio.split(":")[0]);
      const endHour = parseInt(formData.hora_fim.split(":")[0]);

      const { data: newCamp, error: campError } = await supabase
        .from("campanhas")
        .insert({
          nome: formData.nome,
          artist_id: formData.artist_id,
          music_track_id: formData.music_track_id,
          posts_por_dia: formData.posts_por_dia,
          hora_inicio: startHour,
          hora_fim: endHour,
          intervalo_min: formData.intervalo_min,
          intervalo_max: formData.intervalo_max,
          data_inicio: formData.data_inicio,
          data_fim: formData.data_fim,
          status: "ativo"
        })
        .select()
        .single();

      if (campError) throw campError;

      // Update music track
      const { error: trackError } = await supabase
        .from("music_tracks")
        .update({ campanha_ativa: true })
        .eq("id", formData.music_track_id);

      if (trackError) throw trackError;

      toast.success("Campanha iniciada com sucesso!");
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao iniciar campanha: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleUpdateStatus(status: string) {
    if (!campanhaAtiva) return;
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from("campanhas")
        .update({ status })
        .eq("id", campanhaAtiva.id);

      if (error) throw error;

      if (status === "encerrado") {
        // Clear music track active flag
        await supabase
          .from("music_tracks")
          .update({ campanha_ativa: false })
          .eq("id", campanhaAtiva.music_track_id);
          
        setCampanhaAtiva(null);
      }

      toast.success(`Campanha ${status === "ativo" ? "retomada" : status === "pausado" ? "pausada" : "encerrada"}!`);
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar campanha: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-xl font-medium text-white/50">Carregando informações da campanha...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold text-white">Campanha Ativa</h1>
          {campanhaAtiva && (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1">
              Campanha em andamento
            </Badge>
          )}
        </div>

        {!campanhaAtiva ? (
          <Card className="bg-[#13131F] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Megaphone className="text-primary" />
                Criar Nova Campanha
              </CardTitle>
              <CardDescription className="text-white/60">
                Configure os parâmetros para sua automação de postagens.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-white/80">Nome da Campanha</Label>
                  <Input 
                    placeholder="Ex: Lançamento Verão" 
                    className="bg-white/5 border-white/10 text-white"
                    value={formData.nome}
                    onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-white/80">Escolher Música</Label>
                  <Select 
                    value={formData.music_track_id} 
                    onValueChange={(v) => setFormData({ ...formData, music_track_id: v })}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-white">
                      <SelectValue placeholder="Selecione uma música" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      {musicas.map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          {m.nome} - {m.artista}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Posts por dia (máx 3)</Label>
                  <Input 
                    type="number" 
                    min={1} 
                    max={3} 
                    className="bg-white/5 border-white/10 text-white"
                    value={formData.posts_por_dia}
                    onChange={(e) => setFormData({ ...formData, posts_por_dia: parseInt(e.target.value) })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Horário Início</Label>
                    <Input 
                      type="time" 
                      className="bg-white/5 border-white/10 text-white"
                      value={formData.hora_inicio}
                      onChange={(e) => setFormData({ ...formData, hora_inicio: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-white/80">Horário Fim</Label>
                    <Input 
                      type="time" 
                      className="bg-white/5 border-white/10 text-white"
                      value={formData.hora_fim}
                      onChange={(e) => setFormData({ ...formData, hora_fim: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Intervalo Mínimo (minutos)</Label>
                  <Input 
                    type="number" 
                    className="bg-white/5 border-white/10 text-white"
                    value={formData.intervalo_min}
                    onChange={(e) => setFormData({ ...formData, intervalo_min: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Intervalo Máximo (minutos)</Label>
                  <Input 
                    type="number" 
                    className="bg-white/5 border-white/10 text-white"
                    value={formData.intervalo_max}
                    onChange={(e) => setFormData({ ...formData, intervalo_max: parseInt(e.target.value) })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Data Início</Label>
                  <Input 
                    type="date" 
                    className="bg-white/5 border-white/10 text-white"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-white/80">Data Fim</Label>
                  <Input 
                    type="date" 
                    className="bg-white/5 border-white/10 text-white"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  />
                </div>
              </div>

              <Button 
                onClick={handleIniciar} 
                disabled={saving}
                className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-6 text-lg font-semibold"
              >
                {saving ? "Iniciando..." : "Iniciar Campanha"}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-[#13131F] border-white/10">
              <CardHeader>
                <CardTitle className="text-2xl text-white">{campanhaAtiva.nome}</CardTitle>
                <div className="flex items-center gap-2 text-white/60">
                  <Music size={16} />
                  <span>{campanhaAtiva.music_tracks?.nome} - {campanhaAtiva.music_tracks?.artista}</span>
                </div>
              </CardHeader>
              <CardContent className="space-y-8">
                <div className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/60">Progresso da Campanha</span>
                    <span className="text-white font-medium">
                      {(() => {
                        const total = differenceInDays(new Date(campanhaAtiva.data_fim), new Date(campanhaAtiva.data_inicio)) || 1;
                        const passados = differenceInDays(new Date(), new Date(campanhaAtiva.data_inicio));
                        const r = Math.min(100, Math.max(0, (passados / total) * 100));
                        return `${Math.round(r)}%`;
                      })()}
                    </span>
                  </div>
                  <Progress 
                    value={(() => {
                      const total = differenceInDays(new Date(campanhaAtiva.data_fim), new Date(campanhaAtiva.data_inicio)) || 1;
                      const passados = differenceInDays(new Date(), new Date(campanhaAtiva.data_inicio));
                      return Math.min(100, Math.max(0, (passados / total) * 100));
                    })()} 
                    className="h-2 bg-white/5" 
                  />
                  <div className="flex justify-between text-xs text-white/40">
                    <span>Início: {format(new Date(campanhaAtiva.data_inicio), "dd/MM/yyyy")}</span>
                    <span>Fim: {format(new Date(campanhaAtiva.data_fim), "dd/MM/yyyy")}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-xs flex items-center gap-1">
                      <Calendar size={12} /> Dias Restantes
                    </div>
                    <div className="text-xl font-bold text-white">
                      {Math.max(0, differenceInDays(new Date(campanhaAtiva.data_fim), new Date()))}
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-xs flex items-center gap-1">
                      <Megaphone size={12} /> Total de Posts
                    </div>
                    <div className="text-xl font-bold text-white">{totalPosts}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-xs flex items-center gap-1">
                      <Clock size={12} /> Posts p/ Dia
                    </div>
                    <div className="text-xl font-bold text-white">{campanhaAtiva.posts_por_dia}</div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button 
                    variant="outline"
                    className="flex-1 bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20"
                    onClick={() => handleUpdateStatus(campanhaAtiva.status === "pausado" ? "ativo" : "pausado")}
                    disabled={saving}
                  >
                    {campanhaAtiva.status === "pausado" ? <Play size={18} className="mr-2" /> : <Pause size={18} className="mr-2" />}
                    {campanhaAtiva.status === "pausado" ? "Retomar" : "Pausar"}
                  </Button>
                  <Button 
                    variant="outline"
                    className="flex-1 bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20"
                    onClick={() => handleUpdateStatus("encerrado")}
                    disabled={saving}
                  >
                    <Square size={18} className="mr-2" />
                    Encerrar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-[#13131F] border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-white/60">Configurações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Horário Ativo</span>
                    <span className="text-white">{campanhaAtiva.hora_inicio}:00 - {campanhaAtiva.hora_fim}:00</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Intervalo</span>
                    <span className="text-white">{campanhaAtiva.intervalo_min} - {campanhaAtiva.intervalo_max} min</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Status</span>
                    <Badge variant={campanhaAtiva.status === "ativo" ? "default" : "secondary"} className={campanhaAtiva.status === "ativo" ? "bg-emerald-500" : ""}>
                      {campanhaAtiva.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <div className="bg-primary/10 rounded-2xl p-6 border border-primary/20 space-y-4">
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <RotateCcw size={24} />
                </div>
                <div className="space-y-1">
                  <h3 className="text-white font-semibold text-lg">Conteúdos</h3>
                  <p className="text-white/60 text-sm">Selecione conteúdos da biblioteca para esta campanha.</p>
                </div>
                <Button variant="outline" className="w-full border-primary/50 text-primary hover:bg-primary/20">
                  Gerenciar Conteúdos
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
