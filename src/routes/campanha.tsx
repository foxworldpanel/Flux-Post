import { useState, useEffect, useMemo } from "react";
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
import { Megaphone, Music, Calendar, Clock, RotateCcw, Play, Pause, Square, User, Check, X, Filter, Loader2 } from "lucide-react";
import { format, addDays, differenceInDays } from "date-fns";
import { artistService } from "@/services/artists";
import { contentService } from "@/services/content";

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
  const [biblioteca, setBiblioteca] = useState<any[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState("todos");
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

        // Fetch campaign contents
        const { data: campaignContents, error: contentsError } = await supabase
          .from("campaign_contents")
          .select("content_id")
          .eq("campaign_id", campanhas.id);
        
        if (!contentsError && campaignContents) {
          setSelectedContentIds(campaignContents.map(c => c.content_id));
        }
      }

      // Fetch data for new/existing campaign
      const [artistsRes, tracksRes, libraryRes] = await Promise.all([
        artistService.getArtists(),
        supabase.from("music_tracks").select("id, nome, artista, artist_id"),
        supabase.from("content_library").select("*").order("created_at", { ascending: false })
      ]);

      if (tracksRes.error) throw tracksRes.error;
      if (libraryRes.error) throw libraryRes.error;

      setArtistas(artistsRes || []);
      setMusicas(tracksRes.data || []);
      setBiblioteca(libraryRes.data || []);
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

    if (selectedContentIds.length === 0) {
      toast.error("Selecione pelo menos um conteúdo para a campanha");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

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
          status: "ativo",
          user_id: user.id
        })
        .select()
        .single();

      if (campError) throw campError;

      // Create campaign contents
      const contentInserts = selectedContentIds.map(contentId => ({
        campaign_id: newCamp.id,
        content_id: contentId
      }));

      const { error: contentError } = await supabase
        .from("campaign_contents")
        .insert(contentInserts);

      if (contentError) throw contentError;

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
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-white/80">Escolher Artista</Label>
                    <Select 
                      value={formData.artist_id} 
                      onValueChange={(v) => {
                        setFormData({ ...formData, artist_id: v, music_track_id: "" });
                      }}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione um artista" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#13131F] border-white/10 text-white">
                        {artistas.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-white/80">Escolher Música</Label>
                    <Select 
                      value={formData.music_track_id} 
                      onValueChange={(v) => setFormData({ ...formData, music_track_id: v })}
                      disabled={!formData.artist_id}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder={formData.artist_id ? "Selecione uma música" : "Selecione um artista primeiro"} />
                      </SelectTrigger>
                      <SelectContent className="bg-[#13131F] border-white/10 text-white">
                        {musicas
                          .filter(m => m.artist_id === formData.artist_id)
                          .map((m) => (
                            <SelectItem key={m.id} value={m.id}>
                              {m.nome}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
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

              <div className="space-y-4 pt-4 border-t border-white/5">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label className="text-white text-base font-semibold">CONTEÚDOS DA CAMPANHA</Label>
                    <p className="text-white/40 text-xs">{selectedContentIds.length} selecionados</p>
                  </div>
                  <Select value={contentFilter} onValueChange={setContentFilter}>
                    <SelectTrigger className="w-[150px] bg-white/5 border-white/10 text-white text-xs h-8">
                      <div className="flex items-center gap-2">
                        <Filter size={12} />
                        <SelectValue placeholder="Filtrar" />
                      </div>
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      <SelectItem value="todos">Todos</SelectItem>
                      <SelectItem value="raw">Raw</SelectItem>
                      <SelectItem value="processed">Processados</SelectItem>
                      <SelectItem value="artist">Do Artista</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                  {biblioteca
                    .filter(c => c.status !== 'arquivado' && c.status !== 'descartado')
                    .filter(c => {
                      if (contentFilter === 'todos') return true;
                      if (contentFilter === 'artist') return c.artist_id === formData.artist_id;
                      return c.category === contentFilter;
                    })
                    .map((item) => {
                      const isSelected = selectedContentIds.includes(item.id);
                      return (
                        <div 
                          key={item.id}
                          onClick={() => {
                            if (isSelected) {
                              setSelectedContentIds(prev => prev.filter(id => id !== item.id));
                            } else {
                              setSelectedContentIds(prev => [...prev, item.id]);
                            }
                          }}
                          className={`relative aspect-video rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                            isSelected ? 'border-primary' : 'border-transparent hover:border-white/20'
                          }`}
                        >
                          <video src={supabase.storage.from('content-library').getPublicUrl(item.storage_path).data.publicUrl} className="w-full h-full object-cover" />
                          <div className="absolute inset-0 bg-black/40 flex flex-col justify-end p-2">
                            <p className="text-[10px] text-white font-medium truncate">{item.title}</p>
                            <Badge className="w-fit text-[8px] h-3 px-1 mt-1 bg-white/20 hover:bg-white/20 border-none">
                              {item.category}
                            </Badge>
                          </div>
                          {isSelected && (
                            <div className="absolute top-1 right-1 bg-primary rounded-full p-0.5">
                              <Check size={10} className="text-white" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  {biblioteca.length === 0 && (
                    <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-xl">
                      <p className="text-white/40 text-sm">Biblioteca vazia. Faça upload em Biblioteca primeiro.</p>
                    </div>
                  )}
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
                  <div className="flex items-center gap-4 text-white/60">
                    <div className="flex items-center gap-2">
                      <User size={16} />
                      <span>{campanhaAtiva.artists?.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Music size={16} />
                      <span>{campanhaAtiva.music_tracks?.nome}</span>
                    </div>
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

              <Card className="bg-[#13131F] border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-white/60">Conteúdos Ativos</CardTitle>
                    <Badge variant="outline" className="text-[10px] h-5 border-white/10 text-white/40">
                      {selectedContentIds.length} Itens
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {biblioteca
                      .filter(item => selectedContentIds.includes(item.id))
                      .map((item) => (
                        <div key={item.id} className="relative aspect-video rounded-md overflow-hidden group">
                          <video 
                            src={supabase.storage.from('content-library').getPublicUrl(item.storage_path).data.publicUrl} 
                            className="w-full h-full object-cover" 
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button 
                              size="icon" 
                              variant="ghost" 
                              className="h-6 w-6 text-white hover:text-red-400 hover:bg-transparent"
                              onClick={async () => {
                                if (!campanhaAtiva) return;
                                try {
                                  const { error } = await supabase
                                    .from("campaign_contents")
                                    .delete()
                                    .eq("campaign_id", campanhaAtiva.id)
                                    .eq("content_id", item.id);
                                  
                                  if (error) throw error;
                                  setSelectedContentIds(prev => prev.filter(id => id !== item.id));
                                  toast.success("Conteúdo removido da campanha");
                                } catch (err: any) {
                                  toast.error("Erro ao remover: " + err.message);
                                }
                              }}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        </div>
                      ))}
                  </div>
                  <Button 
                    variant="outline" 
                    className="w-full border-primary/20 text-primary text-xs h-8 hover:bg-primary/10"
                    onClick={() => toast.info("Funcionalidade de adição rápida em breve")}
                  >
                    Adicionar Conteúdo
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
