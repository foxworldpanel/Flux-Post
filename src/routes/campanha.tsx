import { useState, useEffect, useMemo, useRef } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
  Zap,
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
  Video,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Eye,
} from "lucide-react";
import { format, addDays, differenceInDays, isBefore, isAfter, startOfDay, addMinutes, setHours, setMinutes } from "date-fns";
import { ptBR } from "date-fns/locale";
import { artistService } from "@/services/artists";
import { contentService } from "@/services/content";
import { socialService, type SocialAccount } from "@/services/social";
import { storageService } from "@/services/storage";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  repeat_policy?: string;
  start_mode?: "period" | "now";
  daily_start_time?: string;
  daily_end_time?: string;
  batch_interval_minutes?: number;
  destination_interval_seconds?: number;
  timezone?: string;
  music_tracks?: MusicTrack;
  artists?: Artist;
};

type MediaRender = {
  id: string;
  source_content_id: string;
  music_track_id: string;
  status: 'queued' | 'processing' | 'ready' | 'failed';
  storage_path: string | null;
  error_message: string | null;
  attempts: number;
  created_at: string;
  completed_at: string | null;
  render_key: string;
  render_options?: any;
  is_approved?: boolean;
};

const RENDER_PIPELINE_VERSION = "v1";

function generateRenderKey(params: {
  contentId: string;
  musicTrackId: string;
  musicStartMs: number;
  musicVolume: number;
  originalAudioVolume: number;
  audioMode: string;
}) {
  const parts = [
    params.contentId,
    params.musicTrackId,
    params.musicStartMs.toString(),
    params.musicVolume.toString(),
    params.originalAudioVolume.toString(),
    params.audioMode,
    RENDER_PIPELINE_VERSION
  ];
  // Simple deterministic string. For a real hash we'd need a library, but this is canonical.
  return parts.join("|");
}

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
  const [renders, setRenders] = useState<MediaRender[]>([]);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewTitle, setPreviewTitle] = useState("");
  const [publications, setPublications] = useState<any[]>([]);
  
  // FASE 4.6 - Stepper State
  const [step, setStep] = useState(1);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

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

      // 1. Check for active or paused campaign (operational)
      const { data: allCamps, error: allErr } = await supabase
        .from("campanhas")
        .select("*, music_tracks(id, nome, artista, storage_path, artist_id), artists(id, name)")
        .in("status", ["ativo", "pausado"])
        .order("data_inicio", { ascending: false });
      
      console.log("[AUDIT] CAMPANHAS OPERACIONAIS ACESSÍVEIS:", allCamps);

      const campanhas = allCamps?.[0];

      if (campanhas) {
        console.log("[AUDIT] CAMPANHA SELECIONADA PARA UI:", campanhas);
        setCampanhaAtiva(campanhas as any);

        // Fetch publications
        const { data: pubsData, error: pubsError } = await supabase
          .from("publications")
          .select("*")
          .eq("campaign_id", campanhas.id);

        if (!pubsError && pubsData) {
          setPublications(pubsData);
          setTotalPosts(pubsData.filter(p => p.status === 'published').length);
        }

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
        
        // Fetch renders
        fetchRenders(campanhas.id);
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

      // Validação de integridade das músicas no storage
      const validatedTracks = await Promise.all((tracksRes.data || []).map(async (track) => {
        if (!track.storage_path) return { ...track, is_available: false };
        const { data: exists } = await supabase.storage
          .from('musicas')
          .list(track.storage_path.split('/').slice(0, -1).join('/'), {
            search: track.storage_path.split('/').pop()
          });
        return { ...track, is_available: exists && exists.length > 0 };
      }));

      setArtistas(artistsRes || []);
      setMusicas(validatedTracks as any);
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

  async function fetchRenders(campaignId: string) {
    try {
      // Get all render keys for this campaign's publications to filter correctly
      const { data: pubs, error: pubsErr } = await supabase
        .from('publications')
        .select('metadata, render_options')
        .eq('campaign_id', campaignId);
      
      if (pubsErr) throw pubsErr;

      // Extract render_key from render_options (standard) or metadata (fallback)
      const renderKeys = (pubs || [])
        .map(p => {
           const ro = p.render_options as any;
           const md = p.metadata as any;
           return ro?.render_key || md?.render_key;
        })
        .filter(Boolean);
      
      if (renderKeys.length === 0) return;

      const { data: rendersData, error } = await supabase
        .from('media_renders')
        .select('*')
        .in('render_key', renderKeys);

      if (error) throw error;
      setRenders((rendersData as any) || []);
    } catch (err) {
      console.error("Erro ao buscar renders:", err);
    }
  }

  // Realtime subscription for renders (works during preparation too)
  useEffect(() => {
    // Escutar renders do usuário (RLS garante que sejam apenas os dele)
    const channel = supabase
      .channel('schema-db-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_renders',
          // We can't filter by campaign_id directly as it's not in media_renders
          // but we filter by user_id which RLS already does
        },
        (payload) => {
          console.log('Realtime render update:', payload);
          if (payload.eventType === 'INSERT') {
            setRenders(prev => [...prev, payload.new as MediaRender]);
          } else if (payload.eventType === 'UPDATE') {
            setRenders(prev => prev.map(r => r.id === payload.new.id ? (payload.new as MediaRender) : r));
          } else if (payload.eventType === 'DELETE') {
            setRenders(prev => prev.filter(r => r.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const renderStats = useMemo(() => {
    return {
      total: renders.length,
      queued: renders.filter(r => r.status === 'queued').length,
      processing: renders.filter(r => r.status === 'processing').length,
      ready: renders.filter(r => r.status === 'ready').length,
      failed: renders.filter(r => r.status === 'failed').length,
    };
  }, [renders]);

  async function handlePreviewRender(render: MediaRender, title: string) {
    if (!render.storage_path) return;
    
    setIsPreviewLoading(true);
    setPreviewTitle(title);
    setIsPreviewOpen(true);
    
    try {
      const { data, error } = await supabase.storage
        .from('rendered')
        .createSignedUrl(render.storage_path, 3600);
      
      if (error) throw error;
      setPreviewVideoUrl(data.signedUrl);
    } catch (err: any) {
      toast.error("Erro ao gerar preview: " + err.message);
      setIsPreviewOpen(false);
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function handleRerender(render: MediaRender) {
    try {
      const { error } = await supabase
        .from('media_renders')
        .update({ 
          status: 'queued', 
          attempts: 0, 
          error_message: null,
          started_at: null,
          completed_at: null
        })
        .eq('id', render.id);

      if (error) throw error;
      toast.success("Renderização reiniciada!");
    } catch (err: any) {
      toast.error("Erro ao reiniciar: " + err.message);
    }
  }

  async function handleProcessBatch() {
    if (!formData.music_track_id) {
      toast.error("Selecione uma música primeiro.");
      return;
    }
    if (selectedContentIds.length === 0) {
      toast.error("Selecione vídeos para processar.");
      return;
    }

    setIsProcessingBatch(true);
    const loadingToast = toast.loading(`Criando jobs para ${selectedContentIds.length} vídeos...`);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      const renderOptions = {
        musicStartMs: formData.music_start_ms,
        musicVolume: formData.music_volume,
        originalAudioVolume: formData.original_audio_volume,
        audioMode: formData.audio_mode
      };

      const jobs = selectedContentIds.map(contentId => {
        const render_key = generateRenderKey({
          contentId,
          musicTrackId: formData.music_track_id,
          musicStartMs: formData.music_start_ms,
          musicVolume: formData.music_volume,
          originalAudioVolume: formData.original_audio_volume,
          audioMode: formData.audio_mode
        });
        
        // Antes de enviar, verificamos se o render já existe e seu status
        const existing = renders.find(r => r.render_key === render_key);
        if (existing && (existing.status === 'ready' || existing.status === 'processing' || existing.status === 'queued')) {
           return null;
        }

        return {
          user_id: user.id,
          source_content_id: contentId,
          music_track_id: formData.music_track_id,
          render_key,
          render_options: renderOptions,
          status: 'queued' as const,
          attempts: 0,
          audio_mode: formData.audio_mode,
          music_start_ms: formData.music_start_ms,
          music_volume: formData.music_volume,
          original_audio_volume: formData.original_audio_volume
        };
      }).filter((job): job is NonNullable<typeof job> => job !== null);

      if (jobs.length === 0) {
        toast.success("Todos os vídeos selecionados já estão processados ou em fila.");
        setIsProcessingBatch(false);
        toast.dismiss(loadingToast);
        return;
      }

      // Insert with upsert to respect render_key idempotency
      const { error } = await supabase
        .from('media_renders')
        .upsert(jobs, { onConflict: 'render_key' });

      if (error) throw error;

      toast.success(`${selectedContentIds.length} vídeos enviados para a fila de renderização!`);
      
      // Trigger dispatcher to start processing immediately
      supabase.functions.invoke('campaign-dispatcher');
      
      // Refresh renders list
      if (campanhaAtiva) {
        fetchRenders(campanhaAtiva.id);
      } else {
        // Se for uma campanha nova, buscamos todos os renders do usuário recentes
        const { data: latestRenders } = await supabase
          .from('media_renders')
          .select('*')
          .in('source_content_id', selectedContentIds)
          .eq('music_track_id', formData.music_track_id);
        
        setRenders((latestRenders as any) || []);
      }
      
      // Não avançamos o step (removido), o usuário permanece na mesma tela para acompanhar
      toast.success("Monitorando progresso real na biblioteca.");
    } catch (err: any) {
      console.error("Erro ao processar lote:", err);
      toast.error("Falha ao criar jobs: " + err.message);
    } finally {
      setIsProcessingBatch(false);
      toast.dismiss(loadingToast);
    }
  }

  async function handleToggleApproval(renderId: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('media_renders')
        .update({ is_approved: !currentStatus })
        .eq('id', renderId);
      
      if (error) throw error;
      
      setRenders(prev => prev.map(r => r.id === renderId ? { ...r, is_approved: !currentStatus } : r));
      toast.success(!currentStatus ? "Vídeo aprovado!" : "Aprovação removida.");
    } catch (err: any) {
      toast.error("Erro ao atualizar aprovação: " + err.message);
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

  // Trigger dispatcher once to clear queue when landing on active campaign (UI Trigger Fallback)
  useEffect(() => {
    if (!loading && campanhaAtiva) {
      const timer = setTimeout(() => {
        supabase.functions.invoke('campaign-dispatcher').then(({ data, error }) => {
          if (!error) {
            console.log("[UI-TRIGGER] Fila processada via trigger da interface", data);
            fetchData();
          }
        });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [campanhaAtiva?.id, loading]);

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

    // Validação de Renders Prontos (P0)
    const currentRenders = selectedContentIds.map(id => {
      const rKey = generateRenderKey({
        contentId: id,
        musicTrackId: formData.music_track_id,
        musicStartMs: formData.music_start_ms,
        musicVolume: formData.music_volume,
        originalAudioVolume: formData.original_audio_volume,
        audioMode: formData.audio_mode
      });
      return renders.find(r => r.render_key === rKey);
    });

    const readyCount = currentRenders.filter(r => r?.status === 'ready').length;
    const allReady = readyCount === selectedContentIds.length;

    if (!allReady) {
      toast.error(`${readyCount} de ${selectedContentIds.length} vídeos prontos. Aguarde o processamento terminar.`);
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

      // 4. Generate Publications based on Preview (Atomic check)
      const expectedCount = schedulingPreview.length;
      if (expectedCount > 0) {
        const publicationInserts = schedulingPreview.map(p => {
          const contentId = selectedContentIds[p.videoIndex];
          const rKey = generateRenderKey({
            contentId,
            musicTrackId: formData.music_track_id,
            musicStartMs: formData.music_start_ms,
            musicVolume: formData.music_volume,
            originalAudioVolume: formData.original_audio_volume,
            audioMode: formData.audio_mode
          });
          const render = renders.find(r => r.render_key === rKey);

          return {
            campaign_id: newCamp.id,
            social_account_id: p.accountId,
            content_id: contentId,
            music_track_id: formData.music_track_id,
            media_render_id: render?.id, // Vínculo inequívoco (P0)
            scheduled_for: p.date.toISOString(),
            status: 'agendado',
            timezone: formData.timezone,
            user_id: user.id,
            platform: p.platform || 'tiktok',
            render_options: {
              render_key: rKey,
              videoId: contentId,
              musicId: formData.music_track_id,
              musicStartMs: formData.music_start_ms,
              musicVolume: formData.music_volume,
              originalAudioVolume: formData.original_audio_volume,
              audioMode: formData.audio_mode
            }
          };
        });

        const { data: createdPubs, error: pubError } = await supabase
          .from("publications")
          .insert(publicationInserts)
          .select('id');

        if (pubError) throw pubError;
        if (!createdPubs || createdPubs.length !== expectedCount) {
          throw new Error(`Falha na integridade: esperado ${expectedCount} publicações, criado ${createdPubs?.length || 0}.`);
        }
      }

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

  async function handleDeleteCampaign() {
    if (!campanhaAtiva) return;

    if (!window.confirm("ATENÇÃO: Isso excluirá permanentemente a campanha e todas as suas publicações agendadas. Os vídeos da biblioteca e músicas NÃO serão excluídos. Deseja continuar?")) {
      return;
    }

    setSaving(true);
    try {
      // 1. Desvincular música da campanha ativa
      await supabase
        .from("music_tracks")
        .update({ campanha_ativa: false })
        .eq("id", campanhaAtiva.music_track_id);

      // 2. Excluir a campanha (Cascade cuidará das tabelas vinculadas)
      const { error } = await supabase
        .from("campanhas")
        .delete()
        .eq("id", campanhaAtiva.id);

      if (error) throw error;

      toast.success("Campanha excluída com sucesso!");
      
      // 3. Reset state
      setCampanhaAtiva(null);
      setSelectedContentIds([]);
      setSelectedAccountIds([]);
      setStep(1);
      
      fetchData();
    } catch (error: any) {
      toast.error("Erro ao excluir campanha: " + error.message);
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


  const canAdvance = () => {
    switch (step) {
      case 1:
        return formData.nome && formData.artist_id;
      case 2:
        return formData.music_track_id !== "";
      case 3:
        return selectedContentIds.length > 0;
      case 4:
        const currentRenders = selectedContentIds.map(id => {
          const rKey = generateRenderKey({
            contentId: id,
            musicTrackId: formData.music_track_id,
            musicStartMs: formData.music_start_ms,
            musicVolume: formData.music_volume,
            originalAudioVolume: formData.original_audio_volume,
            audioMode: formData.audio_mode
          });
          return renders.find(r => r.render_key === rKey);
        });
        return currentRenders.length > 0 && currentRenders.every(r => r?.status === 'ready');
      case 5:
        const approvedCount = selectedContentIds.filter(id => {
          const rKey = generateRenderKey({
            contentId: id,
            musicTrackId: formData.music_track_id,
            musicStartMs: formData.music_start_ms,
            musicVolume: formData.music_volume,
            originalAudioVolume: formData.original_audio_volume,
            audioMode: formData.audio_mode
          });
          return renders.find(r => r.render_key === rKey)?.is_approved;
        }).length;
        return approvedCount > 0;
      case 6:
        return selectedAccountIds.length > 0;
      default:
        return false;
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-xl font-medium text-foreground/50">
            Carregando informações da campanha...
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (

    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500 pb-20">
        <div className="flex items-center justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-3xl font-bold text-foreground">
              {campanhaAtiva ? "Campanha Ativa" : "Preparar Campanha"}
            </h1>
            {!campanhaAtiva && (
              <div className="flex items-center gap-2 mt-2">
                <Badge variant="outline" className="bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20 uppercase font-bold tracking-widest text-[10px]">
                  Etapa {step} de 6
                </Badge>
              </div>
            )}
          </div>
          {campanhaAtiva && (
            <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 px-3 py-1 uppercase font-bold tracking-widest text-[10px]">
              OPERACIONAL
            </Badge>
          )}
        </div>

        {!campanhaAtiva && (
          <div className="space-y-4">
            <div className="flex justify-between items-center px-2">
              {[1, 2, 3, 4, 5, 6].map((s) => (
                <div key={s} className="flex flex-col items-center gap-2">
                  <div 
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                      step === s ? "bg-[#7C3AED] text-white ring-4 ring-[#7C3AED]/20" : 
                      step > s ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step > s ? <Check size={14} /> : s}
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-tighter ${step === s ? "text-[#7C3AED]" : "text-muted-foreground"}`}>
                    {s === 1 ? "Dados" : s === 2 ? "Música" : s === 3 ? "Vídeos" : s === 4 ? "Processar" : s === 5 ? "Aprovar" : "Publicar"}
                  </span>
                </div>
              ))}
            </div>
            <Progress value={(step / 6) * 100} className="h-1 bg-muted" />
          </div>
        )}


        {!campanhaAtiva ? (
          <div className="space-y-6">
            {step === 1 && (
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Megaphone className="text-primary" />
                    Etapa 1 — Configurar
                  </CardTitle>
                  <CardDescription className="text-muted-foreground">
                    Configure os parâmetros para sua automação de postagens.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Artista</Label>
                  <Select
                    value={formData.artist_id}
                    onValueChange={(v) => setFormData({ ...formData, artist_id: v })}
                  >
                    <SelectTrigger className="bg-muted/50 border-border text-foreground">
                      <SelectValue placeholder="Selecione um artista" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {artistas.map((artist) => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-muted-foreground">Posts por dia</Label>
                  <Select
                    value={formData.posts_por_dia.toString()}
                    onValueChange={(v) => setFormData({ ...formData, posts_por_dia: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-muted/50 border-border text-foreground">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      {[1, 2, 3, 4, 5].map((num) => (
                        <SelectItem key={num} value={num.toString()}>
                          {num} {num === 1 ? 'post' : 'posts'} / dia
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Data de Início</Label>
                  <Input
                    type="date"
                    className="bg-muted/50 border-border text-foreground"
                    value={formData.data_inicio}
                    onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground">Data de Fim</Label>
                  <Input
                    type="date"
                    className="bg-muted/50 border-border text-foreground"
                    value={formData.data_fim}
                    onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Janela de Horário</Label>
                  <div className="flex gap-2">
                    <Input
                      type="time"
                      className="bg-muted/50 border-border text-foreground"
                      value={formData.horario_inicio}
                      onChange={(e) => setFormData({ ...formData, horario_inicio: e.target.value })}
                    />
                    <Input
                      type="time"
                      className="bg-muted/50 border-border text-foreground"
                      value={formData.horario_fim}
                      onChange={(e) => setFormData({ ...formData, horario_fim: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-muted-foreground text-[10px] font-bold uppercase tracking-wider">Intervalo entre Contas (min)</Label>
                  <Select
                    value={formData.intervalo_contas_min.toString()}
                    onValueChange={(v) => setFormData({ ...formData, intervalo_contas_min: parseInt(v) })}
                  >
                    <SelectTrigger className="bg-muted/50 border-border text-foreground">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-card border-border text-foreground">
                      <SelectItem value="30">30 minutos</SelectItem>
                      <SelectItem value="45">45 minutos</SelectItem>
                      <SelectItem value="60">60 minutos</SelectItem>
                      <SelectItem value="90">90 minutos</SelectItem>
                      <SelectItem value="120">120 minutos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Music2 className="text-primary" />
                Etapa 2 — Escolher Música
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Selecione a trilha sonora para seus vídeos.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="space-y-4">
                <Label className="text-foreground text-base font-semibold uppercase">Trilha Sonora</Label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Select
                      value={formData.music_track_id}
                      onValueChange={(v) => setFormData({ ...formData, music_track_id: v })}
                      disabled={!formData.artist_id}
                    >
                      <SelectTrigger className="bg-muted/50 border-border text-foreground flex-1">
                        <SelectValue
                          placeholder={
                            formData.artist_id
                              ? "Selecione uma música"
                              : "Selecione um artista primeiro"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        {musicas
                          .filter((m) => m.artist_id === formData.artist_id)
                          .map((m: any) => (
                            <SelectItem key={m.id} value={m.id} disabled={!m.is_available}>
                              <div className="flex items-center justify-between w-full gap-2">
                                <span>{m.nome}</span>
                                {!m.is_available && (
                                  <Badge variant="destructive" className="text-[10px] py-0 px-1">Arquivo Ausente</Badge>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Dialog open={isMusicModalOpen} onOpenChange={setIsMusicModalOpen}>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="shrink-0 bg-muted/50 border-border text-foreground hover:bg-white/10"
                        disabled={!formData.artist_id}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle className="text-xl font-bold">Nova Música</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
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
                            className="bg-muted/50 border-border text-foreground"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="music-file">Arquivo de Áudio (MP3/WAV)</Label>
                          <Input
                            id="music-file"
                            type="file"
                            accept="audio/*"
                            className="bg-muted/50 border-border text-foreground"
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
                          className="bg-[#7C3AED] hover:bg-[#6D28D9] text-foreground w-full"
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

              <div className="space-y-4 pt-4 border-t border-border">
                <Label className="text-foreground text-base font-semibold uppercase">Configurações de Áudio</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Modo de Áudio</Label>
                    <Select
                      value={formData.audio_mode}
                      onValueChange={(v: any) => setFormData({ ...formData, audio_mode: v })}
                    >
                      <SelectTrigger className="bg-muted/50 border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="music_plus_original">Música + Áudio Original (Mix)</SelectItem>
                        <SelectItem value="only_music">Somente Música</SelectItem>
                        <SelectItem value="only_original">Somente Áudio Original (Sem Processar)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex justify-between">
                      Volume da Música
                      <span className="text-primary font-mono">{formData.music_volume}%</span>
                    </Label>
                    <Slider
                      value={[formData.music_volume]}
                      min={0}
                      max={200}
                      step={1}
                      onValueChange={([v]) => setFormData({ ...formData, music_volume: v })}
                      className="py-4"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex justify-between">
                      Volume Original
                      <span className="text-primary font-mono">{formData.original_audio_volume}%</span>
                    </Label>
                    <Slider
                      value={[formData.original_audio_volume]}
                      min={0}
                      max={200}
                      step={1}
                      onValueChange={([v]) => setFormData({ ...formData, original_audio_volume: v })}
                      className="py-4"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-muted-foreground flex justify-between">
                      Início da Música (segundos)
                      <span className="text-primary font-mono">{(formData.music_start_ms / 1000).toFixed(1)}s</span>
                    </Label>
                    <Slider
                      value={[formData.music_start_ms]}
                      min={0}
                      max={60000}
                      step={500}
                      onValueChange={([v]) => setFormData({ ...formData, music_start_ms: v })}
                      className="py-4"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Video className="text-primary" />
                Etapa 3 — Escolher Vídeos
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Selecione os vídeos que farão parte desta campanha.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] bg-muted/50 border-border text-foreground"
                    onClick={() => setSelectedContentIds(libraryItems.map(i => i.id))}
                  >
                    Selecionar Todos
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[10px] bg-muted/50 border-border text-foreground"
                    onClick={() => setSelectedContentIds([])}
                  >
                    Desmarcar Todos
                  </Button>
                </div>
                <span className="text-[10px] font-bold text-primary uppercase tracking-widest">
                  {selectedContentIds.length} selecionados
                </span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {libraryItems.map((item) => {
                  const isSelected = selectedContentIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => toggleContentSelection(item.id)}
                      className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${
                        isSelected ? "border-primary ring-2 ring-primary/20 scale-[0.98]" : "border-border/50 opacity-60 grayscale-[0.5] hover:opacity-100"
                      }`}
                    >
                      {signedUrls[item.id] ? (
                        <video src={signedUrls[item.id]} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-muted flex items-center justify-center">
                          <Video className="text-muted-foreground" />
                        </div>
                      )}
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-5 h-5 bg-primary text-white rounded-full flex items-center justify-center shadow-lg">
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 4 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <RefreshCw className="text-primary" />
                Etapa 4 — Processar
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Renderize os vídeos selecionados com a música e configurações escolhidas.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="flex items-center justify-between">
                <Button 
                  onClick={handleProcessBatch}
                  disabled={processingBatch || selectedContentIds.length === 0}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-foreground font-bold"
                >
                  {processingBatch ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> PROCESSANDO...</>
                  ) : (
                    <><Zap className="mr-2 h-4 w-4" /> PROCESSAR TUDO</>
                  )}
                </Button>
                <div className="flex gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                  <span>Pool: {selectedContentIds.length}</span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {selectedContentIds.map(id => {
                  const item = libraryItems.find(i => i.id === id);
                  if (!item) return null;
                  const rKey = generateRenderKey({
                    contentId: id,
                    musicTrackId: formData.music_track_id,
                    musicStartMs: formData.music_start_ms,
                    musicVolume: formData.music_volume,
                    originalAudioVolume: formData.original_audio_volume,
                    audioMode: formData.audio_mode
                  });
                  const render = renders.find(r => r.render_key === rKey);

                  return (
                    <div key={id} className="bg-muted/30 border border-border rounded-xl p-3 flex gap-3">
                      <div className="w-16 aspect-[9/16] bg-black rounded overflow-hidden shrink-0 relative">
                        {signedUrls[id] && <video src={signedUrls[id]} className="w-full h-full object-cover" />}
                        {render && (
                          <div className={`absolute inset-0 flex items-center justify-center bg-black/40`}>
                            {render.status === 'ready' ? <CheckCircle2 className="text-emerald-500" size={16} /> :
                             render.status === 'failed' ? <AlertCircle className="text-red-500" size={16} /> :
                             <Loader2 className="text-primary animate-spin" size={16} />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                          <p className="text-[10px] font-bold text-foreground line-clamp-1">{item.title}</p>
                          <Badge 
                            variant="outline" 
                            className={`text-[8px] h-4 mt-1 border-none ${
                              render?.status === 'ready' ? 'bg-emerald-500 text-white' :
                              render?.status === 'processing' ? 'bg-yellow-500 text-black animate-pulse' :
                              render?.status === 'failed' ? 'bg-red-500 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}
                          >
                            {render?.status === 'ready' ? 'PRONTO' : 
                             render?.status === 'processing' ? 'PROCESSANDO' :
                             render?.status === 'failed' ? 'FALHOU' : 'AGUARDANDO'}
                          </Badge>
                        </div>
                        {render?.status === 'ready' && (
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-6 text-[8px] p-0 text-primary hover:text-primary/80 self-start"
                            onClick={() => handlePreviewRender(render, item.title)}
                          >
                            <Play size={8} className="mr-1" /> PREVIEW FINAL
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 5 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <CheckSquare className="text-primary" />
                Etapa 5 — Aprovar
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Revise os vídeos renderizados e aprove-os para publicação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {selectedContentIds.map(id => {
                  const item = libraryItems.find(i => i.id === id);
                  if (!item) return null;
                  const rKey = generateRenderKey({
                    contentId: id,
                    musicTrackId: formData.music_track_id,
                    musicStartMs: formData.music_start_ms,
                    musicVolume: formData.music_volume,
                    originalAudioVolume: formData.original_audio_volume,
                    audioMode: formData.audio_mode
                  });
                  const render = renders.find(r => r.render_key === rKey);
                  if (!render || render.status !== 'ready') return null;

                  return (
                    <div key={id} className={`bg-muted/30 border-2 rounded-xl overflow-hidden transition-all ${render.is_approved ? 'border-emerald-500/50' : 'border-border'}`}>
                      <div className="aspect-[9/16] bg-black relative group">
                         <video 
                           src={signedUrls[id]} // Idealmente seria a URL do rendered, mas handlePreviewRender cuida disso
                           className="w-full h-full object-cover" 
                           onClick={() => handlePreviewRender(render, item.title)}
                         />
                         <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <Button size="icon" variant="ghost" className="text-white" onClick={() => handlePreviewRender(render, item.title)}>
                               <Play size={24} fill="currentColor" />
                            </Button>
                         </div>
                         {render.is_approved && (
                           <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                             <Check size={12} />
                           </div>
                         )}
                      </div>
                      <div className="p-3 space-y-3">
                        <p className="text-[10px] font-bold text-foreground line-clamp-1">{item.title}</p>
                        <div className="flex gap-2">
                          <Button 
                            className={`flex-1 h-8 text-[10px] font-bold ${render.is_approved ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                            onClick={() => toggleApproval(render.id, true)}
                          >
                            APROVAR
                          </Button>
                          <Button 
                            variant="ghost"
                            className={`h-8 text-[10px] font-bold ${!render.is_approved && render.is_approved === false ? 'text-red-500' : 'text-muted-foreground'}`}
                            onClick={() => toggleApproval(render.id, false)}
                          >
                            REJEITAR
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {step === 6 && (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Globe className="text-primary" />
                Etapa 6 — Publicar
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Selecione as contas de destino e confirme a programação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8 pt-6">
              <div className="space-y-4">
                <Label className="text-foreground text-base font-semibold uppercase">Contas Sociais</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {contasSociais.map((account) => (
                    <div
                      key={account.id}
                      onClick={() => toggleAccount(account.id)}
                      className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                        selectedAccountIds.includes(account.id)
                          ? "bg-primary/5 border-primary"
                          : "bg-muted/30 border-border/50 hover:border-border"
                      }`}
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center relative overflow-hidden">
                        {account.avatar_url ? (
                          <img src={account.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-xs font-bold text-muted-foreground">{account.username?.[0]?.toUpperCase()}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold text-foreground truncate">{account.username}</p>
                        <p className="text-[8px] text-muted-foreground uppercase">{account.platform}</p>
                      </div>
                      {selectedAccountIds.includes(account.id) && <Check size={12} className="text-primary" />}
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground text-base font-semibold uppercase">Programação Sugerida</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] text-primary" onClick={() => generateSchedulingPreview()}>
                    <RefreshCw size={10} className="mr-1" /> RECALCULAR
                  </Button>
                </div>
                <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
                  {schedulingPreview.length === 0 ? (
                    <div className="p-8 text-center">
                      <p className="text-muted-foreground text-sm italic">
                        Clique em recalcular para gerar a prévia da programação.
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 max-h-[400px] overflow-y-auto space-y-4">
                      {schedulingPreview.slice(0, 15).map((p, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-muted/50 border border-border/50">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary text-[10px] font-bold">
                                {idx + 1}
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-foreground uppercase tracking-widest">{format(p.date, "dd/MM/yyyy HH:mm")}</p>
                                <p className="text-[9px] text-muted-foreground">{p.accountName} • Vídeo #{p.videoIndex + 1}</p>
                              </div>
                           </div>
                           {p.isNow && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] h-4">IMEDIATO</Badge>}
                        </div>
                      ))}
                      {schedulingPreview.length > 15 && (
                        <p className="text-center text-[10px] text-muted-foreground italic">...e mais {schedulingPreview.length - 15} publicações</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 pt-6 border-t border-border">
                <div className="bg-[#7C3AED]/5 border border-[#7C3AED]/20 p-6 rounded-2xl space-y-4">
                  <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Zap className="text-[#7C3AED]" />
                    Resumo da Ativação
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Vídeos Aprovados</p>
                      <p className="text-xl font-bold text-foreground">
                        {selectedContentIds.filter(id => {
                          const rKey = generateRenderKey({
                            contentId: id,
                            musicTrackId: formData.music_track_id,
                            musicStartMs: formData.music_start_ms,
                            musicVolume: formData.music_volume,
                            originalAudioVolume: formData.original_audio_volume,
                            audioMode: formData.audio_mode
                          });
                          return renders.find(r => r.render_key === rKey)?.is_approved;
                        }).length}
                      </p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Contas</p>
                      <p className="text-xl font-bold text-foreground">{selectedAccountIds.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Total Posts</p>
                      <p className="text-xl font-bold text-foreground">{schedulingPreview.length}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground uppercase font-bold">Duração Estimada</p>
                      <p className="text-xl font-bold text-foreground">
                        {Math.ceil(schedulingPreview.length / (formData.posts_por_dia * selectedAccountIds.length || 1))} dias
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4">
                  <Button
                    size="lg"
                    className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-foreground font-bold h-14 text-lg gap-2 shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                    disabled={!canAdvance() || starting}
                    onClick={handleIniciar}
                  >
                    {starting ? (
                      <><Loader2 className="animate-spin" /> ATIVANDO...</>
                    ) : (
                      <><Rocket /> INICIAR CAMPANHA AGORA</>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {!campanhaAtiva && (
          <div className="fixed bottom-6 left-0 right-0 z-50 px-6 max-w-4xl mx-auto">
            <div className="bg-card/80 backdrop-blur-md border border-border p-4 rounded-2xl shadow-2xl flex justify-between items-center">
              <Button
                variant="outline"
                onClick={() => setStep(prev => Math.max(1, prev - 1))}
                disabled={step === 1}
                className="bg-muted/50 border-border text-foreground gap-2"
              >
                <ArrowLeft size={16} /> VOLTAR
              </Button>
              <div className="flex items-center gap-4">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest hidden sm:block">
                  {step < 6 ? `Próximo: ${step === 1 ? "Escolher Música" : step === 2 ? "Escolher Vídeos" : step === 3 ? "Processar" : step === 4 ? "Aprovar" : "Publicar"}` : "Finalizar"}
                </span>
                {step < 6 && (
                  <Button
                    onClick={() => setStep(prev => prev + 1)}
                    disabled={!canAdvance()}
                    className="bg-primary hover:bg-primary/90 text-foreground font-bold gap-2"
                  >
                    CONTINUAR <ArrowRight size={16} />
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}


                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Escolher Música</Label>
                    <div className="flex gap-2">
                      <Select
                        value={formData.music_track_id}
                        onValueChange={(v) => setFormData({ ...formData, music_track_id: v })}
                        disabled={!formData.artist_id}
                      >
                        <SelectTrigger className="bg-muted/50 border-border text-foreground flex-1">
                          <SelectValue
                            placeholder={
                              formData.artist_id
                                ? "Selecione uma música"
                                : "Selecione um artista primeiro"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          {musicas
                            .filter((m) => m.artist_id === formData.artist_id)
                            .map((m: any) => (
                              <SelectItem key={m.id} value={m.id} disabled={!m.is_available}>
                                <div className="flex items-center justify-between w-full gap-2">
                                  <span>{m.nome}</span>
                                  {!m.is_available && (
                                    <Badge variant="destructive" className="text-[10px] py-0 px-1">Arquivo Ausente</Badge>
                                  )}
                                </div>
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                      <Dialog open={isMusicModalOpen} onOpenChange={setIsMusicModalOpen}>
                        <DialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="icon" 
                            className="shrink-0 bg-muted/50 border-border text-foreground hover:bg-white/10"
                            disabled={!formData.artist_id}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="bg-card border-border text-foreground sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle className="text-xl font-bold">Nova Música</DialogTitle>
                            <DialogDescription className="text-muted-foreground">
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
                                className="bg-muted/50 border-border text-foreground"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor="music-file">Arquivo de Áudio (MP3/WAV)</Label>
                              <Input
                                id="music-file"
                                type="file"
                                accept="audio/*"
                                className="bg-muted/50 border-border text-foreground"
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
                              className="bg-[#7C3AED] hover:bg-[#6D28D9] text-foreground w-full"
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
                    <Label className="text-muted-foreground">Posts por dia</Label>
                    <Select
                      value={formData.posts_por_dia.toString()}
                      onValueChange={(v) => setFormData({ ...formData, posts_por_dia: parseInt(v) })}
                    >
                      <SelectTrigger className="bg-muted/50 border-border text-foreground">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        {[1, 2, 3, 4, 5].map((n) => (
                          <SelectItem key={n} value={n.toString()}>{n} posts/dia</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-muted-foreground">Timezone</Label>
                    <Select
                      value={formData.timezone}
                      onValueChange={(v) => setFormData({ ...formData, timezone: v })}
                    >
                      <SelectTrigger className="bg-muted/50 border-border text-foreground">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="America/Sao_Paulo">America/Sao_Paulo</SelectItem>
                        <SelectItem value="UTC">UTC</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-4 pt-4 border-t border-border">
                  <Label className="text-foreground text-base font-semibold uppercase">Distribuição e IA</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Modo de Distribuição</Label>
                      <Select
                        value={formData.distribution_mode}
                        onValueChange={(v: any) => setFormData({ ...formData, distribution_mode: v })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="all">Todos recebem o mesmo conteúdo</SelectItem>
                          <SelectItem value="intelligent">Distribuição Inteligente (Recomendado)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Variação Editorial</Label>
                      <Select
                        value={formData.distribution_variation}
                        onValueChange={(v: any) => setFormData({ ...formData, distribution_variation: v })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="low">Baixa (Mais repetições)</SelectItem>
                          <SelectItem value="medium">Média (Equilibrado)</SelectItem>
                          <SelectItem value="high">Alta (Máxima diversidade)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Cooldown de Conteúdo</Label>
                      <Select
                        value={formData.cooldown_days.toString()}
                        onValueChange={(v) => setFormData({ ...formData, cooldown_days: parseInt(v) })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="7">7 dias</SelectItem>
                          <SelectItem value="15">15 dias</SelectItem>
                          <SelectItem value="30">30 dias</SelectItem>
                          <SelectItem value="60">60 dias</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Idioma da IA</Label>
                      <Select
                        value={formData.editorial_language}
                        onValueChange={(v) => setFormData({ ...formData, editorial_language: v })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="pt-BR">Português (Brasil)</SelectItem>
                          <SelectItem value="en-US">English (US)</SelectItem>
                          <SelectItem value="es-ES">Español</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                
                <div className="space-y-4 pt-4 border-t border-border">
                  <Label className="text-foreground text-base font-semibold uppercase">Processamento de Mídia</Label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Modo de Áudio</Label>
                      <Select
                        value={formData.audio_mode}
                        onValueChange={(v: any) => setFormData({ ...formData, audio_mode: v })}
                      >
                        <SelectTrigger className="bg-muted/50 border-border text-foreground">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-card border-border text-foreground">
                          <SelectItem value="music_plus_original">Música + Áudio Original (Mix)</SelectItem>
                          <SelectItem value="only_music">Somente Música</SelectItem>
                          <SelectItem value="only_original">Somente Áudio Original (Sem Processar)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-muted-foreground">Início da Música (Segundos)</Label>
                      <Input
                        type="number"
                        min="0"
                        className="bg-muted/50 border-border text-foreground"
                        value={formData.music_start_ms / 1000}
                        onChange={(e) => setFormData({ ...formData, music_start_ms: Math.max(0, parseInt(e.target.value) || 0) * 1000 })}
                      />
                    </div>
                  </div>

                  {formData.audio_mode !== 'only_original' && (
                    <div className="grid grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Volume Música ({formData.music_volume}%)</Label>
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
                          <Label className="text-muted-foreground">Volume Original ({formData.original_audio_volume}%)</Label>
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

                {/* 2 — ESCOLHER E PROCESSAR VÍDEOS */}
                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-foreground text-base font-semibold uppercase">
                        2 — Escolher e Processar Vídeos
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        {selectedContentIds.length} selecionados para processamento
                      </p>
                    </div>
                    <Select value={contentFilter} onValueChange={setContentFilter}>
                      <SelectTrigger className="w-[150px] bg-muted/50 border-border text-foreground text-xs h-8">
                        <div className="flex items-center gap-2">
                          <Filter size={12} />
                          <SelectValue placeholder="Filtrar" />
                        </div>
                      </SelectTrigger>
                      <SelectContent className="bg-card border-border text-foreground">
                        <SelectItem value="todos">Todos</SelectItem>
                        <SelectItem value="raw">Raw</SelectItem>
                        <SelectItem value="processed">Processados</SelectItem>
                        <SelectItem value="artist">Do Artista</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-1">
                    {biblioteca
                      .filter((c) => c.status !== "arquivado" && c.status !== "descartado")
                      .filter((c) => {
                        if (contentFilter === "todos") return true;
                        if (contentFilter === "artist") return c.artist_id === formData.artist_id;
                        return c.category === contentFilter;
                      })
                      .map((item) => {
                        const isSelected = selectedContentIds.includes(item.id);
                        
                        const rKey = generateRenderKey({
                          contentId: item.id,
                          musicTrackId: formData.music_track_id,
                          musicStartMs: formData.music_start_ms,
                          musicVolume: formData.music_volume,
                          originalAudioVolume: formData.original_audio_volume,
                          audioMode: formData.audio_mode
                        });
                        const render = renders.find(r => r.render_key === rKey);

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
                            className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 cursor-pointer transition-all group ${
                              isSelected
                                ? "border-[#7C3AED]"
                                : "border-transparent hover:border-border"
                            }`}
                          >
                            {loadingUrls[item.id] ? (
                              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                <Loader2 className="w-4 h-4 text-[#7C3AED] animate-spin" />
                              </div>
                            ) : signedUrls[item.id] ? (
                              <video
                                src={signedUrls[item.id]}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                <X className="w-4 h-4 text-red-500/50" />
                              </div>
                            )}

                            {/* Overlay de Status de Renderização */}
                            {render && (
                              <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center gap-2 p-2 text-center">
                                <Badge 
                                  variant="outline" 
                                  className={`text-[8px] h-4 px-1 font-bold border-none ${
                                    render.status === 'ready' ? 'bg-emerald-500 text-white' :
                                    render.status === 'processing' ? 'bg-yellow-500 text-black animate-pulse' :
                                    render.status === 'failed' ? 'bg-red-500 text-white' :
                                    'bg-blue-500 text-white'
                                  }`}
                                >
                                  {render.status === 'ready' ? 'PRONTO' : 
                                   render.status === 'processing' ? 'PROCESSANDO' :
                                   render.status === 'failed' ? 'FALHOU' : 'NA FILA'}
                                </Badge>
                                
                                {render.status === 'ready' && (
                                  <Button 
                                    size="sm" 
                                    className="h-6 text-[8px] bg-white text-black hover:bg-white/90 gap-1 px-2"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePreviewRender(render, item.title);
                                    }}
                                  >
                                    <Play size={8} fill="currentColor" /> PREVIEW
                                  </Button>
                                )}
                              </div>
                            )}

                            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                              <p className="text-[10px] text-white font-medium truncate">
                                {item.title}
                              </p>
                              {item.duration_seconds && (
                                <p className="text-[8px] text-white/70">{item.duration_seconds}s</p>
                              )}
                            </div>
                            
                            {isSelected && (
                              <div className="absolute top-2 right-2 bg-[#7C3AED] rounded-full p-1 shadow-lg z-10">
                                <Check size={12} className="text-white" />
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>

                  {selectedContentIds.length > 0 && (
                    <div className="flex items-center justify-between bg-muted/30 p-4 rounded-xl border border-border">
                      <p className="text-sm font-medium text-foreground">
                        {selectedContentIds.length} vídeos selecionados
                      </p>
                      <Button 
                        onClick={(e) => {
                          e.preventDefault();
                          handleProcessBatch();
                        }}
                        disabled={isProcessingBatch || !formData.music_track_id}
                        className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2"
                      >
                        {isProcessingBatch ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4" />
                        )}
                        PROCESSAR {selectedContentIds.length} VÍDEOS
                      </Button>
                    </div>
                  )}
                </div>

                  </div>
                </div>

                <div className="space-y-6 pt-4 border-t border-border">
                  <Label className="text-foreground text-base font-semibold uppercase">Programação</Label>
                  
                  <div className="space-y-4">
                    <Label className="text-muted-foreground">Quando a campanha deve começar?</Label>
                    <div className="grid grid-cols-2 gap-4">
                      <button
                        onClick={() => setFormData({ ...formData, start_mode: 'period' })}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          formData.start_mode === 'period' 
                            ? "bg-[#7C3AED]/10 border-[#7C3AED] text-foreground" 
                            : "bg-muted/50 border-border text-muted-foreground hover:border-border"
                        }`}
                      >
                        <Calendar size={20} />
                        <span className="text-sm font-bold">Programar Período</span>
                      </button>
                      <button
                        onClick={() => setFormData({ ...formData, start_mode: 'now' })}
                        className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                          formData.start_mode === 'now' 
                            ? "bg-[#7C3AED]/10 border-[#7C3AED] text-foreground" 
                            : "bg-muted/50 border-border text-muted-foreground hover:border-border"
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
                          <Label className="text-muted-foreground">Data Início</Label>
                          <Input
                            type="date"
                            className="bg-muted/50 border-border text-foreground"
                            value={formData.data_inicio}
                            onChange={(e) => setFormData({ ...formData, data_inicio: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Data Fim</Label>
                          <Input
                            type="date"
                            className="bg-muted/50 border-border text-foreground"
                            value={formData.data_fim}
                            onChange={(e) => setFormData({ ...formData, data_fim: e.target.value })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Janela: De</Label>
                          <Input
                            type="time"
                            className="bg-muted/50 border-border text-foreground"
                            value={formData.daily_start_time}
                            onChange={(e) => setFormData({ ...formData, daily_start_time: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-muted-foreground">Até</Label>
                          <Input
                            type="time"
                            className="bg-muted/50 border-border text-foreground"
                            value={formData.daily_end_time}
                            onChange={(e) => setFormData({ ...formData, daily_end_time: e.target.value })}
                          />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Primeiro Conteúdo</Label>
                        <div className="h-10 px-3 bg-muted/50 border border-border rounded-md flex items-center text-emerald-500 font-bold text-sm">
                          AGORA (Na confirmação)
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-muted-foreground">Intervalo entre Conteúdos</Label>
                        <Select
                          value={formData.batch_interval_minutes.toString()}
                          onValueChange={(v) => setFormData({ ...formData, batch_interval_minutes: parseInt(v) })}
                        >
                          <SelectTrigger className="bg-muted/50 border-border text-foreground">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-card border-border text-foreground">
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
                        <Label className="text-muted-foreground text-[10px] uppercase font-bold">Repetição de Conteúdo</Label>
                        <div className="grid grid-cols-2 gap-3">
                          <button
                            type="button"
                            onClick={() => setFormData({ ...formData, repeat_policy: 'never' })}
                            className={`flex items-center justify-between p-3 rounded-lg border text-[10px] font-bold transition-all ${
                              formData.repeat_policy === 'never'
                                ? "bg-primary/20 border-primary text-foreground"
                                : "bg-muted/50 border-border text-muted-foreground hover:border-border"
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
                                ? "bg-primary/20 border-primary text-foreground"
                                : "bg-muted/50 border-border text-muted-foreground hover:border-border"
                            }`}
                          >
                            <span>PERMITIR APÓS COOLDOWN</span>
                            {formData.repeat_policy === 'cooldown' && <Check size={12} />}
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="text-muted-foreground text-[10px] uppercase font-bold">Intervalo entre Destinos (Contas)</Label>
                          <Select
                            value={formData.destination_interval_seconds.toString()}
                            onValueChange={(v) => setFormData({ ...formData, destination_interval_seconds: parseInt(v) })}
                          >
                            <SelectTrigger className="bg-muted/50 border-border text-foreground h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="bg-card border-border text-foreground">
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

                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-foreground text-base font-semibold uppercase">
                        Contas de Publicação
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Selecione onde os vídeos serão postados
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-7 px-2 border-border text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedAccountIds(socialAccounts.map(a => a.id))}
                      >
                        Selecionar Todas
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-[10px] h-7 px-2 border-border text-muted-foreground hover:text-foreground"
                        onClick={() => setSelectedAccountIds([])}
                      >
                        Limpar
                      </Button>
                    </div>
                  </div>

                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {socialAccounts.length === 0 ? (
                      <div className="col-span-full py-6 text-center border border-dashed border-border rounded-xl">
                        <p className="text-muted-foreground text-sm">Nenhuma conta conectada. Vá em Contas primeiro.</p>
                      </div>
                    ) : (
                      socialAccounts.map((account) => (
                        <div 
                          key={account.id}
                          onClick={() => toggleAccount(account.id)}
                          className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                            selectedAccountIds.includes(account.id)
                              ? "bg-[#7C3AED]/10 border-[#7C3AED]"
                              : "bg-muted/50 border-border hover:border-border"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-muted/30 overflow-hidden flex items-center justify-center">
                              {account.profile_image_url ? (
                                <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />
                              ) : (
                                <Globe className="w-5 h-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-foreground capitalize">{account.platform}</p>
                              <p className="text-xs text-muted-foreground">{account.account_name}</p>
                              <div className="flex items-center gap-1 mt-1">
                                <div className={`w-1.5 h-1.5 rounded-full ${account.connection_status === 'conectada' ? 'bg-emerald-500' : 'bg-red-500'}`} />
                                <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter">
                                  {account.connection_status === 'conectada' ? 'Conectada' : 'Desconectada'}
                                </span>
                              </div>
                            </div>
                          </div>
                          <Checkbox 
                            checked={selectedAccountIds.includes(account.id)} 
                            onCheckedChange={() => toggleAccount(account.id)}
                            className="border-border data-[state=checked]:bg-[#7C3AED]"
                          />
                        </div>
                      ))
                    )}
                  </div>
                </div>


                <div className="space-y-4 pt-4 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <Label className="text-foreground text-base font-semibold uppercase">
                        Programação Sugerida
                      </Label>
                      <p className="text-muted-foreground text-xs">
                        Cronograma de postagens baseado nas configurações
                      </p>
                    </div>
                    {schedulingPreview.length > 0 && (
                      <Badge variant="outline" className="bg-[#7C3AED]/10 text-[#7C3AED] border-[#7C3AED]/20">
                        {totalEstimatedPosts} Posts Total
                      </Badge>
                    )}
                  </div>

                  <div className="bg-muted/30 rounded-xl border border-border overflow-hidden">
                    {schedulingPreview.length === 0 ? (
                      <div className="p-8 text-center">
                        <p className="text-muted-foreground text-sm italic">
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
                                    <span className="text-xs font-bold text-foreground uppercase tracking-widest flex items-center gap-2">
                                      Lote {bIdx + 1} — {batch.isNow ? 'AGORA' : format(batch.date, "HH:mm")}
                                      {batch.isNow && <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[8px] h-4">Início Imediato</Badge>}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground">{format(batch.date, "dd/MM/yyyy")}</span>
                                  </div>
                                  <div className="bg-muted/50 rounded-lg p-3 border border-border">
                                    <div className="flex items-center gap-3 mb-2">
                                      <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary">
                                        <Layers size={14} />
                                      </div>
                                      <div>
                                        <p className="text-[10px] text-muted-foreground font-medium">Conteúdo #{batch.videoIndex + 1}</p>
                                        <p className="text-[9px] text-muted-foreground">{selectedAccountIds.length} destinos programados</p>
                                      </div>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {batchPosts.slice(0, 5).map((p, pIdx) => (
                                        <Badge key={pIdx} variant="outline" className="text-[8px] h-4 border-border text-muted-foreground">
                                          {p.accountName}
                                        </Badge>
                                      ))}
                                      {batchPosts.length > 5 && <span className="text-[8px] text-foreground/20">+{batchPosts.length - 5}</span>}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                          {schedulingPreview.length > 10 && (
                            <div className="text-center py-2">
                              <p className="text-[10px] text-foreground/20 italic">...e mais {Math.floor(schedulingPreview.length / selectedAccountIds.length) - 10} lotes</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              <div className="pt-8 border-t border-border space-y-4">
                <div className="bg-muted/30 p-4 rounded-xl border border-border space-y-2">
                  <h4 className="text-sm font-bold text-foreground uppercase tracking-widest">Resumo da Preparação</h4>
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Música:</span>
                      <span className="text-foreground font-medium">{musicas.find(m => m.id === formData.music_track_id)?.nome || "-"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Vídeos Selecionados:</span>
                      <span className="text-foreground font-medium">{selectedContentIds.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Contas de Destino:</span>
                      <span className="text-foreground font-medium">{selectedAccountIds.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Posts Estimados:</span>
                      <span className="text-foreground font-medium">{totalEstimatedPosts}</span>
                    </div>
                  </div>
                </div>

                <Button
                  onClick={handleIniciar}
                  disabled={saving || isProcessingBatch || selectedContentIds.length === 0 || selectedAccountIds.length === 0 || selectedContentIds.some(id => renders.find(r => r.render_key === generateRenderKey({
                    contentId: id,
                    musicTrackId: formData.music_track_id,
                    musicStartMs: formData.music_start_ms,
                    musicVolume: formData.music_volume,
                    originalAudioVolume: formData.original_audio_volume,
                    audioMode: formData.audio_mode
                  }))?.status !== 'ready')}
                  className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-8 text-xl font-bold shadow-lg shadow-[#7C3AED]/20"
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                      Iniciando Campanha...
                    </>
                  ) : "INICIAR CAMPANHA"}
                </Button>
                
                {(selectedContentIds.length === 0 || selectedAccountIds.length === 0) && (
                  <p className="text-center text-[10px] text-red-400 font-bold uppercase tracking-widest">
                    Selecione pelo menos um vídeo e uma conta para iniciar.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 bg-card border-border">
              <CardHeader>
                <CardTitle className="text-2xl text-foreground">{campanhaAtiva.nome}</CardTitle>
                <div className="flex items-center gap-4 text-muted-foreground">
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
                  {/* Summary Header */}
                  {renders.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                      <div className="bg-muted/30 border border-border/50 p-3 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1">Total</p>
                        <p className="text-xl font-bold text-foreground">{renderStats.total}</p>
                      </div>
                      <div className="bg-muted/30 border border-border/50 p-3 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                          <Clock size={10} className="text-blue-400" /> Na Fila
                        </p>
                        <p className="text-xl font-bold text-foreground">{renderStats.queued}</p>
                      </div>
                      <div className="bg-muted/30 border border-border/50 p-3 rounded-xl">
                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                          <Loader2 size={10} className="text-yellow-400 animate-spin" /> Renderizando
                        </p>
                        <p className="text-xl font-bold text-foreground">{renderStats.processing}</p>
                      </div>
                      <div className="bg-[#7C3AED]/5 border-[#7C3AED]/10 p-3 rounded-xl">
                        <p className="text-[10px] text-[#7C3AED] uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                          <CheckCircle2 size={10} /> Prontos
                        </p>
                        <p className="text-xl font-bold text-[#7C3AED]">{renderStats.ready}</p>
                      </div>
                      <div className="bg-red-500/5 border-red-500/10 p-3 rounded-xl">
                        <p className="text-[10px] text-red-400 uppercase font-bold tracking-widest mb-1 flex items-center gap-1">
                          <AlertCircle size={10} /> Falhas
                        </p>
                        <p className="text-xl font-bold text-red-400">{renderStats.failed}</p>
                      </div>
                    </div>
                  )}


                  {(() => {
                    const isNow = campanhaAtiva.start_mode === "now";
                    if (isNow) return (
                      <div className="bg-primary/5 border border-primary/20 p-4 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Zap className="text-primary" size={20} />
                          <div>
                            <p className="text-sm font-bold text-foreground">Campanha em Tempo Real</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">Modo Começar Agora Ativo</p>
                          </div>
                        </div>
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">EXECUTANDO</Badge>
                      </div>
                    );

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
                    
                    return (
                      <>
                        <div className="flex justify-between text-xs mb-2">
                          <span className="text-muted-foreground uppercase font-bold tracking-widest text-[10px]">Progresso Temporal</span>
                          <span className="text-foreground font-medium">{Math.round(r)}%</span>
                        </div>
                        <Progress value={r} className="h-2 bg-muted/50" />
                        <div className="flex justify-between text-xs text-muted-foreground mt-2">
                          <span>Início: {format(new Date(campanhaAtiva.data_inicio), "dd/MM/yyyy")}</span>
                          <span>Fim: {format(new Date(campanhaAtiva.data_fim), "dd/MM/yyyy")}</span>
                        </div>
                      </>
                    );
                  })()}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
                  <div className="bg-muted/50 p-4 rounded-xl space-y-1">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Calendar size={12} className="text-primary" /> Dias
                    </div>
                    <div className="text-xl font-bold text-foreground">
                      {Math.max(0, differenceInDays(new Date(campanhaAtiva.data_fim), new Date()))}
                    </div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-xl space-y-1">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <ShieldCheck size={12} className="text-emerald-500" /> Contas
                    </div>
                    <div className="text-xl font-bold text-foreground">{selectedAccountIds.length}</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-xl space-y-1">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Layers size={12} className="text-[#7C3AED]" /> Pool
                    </div>
                    <div className="text-xl font-bold text-foreground">{selectedContentIds.length}</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-xl space-y-1">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Zap size={12} className="text-yellow-500" /> Cap. Max
                    </div>
                    <div className="text-xl font-bold text-foreground">{selectedContentIds.length * selectedAccountIds.length}</div>
                  </div>
                  <div className="bg-muted/50 p-4 rounded-xl space-y-1">
                    <div className="text-muted-foreground text-[10px] uppercase font-bold tracking-widest flex items-center gap-1">
                      <Megaphone size={12} className="text-blue-500" /> Enviados
                    </div>
                    <div className="text-xl font-bold text-foreground">{totalPosts}</div>
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
                    onClick={() => handleDeleteCampaign()}
                    disabled={saving}
                  >
                    <X size={18} className="mr-2" />
                    Excluir Campanha
                  </Button>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Configurações</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {campanhaAtiva.start_mode === 'now' ? (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Modo</span>
                        <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">COMEÇAR AGORA</Badge>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Intervalo Lote</span>
                        <span className="text-foreground">{campanhaAtiva.batch_interval_minutes} min</span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Intervalo Destinos</span>
                        <span className="text-foreground">{campanhaAtiva.destination_interval_seconds} seg</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Horário Ativo</span>
                        <span className="text-foreground">
                          {campanhaAtiva.daily_start_time || `${campanhaAtiva.hora_inicio}:00`} - {campanhaAtiva.daily_end_time || `${campanhaAtiva.hora_fim}:00`}
                        </span>
                      </div>
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-muted-foreground">Intervalo Variável</span>
                        <span className="text-foreground">
                          {campanhaAtiva.intervalo_min} - {campanhaAtiva.intervalo_max} min
                        </span>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant={campanhaAtiva.status === "ativo" ? "default" : "secondary"}
                      className={campanhaAtiva.status === "ativo" ? "bg-emerald-500" : ""}
                    >
                      {campanhaAtiva.status}
                    </Badge>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">Anti-Repetição</span>
                    <Badge variant="outline" className="text-[10px] border-emerald-500/20 text-emerald-500 bg-emerald-500/5">
                      {campanhaAtiva.repeat_policy === 'never' ? 'NUNCA REPETIR' : 'COOLDOWN'}
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      Conteúdos Ativos
                    </CardTitle>
                    <Badge
                      variant="outline"
                      className="text-[10px] h-5 border-border text-muted-foreground"
                    >
                      {selectedContentIds.length} Itens
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-4 max-h-[800px] overflow-y-auto pr-2 custom-scrollbar">
                    {biblioteca
                      .filter((item) => selectedContentIds.includes(item.id))
                      .map((item) => {
                        const pubsForThisContent = publications.filter(p => p.content_id === item.id);
                        
                        // Busca o render priorizando o vínculo via render_key das publicações
                        let render = renders.find(r => 
                          r.source_content_id === item.id || 
                          (r.render_key && pubsForThisContent.some((p: any) => {
                            const pRenderKey = (p.render_options as any)?.render_key || (p.metadata as any)?.render_key;
                            return pRenderKey === r.render_key;
                          }))
                        );

                        // Fallback agressivo: se não achou por render_key, tenta achar qualquer render que coincida com a música e conteúdo
                        if (!render && campanhaAtiva) {
                           render = renders.find(r => 
                             r.source_content_id === item.id && 
                             r.music_track_id === campanhaAtiva.music_track_id
                           );
                        }
                        
                        return (
                          <div key={item.id} className="bg-muted/30 border border-border/50 rounded-xl overflow-hidden group">
                            <div className="flex gap-4 p-3">
                              <div className="relative w-24 aspect-[9/16] rounded-lg overflow-hidden flex-shrink-0">
                                {loadingUrls[item.id] ? (
                                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                                  </div>
                                ) : signedUrls[item.id] ? (
                                  <video src={signedUrls[item.id]} className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center bg-muted/50">
                                    <X className="w-4 h-4 text-red-500/50" />
                                  </div>
                                )}
                                
                                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Button
                                    size="icon"
                                    variant="destructive"
                                    className="h-6 w-6 rounded-full"
                                    onClick={async () => {
                                      if (!campanhaAtiva) return;
                                      try {
                                        const { error } = await supabase
                                          .from("campaign_contents")
                                          .delete()
                                          .eq("campaign_id", campanhaAtiva.id)
                                          .eq("content_id", item.id);

                                        if (error) throw error;
                                        setSelectedContentIds((prev) => prev.filter((id) => id !== item.id));
                                        toast.success("Conteúdo removido");
                                      } catch (err: any) {
                                        toast.error("Erro ao remover: " + err.message);
                                      }
                                    }}
                                  >
                                    <X size={12} />
                                  </Button>
                                </div>
                              </div>

                              <div className="flex-1 flex flex-col justify-between py-1">
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-bold text-foreground truncate max-w-[120px]">{item.title}</p>
                                    {render ? (
                                      <Badge 
                                        variant="outline" 
                                        className={`text-[9px] h-5 px-2 font-bold uppercase tracking-wider ${
                                          render.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' :
                                          render.status === 'processing' ? 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse' :
                                          render.status === 'failed' ? 'bg-red-500/10 text-red-500 border-red-500/20' :
                                          'bg-blue-500/10 text-blue-500 border-blue-500/20'
                                        }`}
                                      >
                                        {render.status === 'ready' ? 'PRONTO' : 
                                         render.status === 'processing' ? 'RENDERIZANDO' :
                                         render.status === 'failed' ? 'FALHOU' : 'NA FILA'}
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="text-[9px] h-5 px-2 bg-slate-500/10 text-slate-400 border-slate-500/20 uppercase">Aguardando</Badge>
                                    )}
                                  </div>

                                  {render?.status === 'failed' && (
                                    <Alert variant="destructive" className="py-1 px-2 h-auto bg-red-500/5 border-red-500/10">
                                      <AlertCircle className="h-3 w-3" />
                                      <AlertDescription className="text-[9px] leading-tight ml-1">
                                        {render.error_message || "Erro desconhecido"}
                                      </AlertDescription>
                                    </Alert>
                                  )}

                                  <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                                    <div className="flex flex-col">
                                      <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Duração</span>
                                      <span className="text-[10px] text-foreground font-mono">{item.duration_seconds || '0'}s</span>
                                    </div>
                                    {render?.completed_at && (
                                      <div className="flex flex-col">
                                        <span className="text-[8px] text-muted-foreground uppercase font-bold tracking-tighter">Concluído em</span>
                                        <span className="text-[10px] text-foreground font-mono">{format(new Date(render.completed_at), "HH:mm")}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                  {render?.status === 'ready' ? (
                                    <>
                                      <Button 
                                        size="sm" 
                                        className="h-7 text-[10px] flex-1 bg-[#7C3AED]/20 hover:bg-[#7C3AED]/30 text-[#7C3AED] border border-[#7C3AED]/20 gap-1"
                                        onClick={() => handlePreviewRender(render, item.title)}
                                      >
                                        <Eye size={12} /> Preview
                                      </Button>
                                      <Button 
                                        size="sm" 
                                        variant="outline"
                                        className="h-7 w-8 p-0 border-border text-muted-foreground hover:text-foreground"
                                        onClick={() => handleRerender(render)}
                                      >
                                        <RotateCcw size={12} />
                                      </Button>
                                    </>
                                  ) : render?.status === 'failed' ? (
                                    <Button 
                                      size="sm" 
                                      className="h-7 text-[10px] flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/20 gap-1"
                                      onClick={() => handleRerender(render)}
                                    >
                                      <RefreshCw size={12} /> Tentar Novamente
                                    </Button>
                                  ) : render?.status === 'processing' ? (
                                    <div className="flex-1 flex items-center justify-center gap-2 text-[10px] text-yellow-500/50 bg-yellow-500/5 rounded h-7 border border-yellow-500/10 italic">
                                      <Loader2 size={10} className="animate-spin" /> Processando...
                                    </div>
                                  ) : null}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                  
                  <div className="pt-2 border-t border-border space-y-2">
                    <Button
                      variant="outline"
                      className="w-full border-[#7C3AED]/20 text-[#7C3AED] text-xs h-9 hover:bg-[#7C3AED]/10 flex gap-2"
                      onClick={async () => {
                        const loadingToast = toast.loading("Disparando despachante...");
                        try {
                          const { data, error } = await supabase.functions.invoke('campaign-dispatcher');
                          toast.dismiss(loadingToast);
                          if (error) throw error;
                          toast.success("Dispatcher executado com sucesso!");
                          console.log("Dispatcher results:", data);
                          fetchData();
                        } catch (err: any) {
                          toast.dismiss(loadingToast);
                          toast.error("Erro ao disparar dispatcher: " + err.message);
                        }
                      }}
                    >
                      <Zap size={14} />
                      Disparar Despachante (Manual)
                    </Button>
                    <p className="text-[10px] text-muted-foreground text-center italic">Use para forçar o processamento imediato da fila agendada.</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={(open) => {
        if (!open) {
          setIsPreviewOpen(false);
          setPreviewVideoUrl(null);
        }
      }}>
        <DialogContent className="max-w-md bg-[#0A0A0F] border-slate-800 p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-800/50">
            <DialogTitle className="text-slate-200 flex items-center gap-2">
              <Video size={18} className="text-[#7C3AED]" />
              {previewTitle}
            </DialogTitle>
          </DialogHeader>
          
          <div className="aspect-[9/16] bg-black relative flex items-center justify-center">
            {isPreviewLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-[#7C3AED] animate-spin" />
                <p className="text-xs text-slate-400 font-mono">Gerando URL segura...</p>
              </div>
            ) : previewVideoUrl ? (
              <video 
                src={previewVideoUrl} 
                className="w-full h-full object-contain"
                controls
                autoPlay
              />
            ) : (
              <div className="flex flex-col items-center gap-3">
                <AlertCircle className="w-10 h-10 text-red-500/50" />
                <p className="text-xs text-slate-400 font-mono">Erro ao carregar vídeo.</p>
              </div>
            )}
          </div>
          
          <div className="p-4 bg-slate-900/50 border-t border-slate-800/50 flex gap-3">
            <Button 
              className="flex-1 bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2 h-10"
              onClick={() => {
                toast.success("Conteúdo aprovado para publicação!");
                setIsPreviewOpen(false);
              }}
            >
              <CheckCircle2 size={16} />
              Aprovar Vídeo
            </Button>
            <Button 
              variant="outline" 
              className="border-slate-800 text-slate-400 hover:text-white gap-2 h-10"
              onClick={() => setIsPreviewOpen(false)}
            >
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </DashboardLayout>
  );
}
