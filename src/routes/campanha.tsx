import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Check, X, Loader2, Play, Music as MusicIcon, Video, CheckCircle2,
  AlertCircle, RotateCcw, RefreshCw, ChevronRight, ChevronLeft,
  Calendar, Clock, Users, Megaphone, Eye, ThumbsUp, ThumbsDown, Zap
} from "lucide-react";
import { format, addDays } from "date-fns";
import { socialService, type SocialAccount } from "@/services/social";
import { contentService } from "@/services/content";
import { generateSmartCampaignPlan } from "@/services/smart-campaign-engine";

// ─── Types ────────────────────────────────────────────────────────────────────
type MusicTrack = { id: string; nome: string; artista: string; artist_id: string; storage_path: string | null; };
type VideoItem = { id: string; title: string; storage_path: string; duration_seconds?: number; };
type RenderItem = { id: string; source_content_id: string; music_track_id: string; status: string; storage_path: string | null; is_approved?: boolean; error_message?: string | null; };

const STEPS = [
  { num: 1, label: "Configurar", icon: Calendar },
  { num: 2, label: "Música", icon: MusicIcon },
  { num: 3, label: "Vídeos", icon: Video },
  { num: 4, label: "Processar", icon: Zap },
  { num: 5, label: "Aprovar", icon: Eye },
  { num: 6, label: "Publicar", icon: Megaphone },
];

export default function CampanhaPage() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [musicas, setMusicas] = useState<MusicTrack[]>([]);
  const [biblioteca, setBiblioteca] = useState<VideoItem[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [renders, setRenders] = useState<RenderItem[]>([]);

  // Form
  const [formData, setFormData] = useState({
    nome: "",
    music_track_id: "",
    posts_por_dia: 2,
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    hora_inicio: "09:00",
    hora_fim: "21:00",
    intervalo_min: 40,
    intervalo_max: 90,
    audio_mode: "only_music" as "only_music" | "music_plus_original",
    music_volume: 80,
    original_audio_volume: 20,
    music_start_ms: 0,
  });

  // Selections
  const [selVideos, setSelVideos] = useState<Set<string>>(new Set());
  const [selAccounts, setSelAccounts] = useState<Set<string>>(new Set());

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<Record<string, string>>({});

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Active campaign
  const [campanhaAtiva, setCampanhaAtiva] = useState<any>(null);

  const pollTimerRef = useRef<number | null>(null);
  const [localProcessingId, setLocalProcessingId] = useState<string | null>(null);

  useEffect(() => { 
    fetchData(); 

    // Realtime subscription for media_renders
    const channel = supabase
      .channel('media_renders_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'media_renders'
        },
        (payload) => {
          const updatedRender = payload.new as RenderItem;
          if (updatedRender) {
            console.log("Realtime update received:", updatedRender.id, updatedRender.status);
            setRenders(prev => {
              const otherRenders = prev.filter(r => r.id !== updatedRender.id);
              return [...otherRenders, updatedRender];
            });
            
            // Sync process progress
            setProcessProgress(prev => ({
              ...prev,
              [updatedRender.source_content_id]: updatedRender.status
            }));

            if (updatedRender.status === 'ready' && updatedRender.storage_path) {
              toast.success("Vídeo processado e pronto!");
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (pollTimerRef.current) clearInterval(pollTimerRef.current);
    };
  }, []);

  // Polling fallback
  useEffect(() => {
    const hasActiveRenders = renders.some(r => 
      (r.status === 'queued' || r.status === 'processing') && 
      selVideos.has(r.source_content_id) && 
      r.music_track_id === formData.music_track_id
    );

    if (hasActiveRenders && !pollTimerRef.current) {
      console.log("Starting polling fallback...");
      pollTimerRef.current = window.setInterval(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data } = await supabase
          .from("media_renders")
          .select("*")
          .eq("user_id", user.id)
          .eq("music_track_id", formData.music_track_id)
          .in("source_content_id", Array.from(selVideos));

        if (data) {
          setRenders(prev => {
            // Merge existing with new data, prioritizing new data
            const newRenders = [...data];
            const existingIds = new Set(newRenders.map(r => r.id));
            const keptRenders = prev.filter(r => !existingIds.has(r.id));
            return [...keptRenders, ...newRenders];
          });
          
          const progress: Record<string, string> = {};
          data.forEach(r => {
            progress[r.source_content_id] = r.status;
          });
          setProcessProgress(prev => ({ ...prev, ...progress }));
        }
      }, 3000);
    } else if (!hasActiveRenders && pollTimerRef.current) {
      console.log("Stopping polling fallback.");
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, [renders, selVideos, formData.music_track_id]);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [tracksRes, libraryRes, accountsRes, campRes, rendersRes] = await Promise.all([
        supabase.from("music_tracks").select("id, nome, artista, artist_id, storage_path"),
        supabase
          .from("content_library")
          .select("id, title, storage_path, duration_seconds")
          .not("status", "in", '("reserved","used")')
          .order("created_at", { ascending: false }),
        socialService.getConnectedAccounts(),
        supabase.from("campanhas").select("*").in("status", ["ativo", "pausado"]).order("data_inicio", { ascending: false }).limit(1),
        supabase.from("media_renders").select("*").eq("user_id", user.id)
      ]);

      setMusicas(tracksRes.data || []);
      setBiblioteca(libraryRes.data || []);
      setSocialAccounts(accountsRes || []);
      setRenders(rendersRes.data || []);

      if (campRes.data?.[0]) {
        const activeCampaign = campRes.data[0];

        const { data: campaignPublications, error: publicationsError } = await supabase
          .from("publications")
          .select("id, status")
          .eq("campaign_id", activeCampaign.id);

        if (publicationsError) {
          console.error("Erro ao verificar publicações da campanha:", publicationsError);
          setCampanhaAtiva(activeCampaign);
        } else {
          const publications = campaignPublications || [];
          const allPublished =
            publications.length > 0 &&
            publications.every(pub => pub.status === "published");

          if (allPublished) {
            await Promise.all([
              supabase
                .from("campanhas")
                .update({ status: "concluido" })
                .eq("id", activeCampaign.id),

              supabase
                .from("music_tracks")
                .update({ campanha_ativa: false })
                .eq("id", activeCampaign.music_track_id)
            ]);

            setCampanhaAtiva(null);
            toast.success("Campanha concluída! Todas as publicações foram realizadas.");
          } else {
            setCampanhaAtiva(activeCampaign);
          }
        }
      } else {
        setCampanhaAtiva(null);
      }

      // Sync progress state from initial renders
      if (rendersRes.data) {
        const progress: Record<string, string> = {};
        rendersRes.data.forEach(r => {
          progress[r.source_content_id] = r.status;
        });
        setProcessProgress(progress);
      }

      // Load signed URLs
      for (const item of (libraryRes.data || [])) {
        if (item.storage_path) {
          try {
            const url = await contentService.getSignedUrl(item.storage_path);
            setSignedUrls(prev => ({ ...prev, [item.id]: url }));
          } catch (e) {}
        }
      }
    } catch (e: any) {
      toast.error("Erro ao carregar: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  // ─── Validation per step ──────────────────────────────────────────────────
  function canAdvance(): boolean {
    if (step === 1) return !!formData.nome;
    if (step === 2) return !!formData.music_track_id;
    if (step === 3) return selVideos.size > 0;
    if (step === 4) return Array.from(selVideos).every(id => {
      const r = renders.find(r => r.source_content_id === id && r.music_track_id === formData.music_track_id);
      return r?.status === "ready" && !!r.storage_path;
    });
    if (step === 5) return renders.filter(r => selVideos.has(r.source_content_id) && r.music_track_id === formData.music_track_id).every(r => r.is_approved);
    if (step === 6) return selAccounts.size > 0;
    return true;
  }

  function stepBlockMessage(): string {
    if (step === 1 && !formData.nome) return "Preencha o nome da campanha";
    if (step === 2 && !formData.music_track_id) return "Selecione uma música";
    if (step === 3 && selVideos.size === 0) return "Selecione pelo menos um vídeo";
    if (step === 4) {
      const pending = Array.from(selVideos).filter(id => {
        const r = renders.find(r => r.source_content_id === id && r.music_track_id === formData.music_track_id);
        return r?.status !== "ready" || !r.storage_path;
      });
      if (pending.length > 0) return `Aguarde o processamento: ${pending.length} vídeos pendentes`;
    }
    if (step === 5) {
      const selectedRenders = renders.filter(r => selVideos.has(r.source_content_id) && r.music_track_id === formData.music_track_id);
      const unapprovedCount = selectedRenders.filter(r => !r.is_approved).length;
      if (unapprovedCount > 0) return `Aprove todos os vídeos (${unapprovedCount} pendentes)`;
    }
    if (step === 6 && selAccounts.size === 0) return "Selecione pelo menos uma conta";
    return "";
  }

  // ─── Process videos ───────────────────────────────────────────────────────
  // ─── Process videos (Server-side Enqueue) ──────────────────────────────────
  async function handleProcessAll() {
    if (!formData.music_track_id) 
      return toast.error("Selecione uma música");
    
    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      for (const videoId of Array.from(selVideos)) {
        const render_key = [
          videoId,
          formData.music_track_id,
          formData.music_start_ms,
          formData.music_volume,
          formData.original_audio_volume,
          formData.audio_mode,
          "v1"
        ].join("|");

        console.log('[RENDER] Inserindo job via RPC:', { user_id: user.id, source_content_id: videoId, music_track_id: formData.music_track_id });
        
        // Usa RPC SECURITY DEFINER para garantir o insert
        const { data: renderId, error: rpcError } = await supabase
          .rpc('insert_media_render', {
            p_user_id: user.id,
            p_source_content_id: videoId,
            p_music_track_id: formData.music_track_id,
            p_audio_mode: formData.audio_mode,
            p_music_volume: formData.music_volume,
            p_original_audio_volume: formData.original_audio_volume,
            p_music_start_ms: formData.music_start_ms,
          });

        console.log('[RENDER] RPC resultado:', { renderId, rpcError });
        
        if (rpcError) {
          console.error('[RENDER] RPC erro:', rpcError);
          throw new Error('Falha ao criar job: ' + rpcError.message);
        }

        const render = { 
          id: renderId, 
          source_content_id: videoId,
          music_track_id: formData.music_track_id,
          status: 'queued' as const,
          storage_path: null,
          is_approved: false
        };
        
        const error = null;

        if (render) {
          setRenders(prev => [...prev.filter(r => r.id !== render.id), render as RenderItem]);
          setProcessProgress(prev => ({ ...prev, [videoId]: "queued" }));
        }
      }

      toast.success("Jobs na fila! O worker está processando...");
      
      const interval = window.setInterval(async () => {
        const ids = Array.from(selVideos);
        const { data: rendersData } = await supabase
          .from("media_renders")
          .select("*")
          .in("source_content_id", ids)
          .eq("music_track_id", formData.music_track_id);

        if (rendersData) {
          setRenders(rendersData as RenderItem[]);
          rendersData.forEach(r => {
            setProcessProgress(prev => ({ ...prev, [r.source_content_id]: r.status }));
          });

          const allDone = rendersData.every(r => 
            r.status === "ready" || r.status === "failed"
          );

          if (allDone) {
            window.clearInterval(interval);
            setIsProcessing(false);
            toast.success("Processamento concluído!");
          }
        }
      }, 5000);
    } catch (e: any) {
      toast.error("Erro: " + e.message);
      setIsProcessing(false);
    }
  }


  async function handlePreview(render: RenderItem, title: string) {
    if (!render.storage_path) {
      toast.error("Caminho do arquivo não encontrado");
      return;
    }
    
    setPreviewTitle(title);
    setPreviewLoading(true);
    
    try {
      console.log("Generating signed read URL for:", render.storage_path);
      
      // Try 'rendered' bucket first
      let { data, error } = await supabase.storage
        .from("rendered")
        .createSignedUrl(render.storage_path, 3600);
        
      // If error or not found, try 'content-library' (for bypass renders)
      if (error || !data?.signedUrl) {
        console.log("Not found in 'rendered', trying 'content-library'...");
        const contentRes = await supabase.storage
          .from("content-library")
          .createSignedUrl(render.storage_path, 3600);
          
        if (contentRes.data?.signedUrl) {
          data = contentRes.data;
          error = null;
        } else {
          // Final attempt in 'videos' bucket
          console.log("Not found in 'content-library', trying 'videos'...");
          const videosRes = await supabase.storage
            .from("videos")
            .createSignedUrl(render.storage_path, 3600);
            
          if (videosRes.data?.signedUrl) {
            data = videosRes.data;
            error = null;
          }
        }
      }

      if (error) {
        console.error("Signed URL error:", error.message, "Path:", render.storage_path);
        throw error;
      }
      
      if (!data?.signedUrl) {
        throw new Error("Arquivo não encontrado em nenhum bucket (rendered, content-library, videos)");
      }

      setPreviewUrl(data.signedUrl);
      setPreviewOpen(true);
    } catch (e: any) {
      console.error("Full preview error details:", e);
      toast.error("Não foi possível carregar o preview: " + (e.message || "Erro desconhecido"));
    } finally {
      setPreviewLoading(false);
    }

  }

  async function handleToggleApprove(renderId: string, current: boolean) {
    const { error } = await supabase.from("media_renders").update({ is_approved: !current }).eq("id", renderId);
    if (!error) setRenders(prev => prev.map(r => r.id === renderId ? { ...r, is_approved: !current } : r));
  }

  async function handleLaunch() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      const selectedVideoIds = Array.from(selVideos);
      const selectedAccountIds = Array.from(selAccounts);

      if (!selectedVideoIds.length) throw new Error("Selecione pelo menos um vídeo");
      if (!selectedAccountIds.length) throw new Error("Selecione pelo menos uma conta");

      const selectedAccounts = socialAccounts.filter(a =>
        selectedAccountIds.includes(a.id)
      );

      if (!selectedAccounts.length) {
        throw new Error("Nenhuma conta social válida selecionada");
      }

      // Buscar origem/metadados dos vídeos para gravar no histórico permanente
      const { data: selectedContents, error: selectedContentsError } = await supabase
        .from("content_library")
        .select("id, title, source, external_id, original_url, thumbnail_url, author, duration_seconds, status")
        .in("id", selectedVideoIds);

      if (selectedContentsError) throw selectedContentsError;

      if (!selectedContents || selectedContents.length !== selectedVideoIds.length) {
        throw new Error("Não foi possível carregar todos os vídeos selecionados");
      }

      const unavailableContent = selectedContents.find(content =>
        ["reserved", "used"].includes(content.status)
      );

      if (unavailableContent) {
        throw new Error("Um dos vídeos selecionados já está reservado ou utilizado");
      }

      const contentById = new Map(
        selectedContents.map(content => [content.id, content])
      );

      // 1. Criar campanha
      const { data: camp, error } = await supabase.from("campanhas").insert({
        user_id: user.id,
        nome: formData.nome,
        music_track_id: formData.music_track_id,
        posts_por_dia: formData.posts_por_dia,
        hora_inicio: parseInt(formData.hora_inicio),
        hora_fim: parseInt(formData.hora_fim),
        intervalo_min: formData.intervalo_min,
        intervalo_max: formData.intervalo_max,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        status: "ativo",
      }).select().single();

      if (error) throw error;

      // 2. Vincular vídeos
      const { error: contentsError } = await supabase
        .from("campaign_contents")
        .insert(
          selectedVideoIds.map(id => ({
            campaign_id: camp.id,
            content_id: id
          }))
        );

      if (contentsError) throw contentsError;

      // 3. Vincular contas sociais
      const { error: accountsError } = await supabase
        .from("campaign_social_accounts")
        .insert(
          selectedAccountIds.map(id => ({
            campaign_id: camp.id,
            social_account_id: id
          }))
        );

      if (accountsError) throw accountsError;

      // 4. Preparar os renders aprovados/prontos
      const readyRenders = renders.filter(r =>
        selectedVideoIds.includes(r.source_content_id) &&
        r.music_track_id === formData.music_track_id &&
        r.status === "ready" &&
        r.is_approved &&
        !!r.storage_path
      );

      if (!readyRenders.length) {
        throw new Error("Nenhum vídeo processado e aprovado disponível");
      }

      // 5. Smart Campaign Engine V1
      // Agenda inteligente + Creative Rotation + stagger entre contas

      const smartPlan = generateSmartCampaignPlan({
        postsPerDay: Math.max(
          1,
          Number(formData.posts_por_dia) || 1
        ),
        startDate: formData.data_inicio,
        endDate: formData.data_fim,

        accounts: selectedAccounts.map(account => ({
          id: account.id,
          platform: account.platform,
        })),

        contents: readyRenders.map(render => ({
          id: render.source_content_id,
        })),

        minIntervalMinutes: Math.max(
          1,
          Number(formData.intervalo_min) || 60
        ),

        // Evita disparar várias contas no mesmo minuto
        accountStaggerMinutes: 7,

        // Smart Scheduler:
        // o usuário define apenas início/fim.
        // O engine divide automaticamente o período em
        // manhã, tarde e noite.
        windows: (() => {
          const startHour =
            parseInt(formData.hora_inicio, 10) || 9;

          const endHour =
            parseInt(formData.hora_fim, 10) || 21;

          if (endHour <= startHour) {
            throw new Error(
              "O horário final deve ser maior que o horário inicial"
            );
          }

          const totalHours = endHour - startHour;

          const firstEnd =
            startHour + Math.floor(totalHours / 3);

          const secondEnd =
            startHour + Math.floor((totalHours * 2) / 3);

          return [
            {
              period: "morning" as const,
              startHour,
              endHour: firstEnd,
              enabled: true,
            },
            {
              period: "afternoon" as const,
              startHour: firstEnd,
              endHour: secondEnd,
              enabled: true,
            },
            {
              period: "evening" as const,
              startHour: secondEnd,
              endHour,
              enabled: true,
            },
          ];
        })(),
      });

      const renderByContentId = new Map(
        readyRenders.map(render => [
          render.source_content_id,
          render,
        ])
      );

      const publications: any[] = smartPlan.map(slot => {
        const render = renderByContentId.get(slot.contentId);

        if (!render) {
          throw new Error(
            `Render não encontrado para o conteúdo ${slot.contentId}`
          );
        }

        const sourceContent = contentById.get(slot.contentId);

        return {
          campaign_id: camp.id,
          content_id: slot.contentId,
          music_track_id: formData.music_track_id,
          social_account_id: slot.accountId,
          platform: slot.platform,
          scheduled_for: slot.scheduledFor,
          status: "scheduled",
          user_id: user.id,
          media_render_id: render.id,
          timezone: "America/Sao_Paulo",

          source_provider:
            sourceContent?.source || null,

          source_external_id:
            sourceContent?.external_id || null,

          metadata: {
            campaign_name: formData.nome,

            smart_campaign: {
              version: "v1",
              day_period: slot.dayPeriod,
              sequence: slot.sequence,
              creative_rotation: true,
              account_stagger_minutes: 7,
            },

            audio_mode: formData.audio_mode,
            music_start_ms: formData.music_start_ms,
            music_volume: formData.music_volume,
            original_audio_volume:
              formData.original_audio_volume,

            source: {
              provider:
                sourceContent?.source || null,
              external_id:
                sourceContent?.external_id || null,
              title:
                sourceContent?.title || null,
              original_url:
                sourceContent?.original_url || null,
              thumbnail_url:
                sourceContent?.thumbnail_url || null,
              author:
                sourceContent?.author || null,
              duration_seconds:
                sourceContent?.duration_seconds || null,
            },
          },
        };
      });

      if (!publications.length) {
        throw new Error("Não foi possível gerar a agenda da campanha");
      }

      // 6. Criar publications
      const { error: publicationsError } = await supabase
        .from("publications")
        .insert(publications);

      if (publicationsError) throw publicationsError;

      // 7. Reservar os vídeos utilizados para impedir reutilização
      const usedContentIds = Array.from(
        new Set(publications.map(publication => publication.content_id))
      );

      const { error: reserveError } = await supabase
        .from("content_library")
        .update({ status: "reserved" })
        .in("id", usedContentIds);

      if (reserveError) throw reserveError;

      // 8. Marcar música como utilizada em campanha
      await supabase
        .from("music_tracks")
        .update({ campanha_ativa: true })
        .eq("id", formData.music_track_id);

      toast.success(
        `Campanha iniciada! ${publications.length} publicações agendadas.`
      );

      await fetchData();
    } catch (e: any) {
      console.error("Erro ao iniciar campanha:", e);
      toast.error("Erro ao iniciar: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Render helpers ───────────────────────────────────────────────────────
  function getRender(videoId: string): RenderItem | undefined {
    return renders.find(r => r.source_content_id === videoId && r.music_track_id === formData.music_track_id)
      || (processProgress[videoId] ? {
        id: videoId, source_content_id: videoId, music_track_id: formData.music_track_id,
        status: processProgress[videoId], storage_path: null, is_approved: false
      } : undefined);
  }

  const approvedRenders = renders.filter(r => r.is_approved && r.status === "ready");
  const selectedMusic = musicas.find(m => m.id === formData.music_track_id);

  if (loading) return (
    <DashboardLayout>
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    </DashboardLayout>
  );

  if (campanhaAtiva) return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-8 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{campanhaAtiva.nome}</h1>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">ATIVA</Badge>
        </div>
        <Card className="bg-card border-border">
          <CardContent className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-muted-foreground">Início:</span> <span className="text-foreground ml-2">{campanhaAtiva.data_inicio}</span></div>
              <div><span className="text-muted-foreground">Fim:</span> <span className="text-foreground ml-2">{campanhaAtiva.data_fim}</span></div>
              <div><span className="text-muted-foreground">Posts/dia:</span> <span className="text-foreground ml-2">{campanhaAtiva.posts_por_dia}</span></div>
            </div>
            <div className="flex gap-4 pt-4">
              <Button variant="outline" className="flex-1 border-yellow-500/20 text-yellow-500 hover:bg-yellow-500/10"
                onClick={() => supabase.from("campanhas").update({ status: "pausado" }).eq("id", campanhaAtiva.id).then(() => fetchData())}>
                Pausar Campanha
              </Button>
              <Button variant="outline" className="flex-1 border-red-500/20 text-red-500 hover:bg-red-500/10"
                onClick={async () => {
                  await supabase.from("campanhas").update({ status: "encerrado" }).eq("id", campanhaAtiva.id);
                  await supabase.from("music_tracks").update({ campanha_ativa: false }).eq("id", campanhaAtiva.music_track_id);
                  setCampanhaAtiva(null);
                  toast.success("Campanha encerrada");
                }}>
                Encerrar
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto p-6 space-y-6 animate-in fade-in duration-300">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Nova Campanha</h1>
          <p className="text-sm text-muted-foreground mt-1">Siga as etapas para configurar e lançar sua campanha.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-0">
          {STEPS.map((s, i) => {
            const done = step > s.num;
            const active = step === s.num;
            const Icon = s.icon;
            return (
              <div key={s.num} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-all ${
                    done ? "bg-primary border-primary text-white" :
                    active ? "border-primary text-primary bg-primary/10" :
                    "border-border text-muted-foreground bg-background"
                  }`}>
                    {done ? <Check size={16} /> : <Icon size={16} />}
                  </div>
                  <span className={`text-[11px] mt-1 font-medium ${active ? "text-primary" : done ? "text-muted-foreground" : "text-muted-foreground/50"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 flex-1 mb-4 transition-all ${step > s.num ? "bg-primary" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Step content */}
        <Card className="bg-card border-border">
          <CardContent className="p-6">

            {/* STEP 1 — Configurar */}
            {step === 1 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Configurações gerais</h2>
                  <p className="text-sm text-muted-foreground">
                    Defina o período e a quantidade. Os horários são distribuídos automaticamente pelo Smart Scheduler.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Nome da campanha</Label>
                  <Input placeholder="Ex: Lançamento Neon Drift — Agosto" value={formData.nome}
                    onChange={e => setFormData(p => ({ ...p, nome: e.target.value }))} className="bg-muted/50 border-border" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de início</Label>
                    <Input type="date" value={formData.data_inicio} onChange={e => setFormData(p => ({ ...p, data_inicio: e.target.value }))} className="bg-muted/50 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label>Data de fim</Label>
                    <Input type="date" value={formData.data_fim} onChange={e => setFormData(p => ({ ...p, data_fim: e.target.value }))} className="bg-muted/50 border-border" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Posts por dia (por conta)</Label>
                    <Select value={String(formData.posts_por_dia)} onValueChange={v => setFormData(p => ({ ...p, posts_por_dia: +v }))}>
                      <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3].map(n => <SelectItem key={n} value={String(n)}>{n}x/dia</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Início</Label>
                    <Input type="time" value={formData.hora_inicio} onChange={e => setFormData(p => ({ ...p, hora_inicio: e.target.value }))} className="bg-muted/50 border-border" />
                  </div>
                  <div className="space-y-2">
                    <Label>Fim</Label>
                    <Input type="time" value={formData.hora_fim} onChange={e => setFormData(p => ({ ...p, hora_fim: e.target.value }))} className="bg-muted/50 border-border" />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2 — Música */}
            {step === 2 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Escolha a música</h2>
                  <p className="text-sm text-muted-foreground">Uma música por campanha para concentrar os streams.</p>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Modo de áudio</Label>
                    <Select value={formData.audio_mode} onValueChange={(v: any) => setFormData(p => ({ ...p, audio_mode: v }))}>
                      <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="only_music">Somente música (substitui áudio original)</SelectItem>
                        <SelectItem value="music_plus_original">Música + áudio original (mix)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Início da música (segundos)</Label>
                    <Input type="number" min={0} value={formData.music_start_ms / 1000}
                      onChange={e => setFormData(p => ({ ...p, music_start_ms: (+e.target.value || 0) * 1000 }))}
                      placeholder="0 = começa do início (use para pular intro e entrar no drop)"
                      className="bg-muted/50 border-border" />
                  </div>
                </div>
                <div className="space-y-3">
                  {musicas.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-6">Nenhuma música na biblioteca. Adicione em Músicas.</p>
                  )}
                  {musicas.map(m => (
                    <div key={m.id} onClick={() => setFormData(p => ({ ...p, music_track_id: m.id }))}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                        formData.music_track_id === m.id ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-border"
                      }`}>
                      <div className="w-10 h-10 rounded-lg bg-purple-600/20 flex items-center justify-center flex-shrink-0">
                        <MusicIcon size={20} className="text-purple-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-foreground">{m.nome}</p>
                        <p className="text-xs text-muted-foreground">{m.artista}</p>
                      </div>
                      {formData.music_track_id === m.id && <Check size={18} className="text-primary flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* STEP 3 — Vídeos */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Selecione os vídeos</h2>
                    <p className="text-sm text-muted-foreground">{selVideos.size} selecionado{selVideos.size !== 1 ? "s" : ""}</p>
                  </div>
                  <Button variant="outline" size="sm" className="text-xs border-border"
                    onClick={() => setSelVideos(selVideos.size === biblioteca.length ? new Set() : new Set(biblioteca.map(v => v.id)))}>
                    {selVideos.size === biblioteca.length ? "Desmarcar todos" : "Selecionar todos"}
                  </Button>
                </div>
                {biblioteca.length === 0 && (
                  <p className="text-center text-muted-foreground text-sm py-6">Nenhum vídeo na biblioteca. Adicione em Biblioteca.</p>
                )}
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 max-h-[420px] overflow-y-auto pr-1">
                  {biblioteca.map(v => {
                    const sel = selVideos.has(v.id);
                    return (
                      <div key={v.id} onClick={() => {
                        const next = new Set(selVideos);
                        sel ? next.delete(v.id) : next.add(v.id);
                        setSelVideos(next);
                      }} className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${sel ? "border-primary" : "border-transparent hover:border-border"}`}>
                        {signedUrls[v.id] ? (
                          <video src={signedUrls[v.id]} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-muted/50 flex items-center justify-center">
                            <Video size={20} className="text-muted-foreground" />
                          </div>
                        )}
                        {v.duration_seconds && (
                          <span className="absolute bottom-1 left-1 text-[9px] bg-black/70 text-white px-1 rounded">
                            {Math.floor(v.duration_seconds / 60)}:{String(v.duration_seconds % 60).padStart(2, "0")}
                          </span>
                        )}
                        {sel && (
                          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-primary flex items-center justify-center">
                            <Check size={12} className="text-white" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4 — Processar */}
            {step === 4 && (
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">Processar vídeos</h2>
                    <p className="text-sm text-muted-foreground">O sistema junta cada vídeo com a música usando FFmpeg.</p>
                  </div>
                  <Button onClick={handleProcessAll} disabled={isProcessing}
                    className="bg-primary hover:bg-primary/90 text-white gap-2">
                    {isProcessing ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
                    {isProcessing ? "Processando..." : "Processar tudo"}
                  </Button>
                </div>
                <div className="space-y-4">
                  {Array.from(selVideos).map((id, idx) => {
                    const video = biblioteca.find(v => v.id === id);
                    const render = getRender(id);
                    const status = render?.status || "pending";
                    
                    const getProgressValue = () => {
                      if (status === "ready") return 100;
                      if (status === "processing") return 60;
                      if (status === "queued") return 15;
                      return 0;
                    };

                    const getStatusConfig = () => {
                      switch (status) {
                        case "ready":
                          return { label: "Concluído", color: "bg-emerald-500", text: "text-emerald-500", icon: <CheckCircle2 size={14} className="text-emerald-500" /> };
                        case "processing":
                          return { label: "Processando vídeo...", color: "bg-yellow-500", text: "text-yellow-500", icon: <Loader2 size={14} className="text-yellow-500 animate-spin" /> };
                        case "queued":
                          return { label: "Na fila...", color: "bg-primary", text: "text-primary", icon: <Clock size={14} className="text-primary animate-pulse" /> };
                        case "failed":
                          return { label: "Falha no processamento", color: "bg-red-500", text: "text-red-500", icon: <AlertCircle size={14} className="text-red-500" /> };
                        default:
                          return { label: "Aguardando início", color: "bg-muted", text: "text-muted-foreground", icon: <Clock size={14} /> };
                      }
                    };

                    const config = getStatusConfig();

                    return (
                      <div key={id} className="p-4 rounded-xl border border-border bg-muted/20 space-y-3">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-16 rounded-lg bg-muted/50 overflow-hidden flex-shrink-0 border border-border/50">
                            {signedUrls[id] ? <video src={signedUrls[id]} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted/50 flex items-center justify-center"><Video size={16} className="text-muted-foreground/30" /></div>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <p className="text-sm font-semibold text-foreground truncate">{video?.title || `Vídeo ${idx + 1}`}</p>
                              <div className="flex items-center gap-1.5">
                                {config.icon}
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${config.text}`}>{config.label}</span>
                              </div>
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="text-muted-foreground">Trilha: {selectedMusic?.nome}</span>
                                <span className="text-muted-foreground font-mono">{getProgressValue()}%</span>
                              </div>
                              <Progress 
                                value={getProgressValue()} 
                                className={`h-1.5 bg-muted/50 ${status === 'processing' ? '[&>div]:animate-pulse' : ''}`}
                              />
                            </div>
                          </div>
                          
                          {status === "ready" && render?.storage_path && (
                            <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary transition-colors"
                              onClick={() => handlePreview(render!, video?.title || "")}>
                              <Eye size={16} />
                            </Button>
                          )}
                        </div>
                        

                        {status === "failed" && (
                          <div className="flex items-center justify-between pt-1 border-t border-red-500/10">
                            <p className="text-[10px] text-red-500/80 italic">{render?.error_message || "Erro desconhecido durante o render"}</p>
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" className="h-6 text-[10px] border-red-500/20 text-red-500 hover:bg-red-500/10" onClick={handleProcessAll}>
                                Tentar novamente
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {!canAdvance() && (
                  <p className="text-xs text-center text-muted-foreground">Processe todos os vídeos para continuar</p>
                )}
              </div>
            )}

            {/* STEP 5 — Aprovar */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">Revisar e aprovar</h2>
                  <p className="text-sm text-muted-foreground">Assista cada vídeo antes de agendar. Só os aprovados serão postados.</p>
                </div>
                <div className="space-y-4">
                  {Array.from(selVideos).map((id, idx) => {
                    const video = biblioteca.find(v => v.id === id);
                    const render = renders.find(r => r.source_content_id === id && r.music_track_id === formData.music_track_id);
                    if (!render) return null;
                    return (
                      <div key={id} className="flex gap-4 p-4 rounded-xl border border-border bg-muted/30">
                        <div className="w-20 aspect-[9/16] rounded-lg overflow-hidden bg-muted flex-shrink-0 flex items-center justify-center cursor-pointer relative group"
                          onClick={() => handlePreview(render, video?.title || `Vídeo ${idx + 1}`)}>
                          <Play size={24} className="text-white/70" />
                          <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Eye size={18} className="text-white" />
                          </div>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-foreground mb-1">{video?.title || `Vídeo ${idx + 1}`}</p>
                          <p className="text-xs text-muted-foreground mb-3">Trilha: {selectedMusic?.nome}</p>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={() => handleToggleApprove(render.id, !!render.is_approved)}
                              className={`gap-1 h-8 text-xs ${render.is_approved ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/30" : "bg-muted border border-border text-muted-foreground hover:text-foreground"}`}>
                              <ThumbsUp size={12} /> {render.is_approved ? "Aprovado" : "Aprovar"}
                            </Button>
                            {render.is_approved && (
                              <Button size="sm" variant="outline" onClick={() => handleToggleApprove(render.id, true)}
                                className="gap-1 h-8 text-xs border-border text-muted-foreground">
                                <ThumbsDown size={12} /> Rejeitar
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="text-sm text-muted-foreground text-center">
                  {approvedRenders.length} de {selVideos.size} aprovado{approvedRenders.length !== 1 ? "s" : ""}
                </div>
              </div>
            )}

            {/* STEP 6 — Publicar */}
            {step === 6 && (
              <div className="space-y-5">
                {/* Resumo */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: "Vídeos aprovados", value: approvedRenders.length },
                    { label: "Contas", value: selAccounts.size },
                    { label: "Posts estimados", value: approvedRenders.length * selAccounts.size * formData.posts_por_dia },
                    { label: "Dias", value: Math.round((new Date(formData.data_fim).getTime() - new Date(formData.data_inicio).getTime()) / 86400000) },
                  ].map(s => (
                    <div key={s.label} className="bg-muted/30 rounded-xl p-3 text-center border border-border">
                      <p className="text-xl font-bold text-primary">{s.value}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">{s.label}</p>
                    </div>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-base font-semibold text-foreground">Contas de publicação</h2>
                    <Button variant="outline" size="sm" className="text-xs border-border"
                      onClick={() => setSelAccounts(selAccounts.size === socialAccounts.length ? new Set() : new Set(socialAccounts.map(a => a.id)))}>
                      {selAccounts.size === socialAccounts.length ? "Desmarcar todas" : "Selecionar todas"}
                    </Button>
                  </div>
                  {socialAccounts.length === 0 && (
                    <p className="text-center text-muted-foreground text-sm py-4">Nenhuma conta conectada. Vá em Contas Sociais.</p>
                  )}
                  <div className="space-y-2">
                    {socialAccounts.map(acc => (
                      <div key={acc.id} onClick={() => {
                        const next = new Set(selAccounts);
                        selAccounts.has(acc.id) ? next.delete(acc.id) : next.add(acc.id);
                        setSelAccounts(next);
                      }} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${selAccounts.has(acc.id) ? "border-primary bg-primary/10" : "border-border bg-muted/30 hover:border-border"}`}>
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                          <Users size={16} className="text-muted-foreground" />
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">
                            {acc.account_name}
                            {acc.username && (
                              <span className="text-muted-foreground font-normal"> — @{acc.username.replace(/^@/, "")}</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground capitalize">{acc.platform}</p>
                        </div>
                        <div className={`w-2 h-2 rounded-full ${acc.connection_status === "conectada" ? "bg-emerald-500" : "bg-red-500"}`} />
                        {selAccounts.has(acc.id) && <Check size={16} className="text-primary" />}
                      </div>
                    ))}
                  </div>
                </div>

                <Button onClick={handleLaunch} disabled={saving || !canAdvance()}
                  className="w-full bg-primary hover:bg-primary/90 text-white py-6 text-base font-bold gap-2">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : <Megaphone size={18} />}
                  {saving ? "Iniciando..." : "Iniciar Campanha"}
                </Button>
              </div>
            )}

          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <Button variant="outline" className="gap-2 border-border" onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1}>
            <ChevronLeft size={16} /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            {stepBlockMessage() && (
              <span className="text-xs text-muted-foreground">{stepBlockMessage()}</span>
            )}
          </div>
          {step < 6 && (
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-white" onClick={() => setStep(s => Math.min(6, s + 1))} disabled={!canAdvance()}>
              Continuar <ChevronRight size={16} />
            </Button>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      <Dialog open={previewOpen} onOpenChange={o => { if (!o) { setPreviewOpen(false); setPreviewUrl(null); } }}>
        <DialogContent className="max-w-sm bg-black border-slate-800 p-0 overflow-hidden">
          <DialogHeader className="p-4 border-b border-slate-800">
            <DialogTitle className="text-slate-200 text-sm">{previewTitle}</DialogTitle>
          </DialogHeader>
          <div className="aspect-[9/16] bg-black flex items-center justify-center">
            {previewLoading ? (
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
            ) : previewUrl ? (
              <video 
                src={previewUrl} 
                controls 
                autoPlay 
                playsInline
                preload="metadata"
                className="w-full h-full object-contain" 
              />
            ) : (
              <AlertCircle className="w-8 h-8 text-red-500" />
            )}
          </div>
          <div className="p-4 flex gap-3 border-t border-slate-800">
            <Button className="flex-1 bg-primary text-white gap-2" onClick={() => {
              toast.success("Aprovado!");
              setPreviewOpen(false);
            }}>
              <CheckCircle2 size={16} /> Aprovar
            </Button>
            <Button variant="outline" className="border-slate-700 text-slate-400" onClick={() => setPreviewOpen(false)}>
              Fechar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
