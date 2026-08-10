import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Megaphone,
  Music as MusicIcon,
  Calendar,
  Clock,
  RotateCcw,
  Play,
  Pause,
  Square,
  User,
  Check,
  X,
  Filter,
  Loader2,
  Plus,
  Globe,
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { format, addDays, differenceInDays, isBefore, isAfter, startOfDay, addMinutes, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { artistService } from "@/services/artists";
import { contentService } from "@/services/content";
import { socialService, type SocialAccount } from "@/services/social";

type MusicTrack = {
  id: string;
  nome: string;
  artista: string;
  artist_id: string;
  storage_path: string | null;
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
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [selectedContentIds, setSelectedContentIds] = useState<string[]>([]);
  const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
  const [contentFilter, setContentFilter] = useState("todos");
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [loadingUrls, setLoadingUrls] = useState<Record<string, boolean>>({});
  const [totalPosts, setTotalPosts] = useState(0);
  
  // Modal states for new music
  const [isMusicModalOpen, setIsMusicModalOpen] = useState(false);
  const [newMusicData, setNewMusicData] = useState({
    nome: "",
    file: null as File | null,
    uploading: false
  });
  const musicFileInputRef = useRef<HTMLInputElement>(null);

  // Form states
  const [formData, setFormData] = useState({
    nome: "",
    artist_id: "",
    music_track_id: "",
    posts_por_dia: 1,
    hora_inicio: "09:00",
    hora_fim: "21:00",
    intervalo_min: 30,
    intervalo_max: 120,
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: format(addDays(new Date(), 7), "yyyy-MM-dd"),
    timezone: "America/Sao_Paulo",
    distribution_mode: "intelligent" as "all" | "intelligent",
    distribution_variation: "medium" as "low" | "medium" | "high",
    cooldown_days: 30,
    distribution_interval_minutes: 5,
    editorial_language: "pt-BR",
    editorial_style: "engaging",
    audio_mode: 'music_plus_original' as 'only_music' | 'music_plus_original' | 'only_original',
    music_volume: 80,
    original_audio_volume: 20,
    music_start_ms: 0
  });


  // Calculate Scheduling Preview
  const schedulingPreview = useMemo(() => {
    if (!formData.data_inicio || !formData.data_fim || !selectedAccountIds.length || !selectedContentIds.length) {
      return [];
    }

    const preview: any[] = [];
    const startDate = new Date(formData.data_inicio + "T00:00:00");

    const endDate = new Date(formData.data_fim + "T23:59:59");
    const [startH, startM] = formData.hora_inicio.split(":").map(Number);
    const [endH, endM] = formData.hora_fim.split(":").map(Number);
    const postsPerDay = formData.posts_por_dia;
    
    let currentDay = startOfDay(startDate);
    let videoIndex = 0;

    while (isBefore(currentDay, endDate) || currentDay.getTime() === startOfDay(endDate).getTime()) {
      for (let p = 0; p < postsPerDay; p++) {
        const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        const interval = totalMinutes > 0 ? totalMinutes / Math.max(1, postsPerDay) : 0;
        const postTime = addMinutes(setMinutes(setHours(currentDay, startH), startM), interval * p);
        
        if (isBefore(postTime, startDate) || isAfter(postTime, endDate)) continue;

        selectedAccountIds.forEach((accountId, accIdx) => {
          const account = socialAccounts.find(a => a.id === accountId);
          
          let effectiveVideoIdx;
          if (formData.distribution_mode === 'all') {
            // MODO A: Todos recebem o mesmo conteúdo
            effectiveVideoIdx = videoIndex % selectedContentIds.length;
          } else {
            // MODO B: Distribuição Inteligente (Randomizada com variação)
            // Usamos uma lógica determinística baseada na data e índice da conta para simular pool
            const seed = postTime.getTime() + accIdx;
            effectiveVideoIdx = Math.floor(Math.abs(Math.sin(seed) * selectedContentIds.length));
          }

          preview.push({
            date: postTime,
            accountId,
            accountName: account?.account_name || "Conta",
            videoIndex: effectiveVideoIdx,
            platform: account?.platform || "tiktok"
          });
        });
        videoIndex++;
      }
      currentDay = addDays(currentDay, 1);
    }


    return preview.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [formData, selectedAccountIds, selectedContentIds, socialAccounts]);

  const totalEstimatedPosts = schedulingPreview.length;


  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 1. Check for active campaign
      const { data: campanhas, error: campError } = await supabase
        .from("campanhas")
        .select("*, music_tracks(id, nome, artista, storage_path, artist_id), artists(id, name)")
        .eq("status", "ativo")
        .maybeSingle();

      if (campError) throw campError;

      if (campanhas) {
        setCampanhaAtiva(campanhas as any);

        // Count posts
        const { count, error: countError } = await supabase
          .from("publications")
          .select("*", { count: "exact", head: true })
          .eq("campaign_id", campanhas.id)
          .eq("status", "published");

        if (!countError) setTotalPosts(count || 0);

        // Fetch campaign contents
        const { data: campaignContents, error: contentsError } = await supabase
          .from("campaign_contents")
          .select("content_id")
          .eq("campaign_id", campanhas.id);

        if (!contentsError && campaignContents) {
          setSelectedContentIds(campaignContents.map((c) => c.content_id));
        }

        // Fetch campaign social accounts
        const { data: campaignAccounts, error: accountsRelError } = await supabase
          .from("campaign_social_accounts")
          .select("social_account_id")
          .eq("campaign_id", campanhas.id);
        
        if (!accountsRelError && campaignAccounts) {
          setSelectedAccountIds(campaignAccounts.map(a => a.social_account_id));
        }
      }

      // Fetch data for new/existing campaign
      const [artistsRes, tracksRes, libraryRes, accountsRes] = await Promise.all([
        artistService.getArtists(),
        supabase.from("music_tracks").select("id, nome, artista, artist_id, storage_path"),
        supabase.from("content_library").select("*").order("created_at", { ascending: false }),
        socialService.getConnectedAccounts()
      ]);

      if (tracksRes.error) throw tracksRes.error;
      if (libraryRes.error) throw libraryRes.error;

      setArtistas(artistsRes || []);
      setMusicas(tracksRes.data || []);
      setBiblioteca(libraryRes.data || []);
      setSocialAccounts(accountsRes || []);

      // Pre-fetch signed URLs
      if (libraryRes.data) {
        libraryRes.data.forEach((item) => {
          loadSignedUrl(item.id, item.storage_path);
        });
      }
    } catch (error: any) {
      toast.error("Erro ao carregar dados: " + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadSignedUrl(id: string, path: string) {
    if (signedUrls[id] || loadingUrls[id]) return;

    setLoadingUrls((prev) => ({ ...prev, [id]: true }));
    try {
      const url = await contentService.getSignedUrl(path);
      setSignedUrls((prev) => ({ ...prev, [id]: url }));
    } catch (error) {
      console.error(`Falha ao carregar URL para ${id}:`, error);
    } finally {
      setLoadingUrls((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleCreateMusic() {
    if (!newMusicData.nome || !newMusicData.file || !formData.artist_id) {
      toast.error("Preencha o nome, escolha um arquivo e certifique-se de que um artista está selecionado.");
      return;
    }

    setNewMusicData(prev => ({ ...prev, uploading: true }));
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Upload file
      const fileExt = newMusicData.file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `music/${user.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('musicas')
        .upload(filePath, newMusicData.file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('musicas')
        .getPublicUrl(filePath);

      // 2. Insert into DB
      const { data: music, error: dbError } = await supabase
        .from('music_tracks')
        .insert({
          nome: newMusicData.nome,
          artist_id: formData.artist_id,
          storage_path: publicUrl,
          user_id: user.id
        })
        .select()
        .single();

      if (dbError) throw dbError;

      // 3. Update local state and select it
      setMusicas(prev => [music as any, ...prev]);
      setFormData(prev => ({ ...prev, music_track_id: music.id }));
      setIsMusicModalOpen(false);
      setNewMusicData({ nome: "", file: null, uploading: false });
      toast.success("Música adicionada e selecionada!");
    } catch (error: any) {
      toast.error("Erro ao adicionar música: " + error.message);
    } finally {
      setNewMusicData(prev => ({ ...prev, uploading: false }));
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

    if (selectedAccountIds.length === 0) {
      toast.error("Selecione pelo menos uma conta social para publicação");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // 1. Create campaign
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
          user_id: user.id,
          distribution_mode: formData.distribution_mode,
          distribution_variation: formData.distribution_variation,
          cooldown_days: formData.cooldown_days,
          editorial_language: formData.editorial_language
        })
        .select()
        .single();



      if (campError) throw campError;

      // 2. Link contents
      const contentInserts = selectedContentIds.map((contentId) => ({
        campaign_id: newCamp.id,
        content_id: contentId,
      }));

      const { error: contentError } = await supabase
        .from("campaign_contents")
        .insert(contentInserts);

      if (contentError) throw contentError;

      // 3. Link social accounts
      const accountInserts = selectedAccountIds.map(accountId => ({
        campaign_id: newCamp.id,
        social_account_id: accountId
      }));

      const { error: accountRelError } = await supabase
        .from("campaign_social_accounts")
        .insert(accountInserts);
      
      if (accountRelError) throw accountRelError;

      // 4. Update music track
      await supabase
        .from("music_tracks")
        .update({ campanha_ativa: true })
        .eq("id", formData.music_track_id);

      toast.success("Campanha criada com sucesso! Você pode revisar a programação agora.");
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
        await supabase
          .from("music_tracks")
          .update({ campanha_ativa: false })
          .eq("id", campanhaAtiva.music_track_id);

        setCampanhaAtiva(null);
      }

      toast.success(
        `Campanha ${status === "ativo" ? "retomada" : status === "pausado" ? "pausada" : "encerrada"}!`,
      );
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao atualizar campanha: " + error.message);
    } finally {
      setSaving(false);
    }
  }

  const filteredMusics = useMemo(() => {
    if (!formData.artist_id) return [];
    return musicas.filter(m => m.artist_id === formData.artist_id);
  }, [musicas, formData.artist_id]);

  const toggleAccount = (id: string) => {
    setSelectedAccountIds(prev => 
      prev.includes(id) ? prev.filter(a => a !== id) : [...prev, id]
    );
  };


  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-xl font-medium text-white/50">
            Carregando informações da campanha...
          </div>
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
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Escolher Música</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.music_track_id}
                        onValueChange={(v) => setFormData({ ...formData, music_track_id: v })}
                        disabled={!formData.artist_id}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white flex-1">
                          <SelectValue
                            placeholder={
                              formData.artist_id
                                ? "Selecione uma música"
                                : "Selecione um artista primeiro"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13131F] border-white/10 text-white">
                          {musicas
                            .filter((m) => m.artist_id === formData.artist_id)
                            .map((m) => (
                              <SelectItem key={m.id} value={m.id}>
                                {m.nome}
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={isMusicModalOpen} onOpenChange={setIsMusicModalOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="shrink-0 bg-white/5 border-white/10 text-white hover:bg-white/10"
                            disabled={!formData.artist_id}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-[#13131F] border-white/10 text-white sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold">Nova Música</DialogTitle>
                            <DialogDescription className="text-white/60">
                              Adicione uma nova música para o artista {artistas.find(a => a.id === formData.artist_id)?.name}.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="space-y-2">
                              <Label htmlFor="music-name">Nome da Música</Label>
                              <Input
                                id="music-name"
                                value={newMusicData.nome}
                                onChange={(e) => setNewMusicData({ ...newMusicData, nome: e.target.value })}
                                placeholder="Ex: Chill Vibe"
                                className="bg-white/5 border-white/10 text-white"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="music-file">Arquivo de Áudio (MP3/WAV)</Label>
                              <Input
                                id="music-file"
                                type="file"
                                accept="audio/*"
                                className="bg-white/5 border-white/10 text-white"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) {
                                    setNewMusicData({ ...newMusicData, file: e.target.files[0] });
                                    if (!newMusicData.nome) {
                                      setNewMusicData(prev => ({ ...prev, nome: e.target.files![0].name.split('.')[0] }));
                                    }
                                  }
                                }}
                              />
                            </div>
                          </div>
                          <DialogFooter>
                            <Button
                              onClick={handleCreateMusic}
                              disabled={newMusicData.uploading}
                              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white w-full"
                            >
                              {newMusicData.uploading ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Salvando...
                                </>
                              ) : "Salvar Música"}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-white/80">Posts por dia</Label>
                    <Select
                      value={formData.posts_por_dia.toString()}
                      onValueChange={(v) => setFormData({ ...formData, posts_por_dia: parseInt(v) })}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#13131F] border-white/10 text-white">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n} posts/dia</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-white/80">Timezone</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10 text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[#13131F] border-white/10 text-white">
                        <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <Label className="text-white text-base font-semibold uppercase">Distribuição e IA</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-white/80">Modo de Distribuição</Label>
                      <Select
                        value={formData.distribution_mode}
                        onValueChange={(v: any) => setFormData({ ...formData, distribution_mode: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13131F] border-white/10 text-white">
                          <SelectItem value="all">Todos recebem o mesmo conteúdo</SelectItem>
                          <SelectItem value="intelligent">Distribuição Inteligente (Recomendado)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/80">Variação Editorial</Label>
                      <Select
                        value={formData.distribution_variation}
                        onValueChange={(v: any) => setFormData({ ...formData, distribution_variation: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13131F] border-white/10 text-white">
                          <SelectItem value="low">Baixa (Mais repetições)</SelectItem>
                          <SelectItem value="medium">Média (Equilibrado)</SelectItem>
                          <SelectItem value="high">Alta (Máxima diversidade)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-white/80">Cooldown de Conteúdo</Label>
                      <Select
                        value={formData.cooldown_days.toString()}
                        onValueChange={(v) => setFormData({ ...formData, cooldown_days: parseInt(v) })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13131F] border-white/10 text-white">
                          <SelectItem value="7">7 dias</SelectItem>
                          <SelectItem value="15">15 dias</SelectItem>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="60">60 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/80">Idioma da IA</Label>
                      <Select
                        value={formData.editorial_language}
                        onValueChange={(v) => setFormData({ ...formData, editorial_language: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13131F] border-white/10 text-white">
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="es-ES">Español</SelectItem>
                        </SelectContent>
                      </Select>
                </div>
                
                <div className="space-y-4 pt-4 border-t border-white/5">
                  <Label className="text-white text-base font-semibold uppercase">Processamento de Mídia</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-white/80">Modo de Áudio</Label>
                      <Select
                        value={formData.audio_mode}
                        onValueChange={(v: any) => setFormData({ ...formData, audio_mode: v })}
                      >
                        <SelectTrigger className="bg-white/5 border-white/10 text-white">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-[#13131F] border-white/10 text-white">
                          <SelectItem value="music_plus_original">Música + Áudio Original (Mix)</SelectItem>
                          <SelectItem value="only_music">Somente Música</SelectItem>
                          <SelectItem value="only_original">Somente Áudio Original (Sem Processar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white/80">Início da Música (Segundos)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="bg-white/5 border-white/10 text-white"
                        value={formData.music_start_ms / 1000}
                        onChange={(e) => setFormData({ ...formData, music_start_ms: Math.max(0, parseInt(e.target.value) || 0) * 1000 })}
                      />
                    </div>
                  </div>

                  {formData.audio_mode !== 'only_original' && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-white/80">Volume Música ({formData.music_volume}%)</Label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          className="w-full accent-[#7C3AED]"
                          value={formData.music_volume}
                          onChange={(e) => setFormData({ ...formData, music_volume: parseInt(e.target.value) })}
                        />
                      </div>
                      {formData.audio_mode === 'music_plus_original' && (
                        <div className="space-y-2">
                          <Label className="text-white/80">Volume Original ({formData.original_audio_volume}%)</Label>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            className="w-full accent-[#7C3AED]"
                            value={formData.original_audio_volume}
                            onChange={(e) => setFormData({ ...formData, original_audio_volume: parseInt(e.target.value) })}
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>

                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                  <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white text-base font-semibold uppercase">
                        Contas de Publicação
                      </Label>
                      <p className="text-white/40 text-xs">
                        Selecione onde os vídeos serão postados
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-7 px-2 border-white/10 text-slate-400 hover:text-white"
                        onClick={() => setSelectedAccountIds(socialAccounts.map(a => a.id))}
                      >
                        Selecionar Todas
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-7 px-2 border-white/10 text-slate-400 hover:text-white"
                        onClick={() => setSelectedAccountIds([])}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>

                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {socialAccounts.length === 0 ? (
                      <div className="col-span-full py-6 text-center border border-dashed border-white/10 rounded-xl">
                        <p className="text-white/40 text-sm">Nenhuma conta conectada. Vá em Contas primeiro.</p>
                      </div>
                    ) : (
                      socialAccounts.map((account) => (
                        <div 
                          key={account.id}
                          onClick={() => toggleAccount(account.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            selectedAccountIds.includes(account.id)
                              ? "bg-[#7C3AED]/10 border-[#7C3AED]"
                              : "bg-white/5 border-white/10 hover:border-white/20"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-black/20 overflow-hidden flex items-center justify-center">
                              {account.profile_image_url ? (
                                <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Globe className="w-5 h-5 text-slate-500" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-white capitalize">{account.platform}</p>
                              <p className="text-xs text-slate-400">{account.account_name}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${account.connection_status === 'conectada' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter">
                                  {account.connection_status === 'conectada' ? 'Conectada' : 'Desconectada'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Checkbox 
                            checked={selectedAccountIds.includes(account.id)} 
                            onCheckedChange={() => toggleAccount(account.id)}
                            className="border-white/20 data-[state=checked]:bg-[#7C3AED]"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>


                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white text-base font-semibold uppercase">
                        Programação Sugerida
                      </Label>
                      <p className="text-white/40 text-xs">
                        Cronograma de postagens baseado nas configurações
                      </p>
                    </div>
                    {schedulingPreview.length > 0 && (
                      <Badge variant="outline" className="bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20">
                        {totalEstimatedPosts} Posts Total
                      </Badge>
                    )}
                  </div>

                  <div className="bg-black/20 rounded-xl border border-white/5 overflow-hidden">
                    {schedulingPreview.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-white/40 text-sm italic">
                          Selecione as datas, horários e contas para ver a prévia da programação.
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                        <table className="w-full text-left text-xs">
                          <thead className="sticky top-0 bg-[#1A1A2E] text-white/60 uppercase tracking-tighter font-bold border-b border-white/5">
                            <tr>
                              <th className="px-4 py-3">Data/Hora</th>
                              <th className="px-4 py-3">Conta</th>
                              <th className="px-4 py-3">Conteúdo</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-white/5">
                            {schedulingPreview.map((item, idx) => (
                              <tr key={idx} className="hover:bg-white/5 transition-colors">
                                <td className="px-4 py-3 text-white font-medium flex items-center gap-2">
                                  {format(item.date, "dd/MM HH:mm", { locale: ptBR })}
                                  <Badge variant="outline" className="text-[8px] h-3 px-1 border-white/5 text-slate-500 uppercase">
                                    {item.platform}
                                  </Badge>
                                </td>
                                <td className="px-4 py-3 text-white/70">
                                  {item.accountName}
                                </td>
                                <td className="px-4 py-3 space-y-1">
                                  <div className="text-[#7C3AED] font-bold">
                                    Vídeo #{item.videoIndex + 1}
                                  </div>
                                  <div className="text-[9px] text-slate-500 italic truncate max-w-[200px]">
                                    IA: {formData.editorial_language === 'pt-BR' ? 'Legenda criativa variada...' : 'Creative varying caption...'}
                                  </div>
                                </td>

                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-white text-base font-semibold uppercase">
                        Biblioteca de Conteúdos
                      </Label>
                      <p className="text-white/40 text-xs">
                        {selectedContentIds.length} selecionados para rodízio
                      </p>
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

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    {biblioteca
                      .filter((c) => c.status !== "arquivado" && c.status !== "descartado")
                      .filter((c) => {
                        if (contentFilter === "todos") return true;
                        if (contentFilter === "artist") return c.artist_id === formData.artist_id;
                        return c.category === contentFilter;
                      })
                      .map((item) => {
                        const isSelected = selectedContentIds.includes(item.id);
                        return (
                          <div
                            key={item.id}
                            onClick={() => {
                              if (isSelected) {
                                setSelectedContentIds((prev) => prev.filter((id) => id !== item.id));
                              } else {
                                setSelectedContentIds((prev) => [...prev, item.id]);
                              }
                            }}
                            className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                              isSelected
                                ? "border-[#7C3AED]"
                                : "border-transparent hover:border-white/20"
                            }`}
                          >
                            {loadingUrls[item.id] ? (
                              <div className="w-full h-full flex items-center justify-center bg-white/5">
                                <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin" />
                              </div>
                            ) : signedUrls[item.id] ? (
                              <video
                                src={signedUrls[item.id]}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-white/5">
                                <X className="w-4 h-4 text-red-500/50" />
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-[10px] text-white font-medium truncate">
                                {item.title}
                              </p>
                            </div>
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-[#7C3AED] rounded-full p-1 shadow-lg">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                    {biblioteca.length === 0 && (
                      <div className="col-span-full py-8 text-center border border-dashed border-white/10 rounded-xl">
                        <p className="text-white/40 text-sm">
                          Biblioteca vazia. Faça upload em Biblioteca primeiro.
                        </p>
                      </div>
                    )}
                  </div>
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
                    <MusicIcon size={16} />
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
                        const total =
                          differenceInDays(
                            new Date(campanhaAtiva.data_fim),
                            new Date(campanhaAtiva.data_inicio),
                          ) || 1;
                        const passados = differenceInDays(
                          new Date(),
                          new Date(campanhaAtiva.data_inicio),
                        );
                        const r = Math.min(100, Math.max(0, (passados / total) * 100));
                        return `${Math.round(r)}%`;
                      })()}
                    </span>
                  </div>
                  <Progress
                    value={(() => {
                      const total =
                        differenceInDays(
                          new Date(campanhaAtiva.data_fim),
                          new Date(campanhaAtiva.data_inicio),
                        ) || 1;
                      const passados = differenceInDays(
                        new Date(),
                        new Date(campanhaAtiva.data_inicio),
                      );
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
                    <div className="text-xl font-bold text-white">
                      {campanhaAtiva.posts_por_dia}
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <Button
                    variant="outline"
                    className="flex-1 bg-yellow-500/10 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/20"
                    onClick={() =>
                      handleUpdateStatus(campanhaAtiva.status === "pausado" ? "ativo" : "pausado")
                    }
                    disabled={saving}
                  >
                    {campanhaAtiva.status === "pausado" ? (
                      <Play size={18} className="mr-2" />
                    ) : (
                      <Pause size={18} className="mr-2" />
                    )}
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
                    <span className="text-white">
                      {campanhaAtiva.hora_inicio}:00 - {campanhaAtiva.hora_fim}:00
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Intervalo</span>
                    <span className="text-white">
                      {campanhaAtiva.intervalo_min} - {campanhaAtiva.intervalo_max} min
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-white/40">Status</span>
                    <Badge
                      variant={campanhaAtiva.status === "ativo" ? "default" : "secondary"}
                      className={campanhaAtiva.status === "ativo" ? "bg-emerald-500" : ""}
                    >
                      {campanhaAtiva.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-[#13131F] border-white/10">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-white/60">
                      Conteúdos Ativos
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 border-white/10 text-white/40"
                    >
                      {selectedContentIds.length} Itens
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                    {biblioteca
                      .filter((item) => selectedContentIds.includes(item.id))
                      .map((item) => (
                        <div
                          key={item.id}
                          className="relative aspect-video rounded-md overflow-hidden group"
                        >
                          {loadingUrls[item.id] ? (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            </div>
                          ) : signedUrls[item.id] ? (
                            <video
                              src={signedUrls[item.id]}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center bg-white/5">
                              <X className="w-4 h-4 text-red-500/50" />
                            </div>
                          )}
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
                                  setSelectedContentIds((prev) =>
                                    prev.filter((id) => id !== item.id),
                                  );
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
