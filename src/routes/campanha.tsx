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
  Layers,
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
  ShieldCheck,
} from "lucide-react";
import { format, addDays, differenceInDays, isBefore, isAfter, startOfDay, addMinutes, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { artistService } from "@/services/artists";
import { contentService } from "@/services/content";
import { socialService, type SocialAccount } from "@/services/social";
import { storageService } from "@/services/storage";

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
    repeat_policy: "never" as "never" | "cooldown",
    distribution_interval_minutes: 5,
    editorial_language: "pt-BR",
    editorial_style: "engaging",
    audio_mode: 'music_plus_original' as 'only_music' | 'music_plus_original' | 'only_original',
    music_volume: 80,
    original_audio_volume: 20,
    music_start_ms: 0,
    // Novos campos da Fase 3.6
    start_mode: "period" as "period" | "now",
    daily_start_time: "09:00",
    daily_end_time: "21:00",
    batch_interval_minutes: 60,
    destination_interval_seconds: 60,
  });


  // Calculate Scheduling Preview
  const schedulingPreview = useMemo(() => {
    if (!selectedAccountIds.length || !selectedContentIds.length) {
      return [];
    }

    const preview: any[] = [];
    const isNow = formData.start_mode === "now";
    const now = new Date();
    const startDate = isNow ? now : new Date(formData.data_inicio + "T" + formData.daily_start_time);
    const endDate = new Date(formData.data_fim + "T" + formData.daily_end_time);

    // Identity & Anti-Repetition logic
    // We maintain a tracker of used content per account to avoid repetition
    const usedContentPerAccount = new Map<string, Set<string>>();
    selectedAccountIds.forEach(id => usedContentPerAccount.set(id, new Set()));

    if (isNow) {
      for (let batchIdx = 0; batchIdx < selectedContentIds.length; batchIdx++) {
        const batchStartTime = addMinutes(now, batchIdx * formData.batch_interval_minutes);
        
        selectedAccountIds.forEach((accountId, accIdx) => {
          const account = socialAccounts.find(a => a.id === accountId);
          const scheduledTime = addMinutes(batchStartTime, (accIdx * formData.destination_interval_seconds) / 60);
          
          // Selection logic with anti-repetition
          let videoIdx = batchIdx % selectedContentIds.length;
          
          if (formData.repeat_policy === 'never') {
            const used = usedContentPerAccount.get(accountId)!;
            // Find first unused video in the selection for this specific account
            let found = false;
            for (let i = 0; i < selectedContentIds.length; i++) {
              const checkIdx = (batchIdx + i) % selectedContentIds.length;
              if (!used.has(selectedContentIds[checkIdx])) {
                videoIdx = checkIdx;
                used.add(selectedContentIds[checkIdx]);
                found = true;
                break;
              }
            }
            if (!found) return; // Stock exhausted for this account
          }
          
          preview.push({
            date: scheduledTime,
            accountId,
            accountName: account?.account_name || "Conta",
            videoIndex: videoIdx,
            platform: account?.platform || "tiktok",
            isNow: batchIdx === 0 && accIdx === 0
          });
        });
      }
    } else {
      const [startH, startM] = formData.daily_start_time.split(":").map(Number);
      const [endH, endM] = formData.daily_end_time.split(":").map(Number);
      const postsPerDay = formData.posts_por_dia;
      
      let currentDay = startOfDay(startDate);
      let batchCounter = 0;

      while (isBefore(currentDay, endDate) || currentDay.getTime() === startOfDay(endDate).getTime()) {
        const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
        const interval = totalMinutes > 0 ? totalMinutes / Math.max(1, postsPerDay) : 0;

        for (let p = 0; p < postsPerDay; p++) {
          const batchTime = addMinutes(setMinutes(setHours(currentDay, startH), startM), interval * p);
          if (isBefore(batchTime, startDate) || isAfter(batchTime, endDate)) continue;

          selectedAccountIds.forEach((accountId, accIdx) => {
            const account = socialAccounts.find(a => a.id === accountId);
            const scheduledTime = addMinutes(batchTime, (accIdx * formData.destination_interval_seconds) / 60);

            let videoIdx = batchCounter % selectedContentIds.length;
            const used = usedContentPerAccount.get(accountId)!;

            if (formData.repeat_policy === 'never') {
              let found = false;
              for (let i = 0; i < selectedContentIds.length; i++) {
                const checkIdx = (batchCounter + i + accIdx) % selectedContentIds.length; // accIdx helps randomize order between accounts
                if (!used.has(selectedContentIds[checkIdx])) {
                  videoIdx = checkIdx;
                  used.add(selectedContentIds[checkIdx]);
                  found = true;
                  break;
                }
              }
              if (!found) return; // Stock exhausted
            } else if (formData.distribution_mode === 'intelligent') {
              const seed = batchTime.getTime() + accIdx;
              videoIdx = Math.floor(Math.abs(Math.sin(seed) * selectedContentIds.length));
            }

            preview.push({
              date: scheduledTime,
              accountId,
              accountName: account?.account_name || "Conta",
              videoIndex: videoIdx,
              platform: account?.platform || "tiktok"
            });
          });
          batchCounter++;
        }
        currentDay = addDays(currentDay, 1);
      }
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

      // 1. Generate safe storage path
      const extension = storageService.getFileExtension(newMusicData.file.name);
      
      if (!storageService.isSupportedExtension(extension, ['mp3', 'wav', 'm4a'])) {
        throw new Error("Formato de áudio não suportado (apenas MP3, WAV, M4A).");
      }

      const filePath = storageService.generateSafePath({
        userId: user.id,
        assetType: 'music',
        extension,
        artistId: formData.artist_id
      });

      console.log('Iniciando upload seguro para o bucket musicas (campanha):', filePath);

      const { error: uploadError } = await supabase.storage
        .from('musicas')
        .upload(filePath, newMusicData.file, {
          cacheControl: '3600',
          upsert: true,
          contentType: newMusicData.file.type
        });

      if (uploadError) {
        console.error('Erro upload storage:', uploadError);
        throw new Error("Não foi possível enviar o arquivo de áudio.");
      }

      // 2. Insert into DB
      const { data: music, error: dbError } = await supabase
        .from('music_tracks')
        .insert({
          nome: newMusicData.nome,
          artist_id: formData.artist_id,
          storage_path: filePath,
          user_id: user.id
        })
        .select()
        .single();

      if (dbError) {
        // Rollback Storage
        await storageService.cleanup('musicas', filePath);
        throw dbError;
      }

      // 3. Update local state and select it
      setMusicas(prev => [music as any, ...prev]);
      setFormData(prev => ({ ...prev, music_track_id: music.id }));
      setIsMusicModalOpen(false);
      setNewMusicData({ nome: "", file: null, uploading: false });
      toast.success("Música adicionada e selecionada!");
    } catch (error: any) {
      console.error("[UPLOAD ERROR CAMPANHA]", error);
      toast.error(error.message || "Erro ao adicionar música.");
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
      const { data: newCamp, error: campError } = await supabase
        .from("campanhas")
        .insert({
          nome: formData.nome,
          artist_id: formData.artist_id,
          music_track_id: formData.music_track_id,
          posts_por_dia: formData.posts_por_dia,
          hora_inicio: parseInt(formData.daily_start_time.split(":")[0]), // Reutilizando para legado
          hora_fim: parseInt(formData.daily_end_time.split(":")[0]), // Reutilizando para legado
          intervalo_min: formData.intervalo_min,
          intervalo_max: formData.intervalo_max,
          data_inicio: formData.start_mode === 'now' ? format(new Date(), "yyyy-MM-dd") : formData.data_inicio,
          data_fim: formData.data_fim,
          status: "ativo",
          user_id: user.id,
          distribution_mode: formData.distribution_mode,
          distribution_variation: formData.distribution_variation,
          cooldown_days: formData.cooldown_days,
          editorial_language: formData.editorial_language,
          audio_mode: formData.audio_mode,
          music_volume: formData.music_volume,
          original_audio_volume: formData.original_audio_volume,
          music_start_ms: formData.music_start_ms,
          // Novos campos
          start_mode: formData.start_mode,
          daily_start_time: formData.daily_start_time,
          daily_end_time: formData.daily_end_time,
          batch_interval_minutes: formData.batch_interval_minutes,
          destination_interval_seconds: formData.destination_interval_seconds,
          timezone: formData.timezone,
          repeat_policy: formData.repeat_policy
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

      // 4. Generate Publications based on Preview
      const publicationInserts = schedulingPreview.map(p => ({
        campaign_id: newCamp.id,
        social_account_id: p.accountId,
        content_id: selectedContentIds[p.videoIndex],
        scheduled_for: p.date.toISOString(),
        status: 'agendado',
        timezone: formData.timezone,
        user_id: user.id
      }));

      const { error: pubError } = await supabase
        .from("publications")
        .insert(publicationInserts);

      if (pubError) throw pubError;

      // 5. Update music track
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

                <div className="space-y-6 pt-4 border-t border-white/5">
                  <Label className="text-white text-base font-semibold uppercase">Programação</Label>
                  
                  <div className="space-y-4">
                    <Label className="text-white/80">Quando a campanha deve começar?</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setFormData({ ...formData, start_mode: 'period' })}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          formData.start_mode === 'period' 
                            ? "bg-[#7C3AED]/10 border-[#7C3AED] text-white" 
                            : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                        }`}
                      >
                        <Calendar size={20} />
                        <span className="text-sm font-bold">Programar Período</span>
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, start_mode: 'now' })}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          formData.start_mode === 'now' 
                            ? "bg-[#7C3AED]/10 border-[#7C3AED] text-white" 
                            : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                        }`}
                      >
                        <Play size={20} />
                        <span className="text-sm font-bold">Começar Agora</span>
                      </button>
                    </div>
                  </div>

                  {formData.start_mode === 'period' ? (
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
                          <Label className="text-white/80">Janela: De</Label>
                          <Input
                            type="time"
                            className="bg-white/5 border-white/10 text-white"
                            value={formData.daily_start_time}
                            onChange={(e) => setFormData({ ...formData, daily_start_time: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-white/80">Até</Label>
                          <Input
                            type="time"
                            className="bg-white/5 border-white/10 text-white"
                            value={formData.daily_end_time}
                            onChange={(e) => setFormData({ ...formData, daily_end_time: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-white/80">Primeiro Conteúdo</Label>
                        <div className="h-10 px-3 bg-white/5 border border-white/10 rounded-md flex items-center text-emerald-500 font-bold text-sm">
                          AGORA (Na confirmação)
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-white/80">Intervalo entre Conteúdos</Label>
                        <Select
                          value={formData.batch_interval_minutes.toString()}
                          onValueChange={(v) => setFormData({ ...formData, batch_interval_minutes: parseInt(v) })}
                        >
                          <SelectTrigger className="bg-white/5 border-white/10 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#13131F] border-white/10 text-white">
                            <SelectItem value="5">5 minutos</SelectItem>
                            <SelectItem value="15">15 minutos</SelectItem>
                            <SelectItem value="30">30 minutos</SelectItem>
                            <SelectItem value="60">1 hora</SelectItem>
                            <SelectItem value="120">2 horas</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}

                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-primary text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                        <ShieldCheck size={14} /> Configurações de Distribuição (Avançado)
                      </Label>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-white/60 text-[10px] uppercase font-bold">Repetição de Conteúdo</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, repeat_policy: 'never' })}
                            className={`flex items-center justify-between p-3 rounded-lg border text-[10px] font-bold transition-all ${
                              formData.repeat_policy === 'never'
                                ? "bg-primary/20 border-primary text-white"
                                : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                            }`}
                          >
                            <span>NUNCA REPETIR NA CONTA</span>
                            {formData.repeat_policy === 'never' && <Check size={12} />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, repeat_policy: 'cooldown' })}
                            className={`flex items-center justify-between p-3 rounded-lg border text-[10px] font-bold transition-all ${
                              formData.repeat_policy === 'cooldown'
                                ? "bg-primary/20 border-primary text-white"
                                : "bg-white/5 border-white/10 text-white/40 hover:border-white/20"
                            }`}
                          >
                            <span>PERMITIR APÓS COOLDOWN</span>
                            {formData.repeat_policy === 'cooldown' && <Check size={12} />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-white/60 text-[10px] uppercase font-bold">Intervalo entre Destinos (Contas)</Label>
                          <Select
                            value={formData.destination_interval_seconds.toString()}
                            onValueChange={(v) => setFormData({ ...formData, destination_interval_seconds: parseInt(v) })}
                          >
                            <SelectTrigger className="bg-white/5 border-white/10 text-white h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-[#13131F] border-white/10 text-white">
                              <SelectItem value="30">30 segundos</SelectItem>
                              <SelectItem value="60">1 minuto</SelectItem>
                              <SelectItem value="120">2 minutos</SelectItem>
                              <SelectItem value="300">5 minutos</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        
                        {/* Mostrar aviso de sobreposição se necessário */}
                        {(() => {
                          const totalDestinations = selectedAccountIds.length;
                          const timeNeededForBatch = (totalDestinations * formData.destination_interval_seconds) / 60;
                          const isOverlapping = formData.start_mode === 'now' && timeNeededForBatch > formData.batch_interval_minutes;
                          
                          if (isOverlapping) {
                            return (
                              <div className="flex items-center gap-2 text-yellow-500 bg-yellow-500/10 p-2 rounded border border-yellow-500/20 self-end h-8">
                                <AlertTriangle size={14} />
                                <span className="text-[10px] font-medium leading-tight">
                                  Sobreposição detectada.
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </div>
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
                      <div className="p-4 space-y-6">
                        <div className="relative pl-8 space-y-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-px before:bg-white/10">
                          {schedulingPreview.filter((_, i) => i === 0 || schedulingPreview[i-1].videoIndex !== _.videoIndex).slice(0, 10).map((batch, bIdx) => {
                            const batchPosts = schedulingPreview.filter(p => p.videoIndex === batch.videoIndex && Math.abs(p.date.getTime() - batch.date.getTime()) < 60000 * (selectedAccountIds.length + 1));
                            
                            return (
                              <div key={bIdx} className="relative">
                                <div className="absolute -left-[25px] top-1.5 w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(124,58,237,0.5)]" />
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                                      Lote {bIdx + 1} — {batch.isNow ? 'AGORA' : format(batch.date, "HH:mm")}
                                      {batch.isNow && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] h-4">Início Imediato</Badge>}
                                    </span>
                                    <span className="text-[10px] text-white/40">{format(batch.date, "dd/MM/yyyy")}</span>
                                  </div>
                                  <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                        <Layers size={14} />
                                      </div>
                                      <div>
                                        <p className="text-[10px] text-white/60 font-medium">Conteúdo #{batch.videoIndex + 1}</p>
                                        <p className="text-[9px] text-white/40">{selectedAccountIds.length} destinos programados</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {batchPosts.slice(0, 5).map((p, pIdx) => (
                                        <Badge key={pIdx} variant="outline" className="text-[8px] h-4 border-white/5 text-white/40">
                                          {p.accountName}
                                        </Badge>
                                      ))}
                                      {batchPosts.length > 5 && <span className="text-[8px] text-white/20">+{batchPosts.length - 5}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {schedulingPreview.length > 10 && (
                            <div className="text-center py-2">
                              <p className="text-[10px] text-white/20 italic">...e mais {Math.floor(schedulingPreview.length / selectedAccountIds.length) - 10} lotes</p>
                            </div>
                          )}
                        </div>
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

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Calendar size={12} className="text-primary" /> Dias Restantes
                    </div>
                    <div className="text-xl font-bold text-white">
                      {Math.max(0, differenceInDays(new Date(campanhaAtiva.data_fim), new Date()))}
                    </div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-500" /> Contas
                    </div>
                    <div className="text-xl font-bold text-white">{selectedAccountIds.length}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Layers size={12} className="text-[#7C3AED]" /> Conteúdos
                    </div>
                    <div className="text-xl font-bold text-white">{selectedContentIds.length}</div>
                  </div>
                  <div className="bg-white/5 p-4 rounded-xl space-y-1">
                    <div className="text-white/40 text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Megaphone size={12} className="text-blue-500" /> Total Posts
                    </div>
                    <div className="text-xl font-bold text-white">{totalPosts}</div>
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
