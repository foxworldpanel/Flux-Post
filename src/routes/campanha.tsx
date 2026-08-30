import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Check, X, Loader2, Play, Music as MusicIcon, Video, CheckCircle2,
  AlertCircle, RotateCcw, RefreshCw, ChevronRight, ChevronLeft,
  Calendar, Clock, Users, Megaphone, Eye, ThumbsUp, ThumbsDown, Zap,
  Sparkles
} from "lucide-react";
import { format, addDays } from "date-fns";
import { socialService, type SocialAccount } from "@/services/social";
import { contentService } from "@/services/content";
import {
  generateSmartCampaignPlan,
  resolveSmartCampaignConflicts,
} from "@/services/smart-campaign-engine";

// ─── Types ────────────────────────────────────────────────────────────────────
type Artist = {
  id: string;
  name: string;
  primary_language: string | null;
  priority_hashtags: string[] | null;
  blocked_hashtags: string[] | null;
  ai_briefing: string | null;
  communication_identity: string | null;
};

type MusicTrack = { id: string; nome: string; artista: string; artist_id: string; storage_path: string | null; };
type VideoItem = { id: string; title: string; storage_path: string; duration_seconds?: number; };
type RenderItem = { id: string; source_content_id: string; music_track_id: string; status: string; storage_path: string | null; is_approved?: boolean; error_message?: string | null; };

type EditorialCopy = {
  caption: string;
  hashtags: string;
  aiStatus: "idle" | "generating" | "generated" | "edited";
};

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
  const [artistas, setArtistas] = useState<Artist[]>([]);
  const [musicas, setMusicas] = useState<MusicTrack[]>([]);
  const [biblioteca, setBiblioteca] = useState<VideoItem[]>([]);
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[]>([]);
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [renders, setRenders] = useState<RenderItem[]>([]);

  // Form
  const [formData, setFormData] = useState({
    nome: "",
    artist_id: "",
    music_track_id: "",
    posts_por_dia: 2,
    data_inicio: format(new Date(), "yyyy-MM-dd"),
    data_fim: format(addDays(new Date(), 30), "yyyy-MM-dd"),
    hora_inicio: "09:00",
    hora_fim: "21:00",
    schedule_mode: "automatic" as "automatic" | "manual" | "hybrid",
    intervalo_min: 40,
    intervalo_max: 90,
    audio_mode: "only_music" as "only_music" | "music_plus_original",
    music_volume: 80,
    original_audio_volume: 20,
    music_start_ms: 0,
  });

  // Selections
  const [selVideos, setSelVideos] = useState<Set<string>>(new Set());

  // Content Queue — ordem editorial explícita dos conteúdos
  const [contentQueue, setContentQueue] = useState<string[]>([]);

  // Schedule Preview V2
  // Fonte editável da agenda antes da criação das publications.
  type SchedulePreviewItem = {
    accountId: string;
    platform: string;
    contentId: string;
    scheduledFor: string;
    dayPeriod: "morning" | "afternoon" | "evening";
    sequence: number;
    manuallyEdited?: boolean;
  };

  const [schedulePreview, setSchedulePreview] =
    useState<SchedulePreviewItem[]>([]);

  const [schedulePreviewSignature, setSchedulePreviewSignature] =
    useState("");

  // Copy editorial — posteriormente preenchida pela Claude
  const [editorialCopies, setEditorialCopies] = useState<Record<string, EditorialCopy>>({});

  const getEditorialCopy = (contentId: string): EditorialCopy =>
    editorialCopies[contentId] || {
      caption: "",
      hashtags: "",
      aiStatus: "idle",
    };

  const updateEditorialCopy = (
    contentId: string,
    field: "caption" | "hashtags",
    value: string
  ) => {
    setEditorialCopies(prev => {
      const current = prev[contentId] || {
        caption: "",
        hashtags: "",
        aiStatus: "idle" as const,
      };

      return {
        ...prev,
        [contentId]: {
          ...current,
          [field]: value,
          aiStatus: "edited",
        },
      };
    });
  };

  const normalizeHashtag = (tag: string) =>
    tag
      .trim()
      .replace(/^#+/, "")
      .replace(/\s+/g, "")
      .replace(/[^a-zA-Z0-9_À-ÿ]/g, "");

  const mergeArtistHashtags = (generated: string) => {
    const artist = artistas.find(a => a.id === formData.artist_id);

    const blocked = new Set(
      (artist?.blocked_hashtags || [])
        .map(normalizeHashtag)
        .filter(Boolean)
        .map(tag => tag.toLowerCase())
    );

    const priority = (artist?.priority_hashtags || [])
      .map(normalizeHashtag)
      .filter(Boolean)
      .filter(tag => !blocked.has(tag.toLowerCase()));

    const generatedTags = (generated || "")
      .split(/[\s,]+/)
      .map(normalizeHashtag)
      .filter(Boolean)
      .filter(tag => !blocked.has(tag.toLowerCase()));

    const unique = new Map<string, string>();

    [...priority, ...generatedTags].forEach(tag => {
      const key = tag.toLowerCase();
      if (!unique.has(key)) unique.set(key, tag);
    });

    return Array.from(unique.values())
      .map(tag => `#${tag}`)
      .join(" ");
  };

  const [isGeneratingAllEditorial, setIsGeneratingAllEditorial] = useState(false);
  const [isApprovingAllEditorial, setIsApprovingAllEditorial] = useState(false);

  const generateEditorialCopy = async (
    contentId: string,
    contentTitle: string,
    silent = false
  ): Promise<boolean> => {
    const current = getEditorialCopy(contentId);

    setEditorialCopies(prev => ({
      ...prev,
      [contentId]: {
        ...current,
        aiStatus: "generating",
      },
    }));

    try {
      const { data, error } = await supabase.functions.invoke(
        "campaign-copy-generator",
        {
          body: {
            contentId,
            contentTitle,
            platform: "generic",
            music: {
              title: selectedMusic?.nome || "",
              artist: selectedMusic?.artista || "",
            },
            artistProfile: (() => {
              const artist = artistas.find(a => a.id === formData.artist_id);

              return {
                name: artist?.name || selectedMusic?.artista || "",
                primaryLanguage: artist?.primary_language || "pt-BR",
                communicationIdentity: artist?.communication_identity || "",
                aiBriefing: artist?.ai_briefing || "",
                priorityHashtags: artist?.priority_hashtags || [],
                blockedHashtags: artist?.blocked_hashtags || [],
              };
            })(),
            regenerate:
              current.aiStatus === "generated" ||
              current.aiStatus === "edited",
            previousCaption: current.caption,
            previousHashtags: current.hashtags,
          },
        }
      );

      if (error) {
        throw error;
      }

      if (!data?.success || !data?.copy) {
        throw new Error(data?.error || "Claude não retornou uma copy válida.");
      }

      setEditorialCopies(prev => ({
        ...prev,
        [contentId]: {
          caption: data.copy.caption || "",
          hashtags: mergeArtistHashtags(data.copy.hashtags || ""),
          aiStatus: "generated",
        },
      }));

      if (!silent) {
        toast.success("Legenda e hashtags geradas com Claude.");
      }

      return true;
    } catch (error: any) {
      console.error("[CLAUDE COPY]", error);

      setEditorialCopies(prev => ({
        ...prev,
        [contentId]: {
          ...current,
          aiStatus: current.caption || current.hashtags ? "edited" : "idle",
        },
      }));

      if (!silent) {
        toast.error(
          error?.message || "Não foi possível gerar a legenda com Claude."
        );
      }

      return false;
    }
  };

  const approveAllEditorial = async () => {
    if (isApprovingAllEditorial) return;

    const readyRenders = renders.filter(render =>
      contentQueue.includes(render.source_content_id) &&
      render.music_track_id === formData.music_track_id &&
      render.status === "ready" &&
      !render.is_approved
    );

    if (!readyRenders.length) {
      toast.success("Todos os conteúdos prontos já estão aprovados.");
      return;
    }

    setIsApprovingAllEditorial(true);

    try {
      const ids = readyRenders.map(render => render.id);

      const { error } = await supabase
        .from("media_renders")
        .update({ is_approved: true })
        .in("id", ids);

      if (error) throw error;

      const idSet = new Set(ids);

      setRenders(prev =>
        prev.map(render =>
          idSet.has(render.id)
            ? { ...render, is_approved: true }
            : render
        )
      );

      toast.success(
        `${ids.length} ${ids.length === 1 ? "conteúdo aprovado" : "conteúdos aprovados"}.`
      );
    } catch (error: any) {
      console.error("[APPROVE ALL]", error);
      toast.error(error?.message || "Não foi possível aprovar todos os conteúdos.");
    } finally {
      setIsApprovingAllEditorial(false);
    }
  };

  const generateAllEditorialCopies = async () => {
    if (isGeneratingAllEditorial) return;

    if (!formData.artist_id) {
      toast.error("Selecione o artista da campanha.");
      return;
    }

    if (!contentQueue.length) {
      toast.error("Nenhum vídeo selecionado.");
      return;
    }

    setIsGeneratingAllEditorial(true);

    let successCount = 0;
    let errorCount = 0;

    try {
      for (const contentId of contentQueue) {
        const video = biblioteca.find(v => v.id === contentId);

        if (!video) {
          errorCount++;
          continue;
        }

        const success = await generateEditorialCopy(
          contentId,
          video.title || "Vídeo",
          true
        );

        if (success) {
          successCount++;
        } else {
          errorCount++;
        }
      }

      if (errorCount === 0) {
        toast.success(
          `${successCount} ${successCount === 1 ? "conteúdo gerado" : "conteúdos gerados"} com Claude.`
        );
      } else {
        toast.warning(
          `${successCount} gerados com sucesso e ${errorCount} com erro.`
        );
      }
    } finally {
      setIsGeneratingAllEditorial(false);
    }
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelVideos(prev => {
      const next = new Set(prev);

      if (next.has(videoId)) {
        next.delete(videoId);
        setContentQueue(queue => queue.filter(id => id !== videoId));
      } else {
        next.add(videoId);
        setContentQueue(queue =>
          queue.includes(videoId) ? queue : [...queue, videoId]
        );
      }

      return next;
    });
  };

  const selectAllVideos = () => {
    if (selVideos.size === biblioteca.length) {
      setSelVideos(new Set());
      setContentQueue([]);
      return;
    }

    const ids = biblioteca.map(video => video.id);
    setSelVideos(new Set(ids));
    setContentQueue(ids);
  };

  const moveContentInQueue = (
    videoId: string,
    direction: "up" | "down"
  ) => {
    setContentQueue(queue => {
      const index = queue.indexOf(videoId);
      if (index === -1) return queue;

      const target =
        direction === "up" ? index - 1 : index + 1;

      if (target < 0 || target >= queue.length) return queue;

      const next = [...queue];
      [next[index], next[target]] =
        [next[target], next[index]];

      return next;
    });
  };
  const [selAccounts, setSelAccounts] = useState<Set<string>>(new Set());

  // Processing
  const [isProcessing, setIsProcessing] = useState(false);
  const [processProgress, setProcessProgress] = useState<Record<string, string>>({});

  // Preview
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewTitle, setPreviewTitle] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);

  // Active campaigns — Campaign V2 supports multiple simultaneous campaigns
  const [campanhasAtivas, setCampanhasAtivas] = useState<any[]>([]);

  // Persistent campaign draft
  const [draftCampaignId, setDraftCampaignId] = useState<string | null>(null);

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

      const [artistsRes, tracksRes, libraryRes, accountsRes, campRes, rendersRes, draftRes] = await Promise.all([
        supabase
          .from("artists")
          .select("id, name, primary_language, priority_hashtags, blocked_hashtags, ai_briefing, communication_identity")
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("name", { ascending: true }),
        supabase.from("music_tracks").select("id, nome, artista, artist_id, storage_path"),
        supabase
          .from("content_library")
          .select("id, title, storage_path, duration_seconds")
          .not("status", "in", '("reserved","used")')
          .order("created_at", { ascending: false }),
        socialService.getConnectedAccounts(),
        supabase.from("campanhas").select("*").eq("user_id", user.id).in("status", ["ativo", "pausado"]).order("data_inicio", { ascending: false }),
        supabase.from("media_renders").select("*").eq("user_id", user.id),
        supabase
          .from("campanhas")
          .select("*")
          .eq("user_id", user.id)
          .eq("status", "rascunho")
          .order("criado_em", { ascending: false })
          .limit(1)
      ]);

      setArtistas(artistsRes.data || []);
      setMusicas(tracksRes.data || []);
      setBiblioteca(libraryRes.data || []);
      setSocialAccounts(accountsRes || []);
      setRenders(rendersRes.data || []);

      // Restore latest campaign draft
      const draft = draftRes.data?.[0];

      if (draft) {
        setDraftCampaignId(draft.id);

        setFormData(prev => ({
          ...prev,
          nome: draft.nome || "",
          artist_id: draft.artist_id || "",
          music_track_id: draft.music_track_id || "",
          posts_por_dia: draft.posts_por_dia ?? prev.posts_por_dia,
          intervalo_min: draft.intervalo_min ?? prev.intervalo_min,
          intervalo_max: draft.intervalo_max ?? prev.intervalo_max,
          data_inicio: draft.data_inicio || prev.data_inicio,
          data_fim: draft.data_fim || prev.data_fim,
          schedule_mode:
            draft.schedule_mode === "manual" || draft.schedule_mode === "hybrid"
              ? draft.schedule_mode
              : "automatic",
          hora_inicio:
            draft.daily_start_time
              ? String(draft.daily_start_time).slice(0, 5)
              : typeof draft.hora_inicio === "number"
              ? `${String(draft.hora_inicio).padStart(2, "0")}:00`
              : draft.hora_inicio || prev.hora_inicio,
          hora_fim:
            draft.daily_end_time
              ? String(draft.daily_end_time).slice(0, 5)
              : typeof draft.hora_fim === "number"
              ? `${String(draft.hora_fim).padStart(2, "0")}:00`
              : draft.hora_fim || prev.hora_fim,
          audio_mode: draft.audio_mode || prev.audio_mode,
          music_volume: draft.music_volume ?? prev.music_volume,
          original_audio_volume:
            draft.original_audio_volume ?? prev.original_audio_volume,
          music_start_ms: draft.music_start_ms ?? prev.music_start_ms,
        }));

        const [draftContentsRes, draftAccountsRes] = await Promise.all([
          supabase
            .from("campaign_contents")
            .select(
              "content_id, position, caption, hashtags, editorial_status"
            )
            .eq("campaign_id", draft.id)
            .order("position", { ascending: true }),

          supabase
            .from("campaign_social_accounts")
            .select("social_account_id")
            .eq("campaign_id", draft.id),
        ]);

        if (draftContentsRes.error) {
          console.error(
            "Erro ao carregar conteúdos do rascunho:",
            draftContentsRes.error
          );
        } else {
          const draftContents = draftContentsRes.data || [];
          const ids = draftContents.map(item => item.content_id);

          setSelVideos(new Set(ids));
          setContentQueue(ids);

          const restoredCopies: Record<string, EditorialCopy> = {};

          draftContents.forEach(item => {
            restoredCopies[item.content_id] = {
              caption: item.caption || "",
              hashtags: item.hashtags || "",
              aiStatus:
                item.caption || item.hashtags
                  ? item.editorial_status === "generated"
                    ? "generated"
                    : "edited"
                  : "idle",
            };
          });

          setEditorialCopies(restoredCopies);
        }

        if (draftAccountsRes.error) {
          console.error(
            "Erro ao carregar contas do rascunho:",
            draftAccountsRes.error
          );
        } else {
          setSelAccounts(
            new Set(
              (draftAccountsRes.data || []).map(
                item => item.social_account_id
              )
            )
          );
        }

        console.log("[CAMPAIGN DRAFT] Restaurado:", draft.id);
      } else {
        setDraftCampaignId(null);
      }

      // Campaign V2: process all active/paused campaigns independently
      const loadedCampaigns = campRes.data || [];
      const remainingCampaigns: any[] = [];

      for (const campaign of loadedCampaigns) {
        const { data: campaignPublications, error: publicationsError } =
          await supabase
            .from("publications")
            .select("id, status")
            .eq("campaign_id", campaign.id);

        if (publicationsError) {
          console.error(
            "Erro ao verificar publicações da campanha:",
            campaign.id,
            publicationsError
          );
          remainingCampaigns.push(campaign);
          continue;
        }

        const publications = campaignPublications || [];
        const allPublished =
          publications.length > 0 &&
          publications.every(pub => pub.status === "published");

        if (allPublished) {
          const { error: completeError } = await supabase
            .from("campanhas")
            .update({ status: "concluido" })
            .eq("id", campaign.id);

          if (completeError) {
            console.error(
              "Erro ao concluir campanha:",
              campaign.id,
              completeError
            );
            remainingCampaigns.push(campaign);
          } else {
            console.log("[CAMPAIGN V2] Campanha concluída:", campaign.id);
          }
        } else {
          remainingCampaigns.push(campaign);
        }
      }

      setCampanhasAtivas(remainingCampaigns);

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

  function buildSmartSchedulePlan(
    selectedAccounts: SocialAccount[],
    readyRenders: RenderItem[]
  ): SchedulePreviewItem[] {
    return generateSmartCampaignPlan({
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

      contents: contentQueue
        .map(contentId =>
          readyRenders.find(
            render => render.source_content_id === contentId
          )
        )
        .filter(Boolean)
        .map(render => ({
          id: render!.source_content_id,
        })),

      minIntervalMinutes: Math.max(
        1,
        Number(formData.intervalo_min) || 60
      ),

      accountStaggerMinutes: 7,

      windows: (() => {
        const parseTimeToMinutes = (
          value: string,
          fallbackHour: number
        ) => {
          const [hourRaw, minuteRaw] = value.split(":");
          const hour = Number(hourRaw);
          const minute = Number(minuteRaw);

          if (
            !Number.isInteger(hour) ||
            !Number.isInteger(minute) ||
            hour < 0 ||
            hour > 23 ||
            minute < 0 ||
            minute > 59
          ) {
            return fallbackHour * 60;
          }

          return hour * 60 + minute;
        };

        const startMinutes = parseTimeToMinutes(
          formData.hora_inicio,
          9
        );

        const endMinutes = parseTimeToMinutes(
          formData.hora_fim,
          21
        );

        if (endMinutes <= startMinutes) {
          throw new Error(
            "O horário final deve ser maior que o horário inicial"
          );
        }

        const totalMinutes = endMinutes - startMinutes;
        const firstEnd =
          startMinutes + Math.floor(totalMinutes / 3);
        const secondEnd =
          startMinutes + Math.floor((totalMinutes * 2) / 3);

        const toWindowTime = (total: number) => ({
          hour: Math.floor(total / 60),
          minute: total % 60,
        });

        const start = toWindowTime(startMinutes);
        const first = toWindowTime(firstEnd);
        const second = toWindowTime(secondEnd);
        const end = toWindowTime(endMinutes);

        return [
          {
            period: "morning" as const,
            startHour: start.hour,
            startMinute: start.minute,
            endHour: first.hour,
            endMinute: first.minute,
            enabled: true,
          },
          {
            period: "afternoon" as const,
            startHour: first.hour,
            startMinute: first.minute,
            endHour: second.hour,
            endMinute: second.minute,
            enabled: true,
          },
          {
            period: "evening" as const,
            startHour: second.hour,
            startMinute: second.minute,
            endHour: end.hour,
            endMinute: end.minute,
            enabled: true,
          },
        ];
      })(),
    });
  }

  function updateSchedulePreviewDateTime(
    index: number,
    localDateTime: string
  ) {
    if (!localDateTime) return;

    const match = localDateTime.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/
    );

    if (!match) {
      toast.error("Data ou horário inválido");
      return;
    }

    const [, year, month, day, hour, minute] = match;

    const selectedDate = `${year}-${month}-${day}`;
    const selectedTime = `${hour}:${minute}`;

    if (
      selectedDate < formData.data_inicio ||
      selectedDate > formData.data_fim
    ) {
      toast.error(
        `Escolha uma data entre ${formData.data_inicio} e ${formData.data_fim}.`
      );
      return;
    }

    if (
      selectedTime < formData.hora_inicio ||
      selectedTime > formData.hora_fim
    ) {
      toast.error(
        `Escolha um horário entre ${formData.hora_inicio} e ${formData.hora_fim}.`
      );
      return;
    }

    // Campanhas atualmente operam em America/Sao_Paulo (UTC-03).
    const scheduledFor =
      `${year}-${month}-${day}T${hour}:${minute}:00-03:00`;

    setSchedulePreview(previous =>
      previous.map((slot, slotIndex) =>
        slotIndex === index
          ? {
              ...slot,
              scheduledFor,
              manuallyEdited: true,
            }
          : slot
      )
    );
  }

  function schedulePreviewInputValue(
    scheduledFor: string
  ): string {
    const date = new Date(scheduledFor);

    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(date);

    const get = (type: string) =>
      parts.find(part => part.type === type)?.value || "";

    return (
      `${get("year")}-${get("month")}-${get("day")}` +
      `T${get("hour")}:${get("minute")}`
    );
  }

  function buildSchedulePreviewSignature(): string {
    return JSON.stringify({
      artistId: formData.artist_id,
      musicTrackId: formData.music_track_id,
      postsPerDay: formData.posts_por_dia,
      startDate: formData.data_inicio,
      endDate: formData.data_fim,
      startTime: formData.hora_inicio,
      endTime: formData.hora_fim,
      minInterval: formData.intervalo_min,
      scheduleMode: formData.schedule_mode,
      contentIds: [...contentQueue],
      accountIds: Array.from(selAccounts).sort(),
    });
  }

  function handleContinueStep() {
    if (!canAdvance()) return;

    // Ao entrar no Step 6, verificamos se a configuração
    // que influencia a agenda mudou.
    if (step === 5) {
      const signature = buildSchedulePreviewSignature();

      if (signature !== schedulePreviewSignature) {
        const selectedAccounts = socialAccounts.filter(account =>
          selAccounts.has(account.id)
        );

        const readyRenders = renders.filter(render =>
          contentQueue.includes(render.source_content_id) &&
          render.music_track_id === formData.music_track_id &&
          render.status === "ready" &&
          render.is_approved &&
          !!render.storage_path
        );

        if (selectedAccounts.length && readyRenders.length) {
          try {
            const preview = buildSmartSchedulePlan(
              selectedAccounts,
              readyRenders
            );

            setSchedulePreview(preview);
            setSchedulePreviewSignature(signature);
          } catch (error: any) {
            console.error(
              "[SCHEDULE PREVIEW] Erro ao gerar agenda:",
              error
            );

            setSchedulePreview([]);
            setSchedulePreviewSignature("");

            toast.error(
              "Não foi possível gerar a agenda: " +
                (error?.message || "erro desconhecido")
            );

            return;
          }
        } else {
          setSchedulePreview([]);
          setSchedulePreviewSignature("");
        }
      }
    }

    setStep(current => Math.min(6, current + 1));
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

      for (const videoId of contentQueue) {
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

  async function saveDraft(showToast = true): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    if (!formData.nome.trim()) {
      throw new Error("Informe o nome da campanha antes de salvar o rascunho");
    }

    if (!formData.artist_id) {
      throw new Error("Selecione o artista da campanha");
    }

    const campaignData = {
      user_id: user.id,
      nome: formData.nome.trim(),
      artist_id: formData.artist_id || null,
      music_track_id: formData.music_track_id || null,
      posts_por_dia: formData.posts_por_dia,
      hora_inicio: parseInt(formData.hora_inicio, 10),
      hora_fim: parseInt(formData.hora_fim, 10),
      daily_start_time: formData.hora_inicio,
      daily_end_time: formData.hora_fim,
      schedule_mode: formData.schedule_mode,
      intervalo_min: formData.intervalo_min,
      intervalo_max: formData.intervalo_max,
      data_inicio: formData.data_inicio,
      data_fim: formData.data_fim,
      audio_mode: formData.audio_mode,
      music_volume: formData.music_volume,
      original_audio_volume: formData.original_audio_volume,
      music_start_ms: formData.music_start_ms,
      status: "rascunho",
    };

    let campaignId = draftCampaignId;

    if (campaignId) {
      const { error } = await supabase
        .from("campanhas")
        .update(campaignData)
        .eq("id", campaignId)
        .eq("user_id", user.id)
        .eq("status", "rascunho");

      if (error) throw error;
    } else {
      const { data: draft, error } = await supabase
        .from("campanhas")
        .insert(campaignData)
        .select("id")
        .single();

      if (error) throw error;
      if (!draft?.id) throw new Error("Não foi possível criar o rascunho");

      campaignId = draft.id;
      setDraftCampaignId(campaignId);
    }

    // Sincronizar conteúdos e preservar a ordem editorial
    const { error: deleteContentsError } = await supabase
      .from("campaign_contents")
      .delete()
      .eq("campaign_id", campaignId);

    if (deleteContentsError) throw deleteContentsError;

    if (contentQueue.length) {
      const { error: contentsError } = await supabase
        .from("campaign_contents")
        .insert(
          contentQueue.map((contentId, index) => {
            const copy = getEditorialCopy(contentId);

            const isApproved = renders.some(
              render =>
                render.source_content_id === contentId &&
                render.music_track_id === formData.music_track_id &&
                render.status === "ready" &&
                render.is_approved
            );

            return {
              campaign_id: campaignId,
              content_id: contentId,
              position: index + 1,
              caption: copy.caption.trim() || null,
              hashtags: mergeArtistHashtags(copy.hashtags) || null,
              editorial_status: isApproved
                ? "approved"
                : copy.aiStatus === "generated"
                ? "generated"
                : copy.aiStatus === "edited"
                ? "edited"
                : "pending",
              approved_at: isApproved
                ? new Date().toISOString()
                : null,
            };
          })
        );

      if (contentsError) throw contentsError;
    }

    // Sincronizar contas selecionadas
    const { error: deleteAccountsError } = await supabase
      .from("campaign_social_accounts")
      .delete()
      .eq("campaign_id", campaignId);

    if (deleteAccountsError) throw deleteAccountsError;

    const accountIds = Array.from(selAccounts);

    if (accountIds.length) {
      const { error: accountsError } = await supabase
        .from("campaign_social_accounts")
        .insert(
          accountIds.map(accountId => ({
            campaign_id: campaignId,
            social_account_id: accountId,
          }))
        );

      if (accountsError) throw accountsError;
    }

    if (showToast) {
      toast.success("Rascunho salvo.");
    }

    console.log("[CAMPAIGN DRAFT] Salvo:", campaignId);

    return campaignId;
  }

  async function handleLaunch() {
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Não autenticado");

      // A Content Queue é a fonte oficial da ordem editorial
      const selectedVideoIds = [...contentQueue];
      const selectedAccountIds = Array.from(selAccounts);

      if (!formData.artist_id) throw new Error("Selecione o artista da campanha");
      if (!formData.music_track_id) throw new Error("Selecione uma música");
      if (!selectedVideoIds.length) throw new Error("Selecione pelo menos um vídeo");
      if (!selectedAccountIds.length) throw new Error("Selecione pelo menos uma conta");

      const launchMusic = musicas.find(m => m.id === formData.music_track_id);

      if (!launchMusic || launchMusic.artist_id !== formData.artist_id) {
        throw new Error("A música selecionada não pertence ao artista da campanha");
      }

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

      // 1. Ativar o rascunho existente ou criar uma nova campanha
      const campaignPayload = {
        user_id: user.id,
        nome: formData.nome,
        artist_id: formData.artist_id || null,
        music_track_id: formData.music_track_id,
        posts_por_dia: formData.posts_por_dia,
        hora_inicio: parseInt(formData.hora_inicio, 10),
        hora_fim: parseInt(formData.hora_fim, 10),
        daily_start_time: formData.hora_inicio,
        daily_end_time: formData.hora_fim,
        schedule_mode: formData.schedule_mode,
        intervalo_min: formData.intervalo_min,
        intervalo_max: formData.intervalo_max,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        audio_mode: formData.audio_mode,
        music_volume: formData.music_volume,
        original_audio_volume: formData.original_audio_volume,
        music_start_ms: formData.music_start_ms,
        status: "ativo",
      };

      let camp: any;

      if (draftCampaignId) {
        const { data, error } = await supabase
          .from("campanhas")
          .update(campaignPayload)
          .eq("id", draftCampaignId)
          .eq("user_id", user.id)
          .eq("status", "rascunho")
          .select()
          .single();

        if (error) throw error;
        camp = data;

        // O rascunho já pode possuir vínculos.
        // Recriamos abaixo usando o estado final da interface.
        const [deleteContentsRes, deleteAccountsRes] = await Promise.all([
          supabase
            .from("campaign_contents")
            .delete()
            .eq("campaign_id", camp.id),
          supabase
            .from("campaign_social_accounts")
            .delete()
            .eq("campaign_id", camp.id),
        ]);

        if (deleteContentsRes.error) throw deleteContentsRes.error;
        if (deleteAccountsRes.error) throw deleteAccountsRes.error;
      } else {
        const { data, error } = await supabase
          .from("campanhas")
          .insert(campaignPayload)
          .select()
          .single();

        if (error) throw error;
        camp = data;
      }

      // 2. Vincular vídeos
      const { error: contentsError } = await supabase
        .from("campaign_contents")
        .insert(
          selectedVideoIds.map((id, index) => {
            const editorialCopy = getEditorialCopy(id);
            const isApproved = renders.some(
              r =>
                r.source_content_id === id &&
                r.music_track_id === formData.music_track_id &&
                r.status === "ready" &&
                r.is_approved
            );

            return {
              campaign_id: camp.id,
              content_id: id,
              position: index + 1,
              caption: editorialCopy.caption.trim() || null,
              hashtags: mergeArtistHashtags(editorialCopy.hashtags) || null,
              editorial_status: isApproved
                ? "approved"
                : editorialCopy.aiStatus === "generated"
                ? "generated"
                : editorialCopy.aiStatus === "edited"
                ? "edited"
                : "pending",
              approved_at: isApproved
                ? new Date().toISOString()
                : null,
            };
          })
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

      // 5. Smart Campaign Engine V2
      // Usa exatamente a agenda revisada no Step 6.
      // Se o preview estiver inválido ou desatualizado,
      // recalcula de forma segura antes do lançamento.
      const currentScheduleSignature =
        buildSchedulePreviewSignature();

      const canUseSchedulePreview =
        schedulePreview.length > 0 &&
        schedulePreviewSignature === currentScheduleSignature;

      const smartPlan: SchedulePreviewItem[] =
        canUseSchedulePreview
          ? schedulePreview
          : buildSmartSchedulePlan(
              selectedAccounts,
              readyRenders
            );

      if (!smartPlan.length) {
        throw new Error(
          "A agenda da campanha está vazia. Revise os horários antes de publicar."
        );
      }

      // Manual exige confirmação explícita de todos os horários.
      if (
        formData.schedule_mode === "manual" &&
        smartPlan.some(slot => !slot.manuallyEdited)
      ) {
        throw new Error(
          "No modo Manual, revise e defina o horário de todas as publicações."
        );
      }

      const renderByContentId = new Map(
        readyRenders.map(render => [
          render.source_content_id,
          render,
        ])
      );

      // 5.1 Resolver conflitos com outras campanhas
      // Busca apenas publicações que ainda ocupam espaço na agenda.
      const scheduleTimes = smartPlan
        .map(slot => new Date(slot.scheduledFor).getTime())
        .filter(Number.isFinite);

      if (!scheduleTimes.length) {
        throw new Error("Agenda gerada sem horários válidos");
      }

      const scheduleStart = new Date(
        Math.min(...scheduleTimes) -
          Math.max(1, Number(formData.intervalo_min) || 60) * 60_000
      ).toISOString();

      const scheduleEnd = new Date(
        Math.max(...scheduleTimes) +
          24 * 60 * 60_000
      ).toISOString();

      const { data: occupiedPublications, error: occupiedError } =
        await supabase
          .from("publications")
          .select("social_account_id, scheduled_for, status")
          .in("social_account_id", selectedAccountIds)
          .in("status", [
            "scheduled",
            "queued",
            "waiting_render",
            "ready_to_post",
            "publishing",
          ])
          .gte("scheduled_for", scheduleStart)
          .lte("scheduled_for", scheduleEnd);

      if (occupiedError) {
        throw new Error(
          "Não foi possível verificar conflitos de agenda: " +
            occupiedError.message
        );
      }

      const minScheduleInterval = Math.max(
        1,
        Number(formData.intervalo_min) || 60
      );

      const occupiedSlots = (occupiedPublications || [])
        .filter(
          publication =>
            publication.social_account_id &&
            publication.scheduled_for
        )
        .map(publication => ({
          accountId: publication.social_account_id,
          scheduledFor: publication.scheduled_for,
        }));

      // Horários definidos manualmente são imutáveis.
      // No modo Manual todos os slots são fixos.
      // No Híbrido apenas os horários editados pelo usuário são fixos.
      const fixedSlots = smartPlan.filter(
        slot =>
          formData.schedule_mode === "manual" ||
          Boolean(slot.manuallyEdited)
      );

      const movableSlots = smartPlan.filter(
        slot => !fixedSlots.includes(slot)
      );

      const fixedOccupiedByAccount = new Map<string, number[]>();

      const addFixedOccupied = (
        accountId: string,
        scheduledFor: string
      ) => {
        const timestamp = new Date(scheduledFor).getTime();

        if (!Number.isFinite(timestamp)) {
          throw new Error(
            "Existe um horário manual inválido na agenda."
          );
        }

        const list =
          fixedOccupiedByAccount.get(accountId) || [];

        list.push(timestamp);
        fixedOccupiedByAccount.set(accountId, list);
      };

      occupiedSlots.forEach(slot => {
        addFixedOccupied(slot.accountId, slot.scheduledFor);
      });

      const minScheduleIntervalMs =
        minScheduleInterval * 60_000;

      // Valida primeiro os horários que o usuário definiu.
      // Se houver conflito, não movemos silenciosamente.
      for (const slot of [...fixedSlots].sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      )) {
        const timestamp =
          new Date(slot.scheduledFor).getTime();

        const occupied =
          fixedOccupiedByAccount.get(slot.accountId) || [];

        const hasConflict = occupied.some(
          existing =>
            Math.abs(timestamp - existing) <
            minScheduleIntervalMs
        );

        if (hasConflict) {
          throw new Error(
            "Um horário definido manualmente conflita com outra publicação dessa conta. Ajuste o horário na agenda antes de iniciar a campanha."
          );
        }

        addFixedOccupied(
          slot.accountId,
          slot.scheduledFor
        );
      }

      // Somente horários automáticos podem ser deslocados.
      const resolvedMovableSlots =
        resolveSmartCampaignConflicts(movableSlots, {
          occupiedSlots: [
            ...occupiedSlots,
            ...fixedSlots.map(slot => ({
              accountId: slot.accountId,
              scheduledFor: slot.scheduledFor,
            })),
          ],
          minIntervalMinutes: minScheduleInterval,
          shiftStepMinutes: 5,
          startDate: formData.data_inicio,
          endDate: formData.data_fim,
          dailyStartTime: formData.hora_inicio,
          dailyEndTime: formData.hora_fim,
        });

      const resolvedSmartPlan = [
        ...fixedSlots,
        ...resolvedMovableSlots,
      ].sort(
        (a, b) =>
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      );

      const publications: any[] = resolvedSmartPlan.map(slot => {
        const render = renderByContentId.get(slot.contentId);

        if (!render) {
          throw new Error(
            `Render não encontrado para o conteúdo ${slot.contentId}`
          );
        }

        const sourceContent = contentById.get(slot.contentId);
        const editorialCopy = getEditorialCopy(slot.contentId);

        return {
          campaign_id: camp.id,
          content_id: slot.contentId,
          music_track_id: formData.music_track_id,
          social_account_id: slot.accountId,
          platform: slot.platform,
          caption: editorialCopy.caption.trim() || null,
          hashtags: mergeArtistHashtags(editorialCopy.hashtags) || null,
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
              version: "v2",
              schedule_mode: formData.schedule_mode,
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

      // A campanha foi lançada com sucesso e não é mais um rascunho
      setDraftCampaignId(null);

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
                <div className="space-y-2">
                  <Label>Artista *</Label>
                  <Select
                    value={formData.artist_id}
                    onValueChange={v =>
                      setFormData(prev => ({
                        ...prev,
                        artist_id: v,
                        music_track_id:
                          musicas.find(m => m.id === prev.music_track_id)?.artist_id === v
                            ? prev.music_track_id
                            : "",
                      }))
                    }
                  >
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue placeholder="Selecione o artista da campanha" />
                    </SelectTrigger>
                    <SelectContent>
                      {artistas.map(artist => (
                        <SelectItem key={artist.id} value={artist.id}>
                          {artist.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {formData.artist_id && (
                    <div className="flex flex-wrap gap-1 pt-1">
                      {artistas
                        .find(a => a.id === formData.artist_id)
                        ?.priority_hashtags?.map(tag => (
                          <Badge key={tag} variant="secondary">
                            #{tag.replace(/^#/, "")}
                          </Badge>
                        ))}
                    </div>
                  )}
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
                <div className="space-y-2">
                  <Label>Modo de agendamento</Label>
                  <Select
                    value={formData.schedule_mode}
                    onValueChange={v =>
                      setFormData(p => ({
                        ...p,
                        schedule_mode: v as "automatic" | "manual" | "hybrid",
                      }))
                    }
                  >
                    <SelectTrigger className="bg-muted/50 border-border">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="automatic">
                        Automático — Flux Post distribui os horários
                      </SelectItem>
                      <SelectItem value="manual">
                        Manual — você define os horários
                      </SelectItem>
                      <SelectItem value="hybrid">
                        Híbrido — Flux Post sugere e você ajusta
                      </SelectItem>
                    </SelectContent>
                  </Select>

                  <p className="text-xs text-muted-foreground">
                    {formData.schedule_mode === "automatic"
                      ? "O Flux Post cria automaticamente a melhor distribuição dentro do período."
                      : formData.schedule_mode === "manual"
                      ? "Você poderá definir manualmente os horários das publicações."
                      : "O Flux Post cria uma agenda inicial e você poderá ajustar os horários antes de lançar."}
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Posts por dia (por conta)</Label>
                    <Select value={String(formData.posts_por_dia)} onValueChange={v => setFormData(p => ({ ...p, posts_por_dia: +v }))}>
                      <SelectTrigger className="bg-muted/50 border-border"><SelectValue /></SelectTrigger>
                      <SelectContent>{[1,2,3,4,5,6].map(n => <SelectItem key={n} value={String(n)}>{n}x/dia</SelectItem>)}</SelectContent>
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
                  {musicas
                      .filter(m => !formData.artist_id || m.artist_id === formData.artist_id)
                      .map(m => (
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
                    onClick={selectAllVideos}>
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
                      <div key={v.id} onClick={() => toggleVideoSelection(v.id)} className={`relative aspect-[9/16] rounded-lg overflow-hidden border-2 cursor-pointer transition-all ${sel ? "border-primary" : "border-transparent hover:border-border"}`}>
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
                          <>
                            <div className="absolute top-1 right-1 w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                              <span className="text-[10px] font-bold text-white">
                                {contentQueue.indexOf(v.id) + 1}
                              </span>
                            </div>

                            <div
                              className="absolute bottom-1 right-1 flex flex-col gap-1"
                              onClick={e => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                disabled={contentQueue.indexOf(v.id) === 0}
                                onClick={() => moveContentInQueue(v.id, "up")}
                                className="w-6 h-6 rounded bg-black/70 text-white text-xs disabled:opacity-30"
                                title="Mover para cima"
                              >
                                ↑
                              </button>

                              <button
                                type="button"
                                disabled={
                                  contentQueue.indexOf(v.id) ===
                                  contentQueue.length - 1
                                }
                                onClick={() => moveContentInQueue(v.id, "down")}
                                className="w-6 h-6 rounded bg-black/70 text-white text-xs disabled:opacity-30"
                                title="Mover para baixo"
                              >
                                ↓
                              </button>
                            </div>
                          </>
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
                  {contentQueue.map((id, idx) => {
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

            {/* STEP 5 — Revisão Editorial */}
            {step === 5 && (
              <div className="space-y-5">
                <div>
                  <div className="flex items-center gap-2">
                    <Sparkles size={18} className="text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Revisão Editorial
                    </h2>
                  </div>

                  <p className="text-sm text-muted-foreground mt-1">
                    Revise o vídeo, a legenda e as hashtags antes de aprovar.
                    A versão aprovada será usada na publicação.
                  </p>

                  <div className="flex flex-wrap gap-2 mt-4">
                    <Button
                      type="button"
                      size="sm"
                      onClick={generateAllEditorialCopies}
                      disabled={isGeneratingAllEditorial || !contentQueue.length}
                      className="gap-2"
                    >
                      {isGeneratingAllEditorial ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <Sparkles size={14} />
                      )}

                      {isGeneratingAllEditorial
                        ? "Gerando todos..."
                        : "Gerar todos com Claude"}
                    </Button>

                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={approveAllEditorial}
                      disabled={isApprovingAllEditorial || !contentQueue.length}
                      className="gap-2"
                    >
                      {isApprovingAllEditorial ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <ThumbsUp size={14} />
                      )}

                      {isApprovingAllEditorial
                        ? "Aprovando..."
                        : "Aprovar todos"}
                    </Button>
                  </div>
                </div>

                <div className="space-y-5">
                  {contentQueue.map((id, idx) => {
                    const video = biblioteca.find(v => v.id === id);

                    const render = renders.find(
                      r =>
                        r.source_content_id === id &&
                        r.music_track_id === formData.music_track_id
                    );

                    if (!render) return null;

                    const copy = getEditorialCopy(id);

                    return (
                      <div
                        key={id}
                        className="rounded-xl border border-border bg-muted/20 overflow-hidden"
                      >
                        {/* Cabeçalho editorial */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">
                              {String(idx + 1).padStart(2, "0")}
                            </div>

                            <div>
                              <p className="text-sm font-semibold text-foreground">
                                {video?.title || `Vídeo ${idx + 1}`}
                              </p>

                              <p className="text-[11px] text-muted-foreground">
                                Posição editorial #{String(idx + 1).padStart(2, "0")}
                              </p>
                            </div>
                          </div>

                          <Badge
                            variant="outline"
                            className={
                              render.is_approved
                                ? "border-emerald-500/30 text-emerald-500"
                                : "border-border text-muted-foreground"
                            }
                          >
                            {render.is_approved ? "Aprovado" : "Aguardando aprovação"}
                          </Badge>
                        </div>

                        <div className="p-4 flex flex-col lg:flex-row gap-5">
                          {/* Preview */}
                          <div className="lg:w-40 flex-shrink-0">
                            <div
                              className="w-full aspect-[9/16] rounded-xl overflow-hidden bg-muted flex items-center justify-center cursor-pointer relative group border border-border"
                              onClick={() =>
                                handlePreview(
                                  render,
                                  video?.title || `Vídeo ${idx + 1}`
                                )
                              }
                            >
                              <Play size={30} className="text-white/70" />

                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Eye size={22} className="text-white" />
                              </div>
                            </div>

                            <div className="mt-3 space-y-1">
                              <p className="text-[11px] text-muted-foreground">
                                Música
                              </p>

                              <p className="text-xs font-medium text-foreground truncate">
                                {selectedMusic?.nome || "Sem música"}
                              </p>

                              {selectedMusic?.artista && (
                                <p className="text-[11px] text-muted-foreground truncate">
                                  {selectedMusic.artista}
                                </p>
                              )}
                            </div>
                          </div>

                          {/* Copy */}
                          <div className="flex-1 min-w-0 space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-semibold">
                                  Legenda
                                </Label>

                                <span className="text-[10px] text-muted-foreground">
                                  {copy.caption.length} caracteres
                                </span>
                              </div>

                              <Textarea
                                value={copy.caption}
                                onChange={e =>
                                  updateEditorialCopy(
                                    id,
                                    "caption",
                                    e.target.value
                                  )
                                }
                                placeholder="A legenda gerada pela Claude aparecerá aqui. Você também pode escrever manualmente."
                                className="min-h-[110px] resize-y"
                              />
                            </div>

                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <Label className="text-xs font-semibold">
                                  Hashtags
                                </Label>

                                {copy.aiStatus === "edited" && (
                                  <Badge
                                    variant="outline"
                                    className="text-[9px] h-5"
                                  >
                                    Editado manualmente
                                  </Badge>
                                )}
                              </div>

                              <Textarea
                                value={copy.hashtags}
                                onChange={e =>
                                  updateEditorialCopy(
                                    id,
                                    "hashtags",
                                    e.target.value
                                  )
                                }
                                placeholder="#musica #artista #reels"
                                className="min-h-[70px] resize-y"
                              />
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={copy.aiStatus === "generating"}
                                onClick={() =>
                                  generateEditorialCopy(video.id, video.title)
                                }
                                className="gap-2 h-8 text-xs"
                              >
                                {copy.aiStatus === "generating" ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <Sparkles size={13} />
                                )}
                                {copy.aiStatus === "generating"
                                  ? "Gerando..."
                                  : copy.aiStatus === "generated" ||
                                    copy.aiStatus === "edited"
                                  ? "Gerar outra versão"
                                  : "Gerar com Claude"}
                              </Button>

                              <Button
                                size="sm"
                                onClick={() =>
                                  handleToggleApprove(
                                    render.id,
                                    !!render.is_approved
                                  )
                                }
                                className={`gap-1 h-8 text-xs ${
                                  render.is_approved
                                    ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/30"
                                    : ""
                                }`}
                              >
                                <ThumbsUp size={12} />
                                {render.is_approved
                                  ? "Conteúdo aprovado"
                                  : "Aprovar conteúdo"}
                              </Button>

                              {render.is_approved && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    handleToggleApprove(render.id, true)
                                  }
                                  className="gap-1 h-8 text-xs border-border text-muted-foreground"
                                >
                                  <ThumbsDown size={12} />
                                  Rejeitar
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="text-sm text-muted-foreground text-center">
                  {approvedRenders.length} de {selVideos.size} conteúdo
                  {selVideos.size !== 1 ? "s" : ""} aprovado
                  {approvedRenders.length !== 1 ? "s" : ""}
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
                    { label: "Dias", value: Math.max(1, Math.round((new Date(formData.data_fim).getTime() - new Date(formData.data_inicio).getTime()) / 86400000) + 1) },
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
                      onClick={() => {
                        setSelAccounts(
                          selAccounts.size === socialAccounts.length
                            ? new Set()
                            : new Set(socialAccounts.map(a => a.id))
                        );
                        setSchedulePreview([]);
                      }}>
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
                        setSchedulePreview([]);
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

                {/* Schedule Preview V2 */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <Clock size={17} className="text-primary" />
                        <h2 className="text-base font-semibold text-foreground">
                          Agenda da Campanha
                        </h2>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formData.schedule_mode === "automatic"
                          ? "Horários distribuídos automaticamente pelo Flux Post."
                          : formData.schedule_mode === "hybrid"
                          ? "Agenda sugerida pelo Flux Post. Você poderá ajustar os horários."
                          : "Agenda manual da campanha."}
                      </p>
                    </div>

                    <Badge variant="outline">
                      {schedulePreview.length} publicações
                    </Badge>
                  </div>

                  {schedulePreview.length === 0 ? (
                    <div className="border border-dashed border-border rounded-xl p-6 text-center">
                      <Clock
                        size={24}
                        className="mx-auto text-muted-foreground mb-2"
                      />
                      <p className="text-sm text-muted-foreground">
                        Nenhum horário gerado.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-border rounded-xl overflow-hidden">
                      <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
                        {schedulePreview.map((slot, index) => {
                          const account = socialAccounts.find(
                            item => item.id === slot.accountId
                          );

                          const video = biblioteca.find(
                            item => item.id === slot.contentId
                          );

                          const scheduledDate = new Date(
                            slot.scheduledFor
                          );

                          return (
                            <div
                              key={`${slot.accountId}-${slot.contentId}-${slot.scheduledFor}-${index}`}
                              className="grid grid-cols-[190px_1fr_1fr_90px] gap-3 items-center p-3 bg-muted/20"
                            >
                              <div>
                                {formData.schedule_mode === "automatic" ? (
                                  <>
                                    <p className="text-sm font-medium text-foreground">
                                      {scheduledDate.toLocaleDateString(
                                        "pt-BR",
                                        {
                                          day: "2-digit",
                                          month: "2-digit",
                                          timeZone: "America/Sao_Paulo",
                                        }
                                      )}
                                    </p>
                                    <p className="text-xs text-primary font-medium">
                                      {scheduledDate.toLocaleTimeString(
                                        "pt-BR",
                                        {
                                          hour: "2-digit",
                                          minute: "2-digit",
                                          timeZone: "America/Sao_Paulo",
                                        }
                                      )}
                                    </p>
                                  </>
                                ) : (
                                  <div className="space-y-1">
                                    <Input
                                      type="datetime-local"
                                      value={schedulePreviewInputValue(
                                        slot.scheduledFor
                                      )}
                                      onChange={event =>
                                        updateSchedulePreviewDateTime(
                                          index,
                                          event.target.value
                                        )
                                      }
                                      min={`${formData.data_inicio}T${formData.hora_inicio}`}
                                      max={`${formData.data_fim}T${formData.hora_fim}`}
                                      className="h-8 text-xs"
                                    />

                                    {slot.manuallyEdited && (
                                      <p className="text-[10px] text-primary">
                                        Horário ajustado
                                      </p>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  Conta
                                </p>
                                <p className="text-sm text-foreground truncate">
                                  {account?.account_name || "Conta"}
                                  {account?.username
                                    ? ` — @${account.username.replace(/^@/, "")}`
                                    : ""}
                                </p>
                              </div>

                              <div className="min-w-0">
                                <p className="text-xs text-muted-foreground">
                                  Vídeo
                                </p>
                                <p className="text-sm text-foreground truncate">
                                  {video?.title || slot.contentId}
                                </p>
                              </div>

                              <div className="text-right">
                                <Badge
                                  variant="outline"
                                  className="capitalize text-[10px]"
                                >
                                  {slot.platform}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
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
          <div className="flex items-center gap-3">
            {stepBlockMessage() && (
              <span className="text-xs text-muted-foreground">{stepBlockMessage()}</span>
            )}

            <Button
              type="button"
              variant="outline"
              className="gap-2 border-primary/30 text-primary"
              disabled={saving || !formData.nome.trim()}
              onClick={async () => {
                setSaving(true);
                try {
                  await saveDraft(true);
                } catch (e: any) {
                  console.error("Erro ao salvar rascunho:", e);
                  toast.error("Erro ao salvar rascunho: " + e.message);
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? "Salvando..." : draftCampaignId ? "Salvar alterações" : "Salvar rascunho"}
            </Button>
          </div>
          {step < 6 && (
            <Button className="gap-2 bg-primary hover:bg-primary/90 text-white" onClick={handleContinueStep} disabled={!canAdvance()}>
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
