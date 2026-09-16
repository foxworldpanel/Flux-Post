import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Captions,
  Check,
  CheckCircle2,
  Copy,
  FolderOpen,
  Loader2,
  Mic2,
  RefreshCw,
  Search,
  Save,
  Sparkles,
  Upload,
  Video,
  Volume2,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface MotivationalScript {
  id?: string;
  title: string;
  hook: string;
  narration: string;
  closing: string;
  visualKeywords: string[];
  estimatedSeconds: number;
  status: "draft" | "approved" | "rejected" | "voiced" | "rendered";
  contentId?: string | null;
  musicTrackId?: string | null;
  mediaRenderId?: string | null;
  musicVolume?: number;
  subtitlesEnabled?: boolean;
}

interface LibraryVideo {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  source: string | null;
}

interface MusicTrack {
  id: string;
  nome: string;
  artista: string | null;
  estilo: string | null;
}

interface SavedProject {
  id: string;
  name: string;
  theme: string;
  tone: string;
  audience: string;
  duration_seconds: number;
  include_cta: boolean;
  status: string;
  created_at: string;
}

interface ElevenLabsVoice {
  id: string;
  name: string;
  category: string;
  description: string;
  previewUrl: string | null;
  labels: Record<string, string>;
}

export default function StudioIaPage() {
  const navigate = useNavigate();
  const autoOpenedProject = useRef(false);
  const [theme, setTheme] = useState("recomeço, coragem e confiança");
  const [projectName, setProjectName] = useState("Lote motivacional Sourcee");
  const [tone, setTone] = useState("emocional e acolhedor");
  const [audience, setAudience] = useState("adultos buscando motivação diária");
  const [duration, setDuration] = useState("30");
  const [quantity, setQuantity] = useState("3");
  const [includeCta, setIncludeCta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scripts, setScripts] = useState<MotivationalScript[]>([]);
  const [savedProjectId, setSavedProjectId] = useState<string | null>(null);
  const [recentProjects, setRecentProjects] = useState<SavedProject[]>([]);
  const [loadingProjectId, setLoadingProjectId] = useState<string | null>(null);
  const [voices, setVoices] = useState<ElevenLabsVoice[]>([]);
  const [selectedVoiceId, setSelectedVoiceId] = useState("");
  const [loadingVoices, setLoadingVoices] = useState(false);
  const [voiceConfigError, setVoiceConfigError] = useState<string | null>(null);
  const [generatingScriptId, setGeneratingScriptId] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<Record<string, string>>({});
  const [videoChoices, setVideoChoices] = useState<LibraryVideo[]>([]);
  const [musicChoices, setMusicChoices] = useState<MusicTrack[]>([]);
  const [activeScriptId, setActiveScriptId] = useState("");
  const [selectedVideoId, setSelectedVideoId] = useState("");
  const [selectedMusicId, setSelectedMusicId] = useState("");
  const [musicVolume, setMusicVolume] = useState(18);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [renderingScriptId, setRenderingScriptId] = useState<string | null>(null);
  const [renderStatus, setRenderStatus] = useState<Record<string, string>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string>>({});
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const totalMinutes = useMemo(
    () => Math.ceil((Number(duration) * Number(quantity)) / 60),
    [duration, quantity],
  );

  const approvedCount = scripts.filter(script => ["approved", "voiced", "rendered"].includes(script.status)).length;

  const productionScripts = scripts.filter(
    script => script.id && ["approved", "voiced", "rendered"].includes(script.status),
  );
  const activeScript = productionScripts.find(script => script.id === activeScriptId) || productionScripts[0];

  const fetchProductionChoices = async () => {
    const [videosResult, musicResult] = await Promise.all([
      (supabase as any)
        .from("content_library")
        .select("id,title,thumbnail_url,duration_seconds,source")
        .not("storage_path", "is", null)
        .order("created_at", { ascending: false })
        .limit(100),
      (supabase as any)
        .from("music_tracks")
        .select("id,nome,artista,estilo")
        .not("storage_path", "is", null)
        .order("criado_em", { ascending: false })
        .limit(100),
    ]);
    if (!videosResult.error) setVideoChoices(videosResult.data || []);
    if (!musicResult.error) setMusicChoices(musicResult.data || []);
  };

  const fetchRecentProjects = async () => {
    const { data, error } = await (supabase as any)
      .from("ai_studio_projects")
      .select("id,name,theme,tone,audience,duration_seconds,include_cta,status,created_at")
      .order("created_at", { ascending: false })
      .limit(6);

    if (!error) setRecentProjects(data || []);
  };

  useEffect(() => {
    fetchRecentProjects();
    fetchProductionChoices();
  }, []);

  useEffect(() => {
    if (autoOpenedProject.current || !recentProjects.length || savedProjectId || scripts.length) return;
    autoOpenedProject.current = true;
    void loadProject(recentProjects[0], true);
  }, [recentProjects]);

  useEffect(() => {
    if (!activeScript) return;
    setActiveScriptId(activeScript.id || "");
    setSelectedVideoId(activeScript.contentId || "");
    setSelectedMusicId(activeScript.musicTrackId || "");
    setMusicVolume(activeScript.musicVolume ?? 18);
    setSubtitlesEnabled(activeScript.subtitlesEnabled ?? true);
  }, [activeScript?.id]);

  const edgeFunctionMessage = async (error: any, fallback: string) => {
    try {
      const payload = await error?.context?.json?.();
      return payload?.error || fallback;
    } catch {
      return error?.message || fallback;
    }
  };

  const fetchVoices = async () => {
    try {
      setLoadingVoices(true);
      setVoiceConfigError(null);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Entre novamente.");

      const { data, error } = await supabase.functions.invoke("ai-studio-voice", {
        body: { action: "list_voices" },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        throw new Error(
          await edgeFunctionMessage(error, "Não foi possível carregar as vozes."),
        );
      }
      if (!data?.success || !Array.isArray(data.voices)) {
        throw new Error(data?.error || "Nenhuma voz foi encontrada.");
      }

      setVoices(data.voices);
      setSelectedVoiceId(current => current || data.voices[0]?.id || "");
    } catch (error: any) {
      setVoiceConfigError(error?.message || "ElevenLabs não configurado.");
    } finally {
      setLoadingVoices(false);
    }
  };

  useEffect(() => {
    if (savedProjectId && scripts.some(script => ["approved", "voiced", "rendered"].includes(script.status)) && !voices.length) {
      fetchVoices();
    }
  }, [savedProjectId, scripts.length]);

  const requestNarration = async (script: MotivationalScript) => {
    if (!script.id) {
      toast.error("Salve e reabra o projeto antes de gerar a narração.");
      return;
    }

    const getExisting = script.status === "voiced" || script.status === "rendered";
    const selectedVoice = voices.find(voice => voice.id === selectedVoiceId);
    if (!getExisting && !selectedVoiceId) {
      toast.error("Selecione uma voz do ElevenLabs.");
      return;
    }

    try {
      setGeneratingScriptId(script.id);
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada. Entre novamente.");

      const { data, error } = await supabase.functions.invoke("ai-studio-voice", {
        body: getExisting
          ? { action: "get_audio", scriptId: script.id }
          : {
              action: "generate",
              scriptId: script.id,
              voiceId: selectedVoiceId,
              voiceName: selectedVoice?.name || "",
            },
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (error) {
        throw new Error(
          await edgeFunctionMessage(error, "Não foi possível gerar a narração."),
        );
      }
      if (!data?.success || !data.audioUrl) {
        throw new Error(data?.error || "A narração não retornou um áudio válido.");
      }

      setAudioUrls(current => ({ ...current, [script.id!]: data.audioUrl }));
      setScripts(current =>
        current.map(item =>
          item.id === script.id ? { ...item, status: "voiced" } : item,
        ),
      );
      setActiveScriptId(script.id);
      toast.success(data.reused ? "Narração recuperada." : "Narração gerada e salva.");
    } catch (error: any) {
      toast.error(error?.message || "Erro na geração da narração.");
    } finally {
      setGeneratingScriptId(null);
    }
  };

  const setScriptStatus = (
    index: number,
    status: MotivationalScript["status"],
  ) => {
    if (savedProjectId) {
      toast.info("Projeto já salvo. Abra um novo lote para alterar a revisão.");
      return;
    }

    setScripts(current =>
      current.map((script, scriptIndex) =>
        scriptIndex === index ? { ...script, status } : script,
      ),
    );
  };

  const saveProject = async () => {
    if (!scripts.length) return;
    if (savedProjectId) {
      toast.info("Este projeto já está salvo.");
      return;
    }

    try {
      setSaving(true);
      const { data, error } = await (supabase.rpc as any)(
        "save_ai_studio_project",
        {
          p_project: {
            name: projectName.trim() || "Lote motivacional Sourcee",
            theme: theme.trim(),
            tone,
            audience: audience.trim(),
            durationSeconds: Number(duration),
            includeCta,
          },
          p_scripts: scripts,
        },
      );

      if (error) throw error;
      if (!data?.projectId) throw new Error("O projeto não retornou um identificador.");

      const savedProject: SavedProject = {
        id: data.projectId,
        name: projectName.trim() || "Lote motivacional Sourcee",
        theme: theme.trim(),
        tone,
        audience: audience.trim(),
        duration_seconds: Number(duration),
        include_cta: includeCta,
        status: "review",
        created_at: new Date().toISOString(),
      };

      await fetchRecentProjects();
      await loadProject(savedProject);
      toast.success(
        `Projeto salvo com ${approvedCount} ${approvedCount === 1 ? "roteiro aprovado" : "roteiros aprovados"}.`,
      );
    } catch (error: any) {
      console.error("[Studio IA] Save project failed", error);
      toast.error(error?.message || "Não foi possível salvar o projeto.");
    } finally {
      setSaving(false);
    }
  };

  const loadRender = async (scriptId: string, renderId: string) => {
    const { data, error } = await (supabase as any)
      .from("media_renders")
      .select("id,status,storage_path,error_message")
      .eq("id", renderId)
      .maybeSingle();
    if (error || !data) return null;

    setRenderStatus(current => ({ ...current, [scriptId]: data.status }));
    if (data.status === "ready" && data.storage_path) {
      const { data: signed } = await supabase.storage
        .from("rendered")
        .createSignedUrl(data.storage_path, 3600);
      if (signed?.signedUrl) {
        setPreviewUrls(current => ({ ...current, [scriptId]: signed.signedUrl }));
      }
    }
    return data;
  };

  const pollRender = async (scriptId: string, renderId: string) => {
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const render = await loadRender(scriptId, renderId);
      if (render?.status === "ready") {
        setScripts(current =>
          current.map(item =>
            item.id === scriptId
              ? { ...item, status: "rendered", mediaRenderId: renderId }
              : item,
          ),
        );
        toast.success("Vídeo finalizado. O preview está pronto.");
        return;
      }
      if (render?.status === "failed") {
        throw new Error(render.error_message || "O renderizador não conseguiu montar o vídeo.");
      }
      await new Promise(resolve => window.setTimeout(resolve, 3000));
    }
    throw new Error("O vídeo continua na fila. Você pode voltar ao projeto mais tarde.");
  };

  const startRender = async () => {
    if (!activeScript?.id) return;
    if (activeScript.status === "approved") {
      toast.error("Gere a narração antes de montar o vídeo.");
      return;
    }
    if (!selectedVideoId) {
      toast.error("Escolha um vídeo da Biblioteca.");
      return;
    }
    if (!selectedMusicId) {
      toast.error("Escolha a música de fundo.");
      return;
    }

    try {
      setRenderingScriptId(activeScript.id);
      const { data, error } = await (supabase.rpc as any)("start_ai_studio_render", {
        p_script_id: activeScript.id,
        p_content_id: selectedVideoId,
        p_music_track_id: selectedMusicId,
        p_music_volume: musicVolume,
        p_subtitles_enabled: subtitlesEnabled,
      });
      if (error) throw error;
      if (!data?.renderId) throw new Error("O render não retornou um identificador.");

      setScripts(current =>
        current.map(item =>
          item.id === activeScript.id
            ? {
                ...item,
                contentId: selectedVideoId,
                musicTrackId: selectedMusicId,
                musicVolume,
                subtitlesEnabled,
                mediaRenderId: data.renderId,
              }
            : item,
        ),
      );
      setRenderStatus(current => ({ ...current, [activeScript.id!]: data.status || "queued" }));
      toast.info(data.reused ? "Abrindo vídeo já produzido." : "Vídeo enviado para produção.");
      await pollRender(activeScript.id, data.renderId);
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível gerar o vídeo.");
    } finally {
      setRenderingScriptId(null);
    }
  };

  const loadProject = async (project: SavedProject, silent = false) => {
    try {
      setLoadingProjectId(project.id);
      const { data, error } = await (supabase as any)
        .from("ai_studio_scripts")
        .select(
          "id,title,hook,narration,closing,visual_keywords,estimated_seconds,status,position,content_id,music_track_id,media_render_id,music_volume,subtitles_enabled",
        )
        .eq("project_id", project.id)
        .order("position", { ascending: true });

      if (error) throw error;

      setProjectName(project.name);
      setTheme(project.theme);
      setTone(project.tone);
      setAudience(project.audience);
      setDuration(String(project.duration_seconds));
      setIncludeCta(project.include_cta);
      setQuantity(String(data?.length || 1));
      setScripts(
        (data || []).map((script: any) => ({
          id: script.id,
          title: script.title,
          hook: script.hook || "",
          narration: script.narration,
          closing: script.closing || "",
          visualKeywords: script.visual_keywords || [],
          estimatedSeconds: script.estimated_seconds,
          status: script.status,
          contentId: script.content_id,
          musicTrackId: script.music_track_id,
          mediaRenderId: script.media_render_id,
          musicVolume: script.music_volume,
          subtitlesEnabled: script.subtitles_enabled,
        })),
      );
      setSavedProjectId(project.id);
      const firstProductionScript = (data || []).find((script: any) =>
        ["approved", "voiced", "rendered"].includes(script.status),
      );
      if (firstProductionScript) {
        setActiveScriptId(firstProductionScript.id);
        setSelectedVideoId(firstProductionScript.content_id || "");
        setSelectedMusicId(firstProductionScript.music_track_id || "");
        setMusicVolume(firstProductionScript.music_volume ?? 18);
        setSubtitlesEnabled(firstProductionScript.subtitles_enabled ?? true);
        if (firstProductionScript.media_render_id) {
          void loadRender(firstProductionScript.id, firstProductionScript.media_render_id);
        }
      }
      if (!silent) toast.success("Projeto carregado.");
    } catch (error: any) {
      toast.error(error?.message || "Não foi possível abrir o projeto.");
    } finally {
      setLoadingProjectId(null);
    }
  };

  const startNewProject = () => {
    setScripts([]);
    setSavedProjectId(null);
    setProjectName("Lote motivacional Sourcee");
    setAudioUrls({});
    setActiveScriptId("");
    setSelectedVideoId("");
    setSelectedMusicId("");
    setPreviewUrls({});
    setRenderStatus({});
  };

  const generateScripts = async () => {
    if (!theme.trim()) {
      toast.error("Informe o tema das mensagens.");
      return;
    }

    try {
      setLoading(true);
      setScripts([]);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Sessão expirada. Entre novamente.");

      const { data, error } = await supabase.functions.invoke(
        "campaign-copy-generator",
        {
          body: {
            action: "motivational_scripts",
            motivational: {
              theme: theme.trim(),
              tone,
              audience: audience.trim(),
              durationSeconds: Number(duration),
              quantity: Number(quantity),
              includeCta,
            },
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (error) throw error;
      if (!data?.success || !Array.isArray(data.scripts)) {
        throw new Error(data?.error || "A IA não retornou roteiros válidos.");
      }

      setSavedProjectId(null);
      setScripts(
        data.scripts.map((script: Omit<MotivationalScript, "status">) => ({
          ...script,
          status: "draft" as const,
        })),
      );
      toast.success(`${data.scripts.length} roteiros criados para revisão.`);
    } catch (error: any) {
      console.error("[Studio IA] Motivational generation failed", error);
      toast.error(error?.message || "Não foi possível gerar os roteiros.");
    } finally {
      setLoading(false);
    }
  };

  const copyScript = async (script: MotivationalScript, index: number) => {
    await navigator.clipboard.writeText(script.narration);
    setCopiedIndex(index);
    toast.success("Roteiro copiado.");
    window.setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 pb-14 pt-6 sm:px-6 sm:pt-8 lg:px-10 xl:px-12">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="eyebrow">Workspace Sourcee</p>
              <Badge className="border-violet-500/20 bg-violet-500/10 text-violet-400">
                Produção inteligente
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Studio IA
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Do texto ao vídeo final: roteiro, voz ElevenLabs, cena, música e
              legendas sincronizadas dentro do mesmo projeto.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/garimpo")}>
              <Search size={16} />
              Pexels
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/biblioteca")}>
              <Upload size={16} />
              Biblioteca
            </Button>
          </div>
        </header>

        <section className="grid gap-2 rounded-2xl border border-border bg-card p-3 sm:grid-cols-5">
          {[
            { label: "1. Roteiro", icon: Sparkles, done: scripts.length > 0 },
            { label: "2. Aprovação", icon: CheckCircle2, done: approvedCount > 0 },
            { label: "3. Narração", icon: Volume2, done: scripts.some(item => ["voiced", "rendered"].includes(item.status)) },
            { label: "4. Mídia e trilha", icon: Video, done: Boolean(selectedVideoId && selectedMusicId) },
            { label: "5. Vídeo final", icon: Wand2, done: scripts.some(item => item.status === "rendered") },
          ].map(item => (
            <div
              key={item.label}
              className={`flex items-center gap-2 rounded-xl px-3 py-3 text-sm font-semibold ${
                item.done ? "bg-emerald-500/10 text-emerald-400" : "bg-muted/40 text-muted-foreground"
              }`}
            >
              <item.icon size={16} />
              {item.label}
            </div>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="overflow-hidden border-border bg-card">
            <div className="border-b border-border bg-muted/20 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                  <Sparkles size={19} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Criar lote de roteiros</h2>
                  <p className="text-sm text-muted-foreground">
                    Revise os textos antes de gerar voz ou vídeo.
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <Label htmlFor="project-name">Nome do projeto</Label>
                <Input
                  id="project-name"
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Ex.: Motivação Sourcee — Semana 1"
                  disabled={Boolean(savedProjectId)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="theme">Tema central</Label>
                <Textarea
                  id="theme"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  placeholder="Ex.: superar um momento difícil e voltar a acreditar em si"
                  className="min-h-24 resize-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tom da mensagem</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emocional e acolhedor">Emocional e acolhedor</SelectItem>
                      <SelectItem value="forte e transformador">Forte e transformador</SelectItem>
                      <SelectItem value="calmo e reflexivo">Calmo e reflexivo</SelectItem>
                      <SelectItem value="direto e energético">Direto e energético</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audience">Público</Label>
                  <Input
                    id="audience"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duração por vídeo</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 segundos</SelectItem>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="40">40 segundos</SelectItem>
                      <SelectItem value="60">60 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 3, 5, 8, 10].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value} {value === 1 ? "roteiro" : "roteiros"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/25 p-4">
                <div>
                  <p className="text-sm font-semibold">Chamada final</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Inclui um convite natural para acompanhar novos conteúdos.
                  </p>
                </div>
                <Switch checked={includeCta} onCheckedChange={setIncludeCta} />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{quantity} criações independentes</span>
                <span>≈ {totalMinutes} min de conteúdo</span>
              </div>

              <Button
                className="h-12 w-full gap-2 bg-violet-600 text-white hover:bg-violet-500"
                disabled={loading}
                onClick={generateScripts}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {loading ? "Criando roteiros..." : "Gerar roteiros com IA"}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow mb-2">Revisão editorial</p>
                <h2 className="font-display text-2xl font-bold">Roteiros gerados</h2>
              </div>
              {scripts.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="outline">{approvedCount}/{scripts.length} aprovados</Badge>
                  {savedProjectId ? (
                    <>
                      <Badge className="bg-emerald-500/10 text-emerald-400">Salvo</Badge>
                      <Button size="sm" variant="outline" onClick={startNewProject}>
                        Novo lote
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="sm"
                      className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
                      disabled={saving}
                      onClick={saveProject}
                    >
                      {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                      Salvar projeto
                    </Button>
                  )}
                </div>
              )}
            </div>

            {savedProjectId && scripts.some(script => ["approved", "voiced", "rendered"].includes(script.status)) && (
              <Card className="border-violet-500/20 bg-violet-500/5">
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Label>Voz do ElevenLabs</Label>
                      <Select
                        value={selectedVoiceId}
                        onValueChange={setSelectedVoiceId}
                        disabled={loadingVoices || voices.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={loadingVoices ? "Carregando vozes..." : "Selecione uma voz"}
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {voices.map(voice => (
                            <SelectItem key={voice.id} value={voice.id}>
                              {voice.name} · {voice.labels?.accent || voice.labels?.language || voice.category}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={loadingVoices}
                      onClick={fetchVoices}
                    >
                      <RefreshCw size={15} className={loadingVoices ? "animate-spin" : ""} />
                      Atualizar vozes
                    </Button>
                  </div>

                  {voiceConfigError && (
                    <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
                      {voiceConfigError}
                    </p>
                  )}

                  {voices.find(voice => voice.id === selectedVoiceId)?.previewUrl && (
                    <audio
                      className="mt-3 h-9 w-full"
                      controls
                      preload="none"
                      src={voices.find(voice => voice.id === selectedVoiceId)?.previewUrl || undefined}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {scripts.length === 0 ? (
              <Card className="border-dashed bg-card/50">
                <CardContent className="flex min-h-[410px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Mic2 size={26} />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold">Nenhum roteiro gerado</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Configure o primeiro lote. Os textos aparecerão aqui para revisão antes das etapas pagas de voz e renderização.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {scripts.map((script, index) => (
                  <Card key={`${script.title}-${index}`} className="bg-card">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-400">
                              {index + 1}
                            </span>
                            <h3 className="truncate font-display font-bold">{script.title}</h3>
                            <Badge variant="outline" className="text-[10px]">
                              ~{script.estimatedSeconds}s
                            </Badge>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => copyScript(script, index)}
                            aria-label="Copiar roteiro"
                          >
                            {copiedIndex === index ? <Check size={16} /> : <Copy size={16} />}
                          </Button>
                        </div>
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                        {script.narration}
                      </p>

                      {script.visualKeywords.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                          {script.visualKeywords.map((keyword) => (
                            <Badge key={keyword} variant="secondary" className="font-normal">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}

                      <div className="mt-4 flex items-center justify-between gap-3 border-t border-border pt-4">
                        <Badge
                          variant="outline"
                          className={
                            script.status === "voiced" || script.status === "rendered"
                              ? "border-violet-500/20 bg-violet-500/10 text-violet-300"
                              : script.status === "approved"
                              ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400"
                              : script.status === "rejected"
                              ? "border-red-500/20 bg-red-500/10 text-red-400"
                              : "text-muted-foreground"
                          }
                        >
                          {script.status === "voiced" || script.status === "rendered"
                            ? "Narração pronta"
                            : script.status === "approved"
                            ? "Aprovado"
                            : script.status === "rejected"
                            ? "Descartado"
                            : "Aguardando revisão"}
                        </Badge>

                        {!savedProjectId && (
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                              onClick={() => setScriptStatus(index, "rejected")}
                            >
                              <X size={14} />
                              Descartar
                            </Button>
                            <Button
                              size="sm"
                              className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-500"
                              onClick={() => setScriptStatus(index, "approved")}
                            >
                              <Check size={14} />
                              Aprovar
                            </Button>
                          </div>
                        )}

                        {savedProjectId &&
                          ["approved", "voiced", "rendered"].includes(script.status) && (
                            <Button
                              size="sm"
                              className="gap-2 bg-violet-600 text-white hover:bg-violet-500"
                              disabled={generatingScriptId === script.id}
                              onClick={() => requestNarration(script)}
                            >
                              {generatingScriptId === script.id ? (
                                <Loader2 size={14} className="animate-spin" />
                              ) : (
                                <Volume2 size={14} />
                              )}
                              {script.status === "voiced" || script.status === "rendered"
                                ? "Ouvir narração"
                                : "Gerar narração"}
                            </Button>
                          )}
                      </div>

                      {script.id && audioUrls[script.id] && (
                        <audio
                          className="mt-4 h-10 w-full"
                          controls
                          preload="metadata"
                          src={audioUrls[script.id]}
                        />
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        {savedProjectId && productionScripts.length > 0 && (
          <section className="space-y-4">
            <div>
              <p className="eyebrow mb-2">Montagem conectada</p>
              <h2 className="font-display text-2xl font-bold">Produzir vídeo</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Finalize um roteiro por vez. As escolhas ficam salvas no projeto.
              </p>
            </div>

            <Card className="overflow-hidden border-violet-500/20 bg-card">
              <div className="grid border-b border-border bg-muted/20 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                <div className="p-5 sm:p-6">
                  <Label>Roteiro em produção</Label>
                  <Select value={activeScript?.id || ""} onValueChange={setActiveScriptId}>
                    <SelectTrigger className="mt-2 max-w-xl">
                      <SelectValue placeholder="Selecione o roteiro" />
                    </SelectTrigger>
                    <SelectContent>
                      {productionScripts.map((script, index) => (
                        <SelectItem key={script.id} value={script.id!}>
                          {index + 1}. {script.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2 px-5 pb-5 lg:px-6 lg:pb-0">
                  <Badge variant="outline">
                    {activeScript?.status === "rendered"
                      ? "Vídeo pronto"
                      : activeScript?.status === "voiced"
                      ? "Narração pronta"
                      : "Aguardando narração"}
                  </Badge>
                </div>
              </div>

              <CardContent className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.72fr)]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2 font-semibold">
                      <Volume2 size={17} className="text-violet-400" />
                      Voz ElevenLabs
                    </div>
                    <p className="text-sm leading-6 text-muted-foreground">
                      {activeScript?.narration}
                    </p>
                    {activeScript?.id && audioUrls[activeScript.id] ? (
                      <audio className="mt-4 h-10 w-full" controls src={audioUrls[activeScript.id]} />
                    ) : (
                      <Button
                        className="mt-4 gap-2 bg-violet-600 text-white hover:bg-violet-500"
                        disabled={!activeScript || generatingScriptId === activeScript.id}
                        onClick={() => activeScript && requestNarration(activeScript)}
                      >
                        {generatingScriptId === activeScript?.id ? (
                          <Loader2 size={15} className="animate-spin" />
                        ) : (
                          <Volume2 size={15} />
                        )}
                        {activeScript?.status === "approved" ? "Gerar narração" : "Carregar narração"}
                      </Button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Vídeo da Biblioteca</Label>
                      <Select value={selectedVideoId} onValueChange={setSelectedVideoId}>
                        <SelectTrigger><SelectValue placeholder="Escolha a cena" /></SelectTrigger>
                        <SelectContent>
                          {videoChoices.map(video => (
                            <SelectItem key={video.id} value={video.id}>
                              {video.title} {video.duration_seconds ? `· ${Math.round(video.duration_seconds)}s` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Música de fundo</Label>
                      <Select value={selectedMusicId} onValueChange={setSelectedMusicId}>
                        <SelectTrigger><SelectValue placeholder="Escolha a música" /></SelectTrigger>
                        <SelectContent>
                          {musicChoices.map(music => (
                            <SelectItem key={music.id} value={music.id}>
                              {music.nome}{music.artista ? ` · ${music.artista}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-5 rounded-2xl border border-border p-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
                    <div>
                      <div className="mb-3 flex items-center justify-between text-sm">
                        <Label>Volume da música</Label>
                        <span className="font-semibold text-violet-400">{musicVolume}%</span>
                      </div>
                      <Slider
                        min={0}
                        max={40}
                        step={1}
                        value={[musicVolume]}
                        onValueChange={value => setMusicVolume(value[0])}
                      />
                      <p className="mt-2 text-xs text-muted-foreground">
                        A narração permanece em primeiro plano.
                      </p>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-muted/40 px-4 py-3">
                      <Captions size={18} className="text-violet-400" />
                      <div>
                        <p className="text-sm font-semibold">Legendas sincronizadas</p>
                        <p className="text-xs text-muted-foreground">Timing do ElevenLabs</p>
                      </div>
                      <Switch checked={subtitlesEnabled} onCheckedChange={setSubtitlesEnabled} />
                    </div>
                  </div>

                  <Button
                    className="h-12 w-full gap-2 bg-violet-600 text-white hover:bg-violet-500"
                    disabled={renderingScriptId === activeScript?.id || activeScript?.status === "approved"}
                    onClick={startRender}
                  >
                    {renderingScriptId === activeScript?.id ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Wand2 size={18} />
                    )}
                    {renderingScriptId === activeScript?.id
                      ? `Produzindo vídeo · ${renderStatus[activeScript?.id || ""] || "fila"}`
                      : activeScript?.status === "rendered"
                      ? "Gerar nova versão"
                      : "Gerar vídeo completo"}
                  </Button>
                </div>

                <div className="flex min-h-[420px] items-center justify-center rounded-2xl border border-border bg-black/80 p-3">
                  {activeScript?.id && previewUrls[activeScript.id] ? (
                    <video
                      className="max-h-[620px] w-full rounded-xl object-contain"
                      controls
                      playsInline
                      src={previewUrls[activeScript.id]}
                    />
                  ) : selectedVideoId ? (
                    <div className="max-w-xs text-center">
                      <Wand2 className="mx-auto text-violet-400" size={34} />
                      <p className="mt-4 font-display text-lg font-bold">Preview final</p>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Gere o vídeo para conferir voz, música e legendas juntas.
                      </p>
                    </div>
                  ) : (
                    <div className="max-w-xs text-center text-muted-foreground">
                      <Video className="mx-auto" size={34} />
                      <p className="mt-4 text-sm">Escolha um vídeo para iniciar a montagem.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </section>
        )}

        <section>
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow mb-2">Produções salvas</p>
              <h2 className="font-display text-2xl font-bold">Projetos recentes</h2>
            </div>
            <Badge variant="outline">{recentProjects.length} recentes</Badge>
          </div>

          {recentProjects.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card/40 px-6 py-8 text-center text-sm text-muted-foreground">
              Os projetos salvos aparecerão aqui e poderão ser reabertos para as próximas etapas.
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recentProjects.map(project => (
                <button
                  key={project.id}
                  type="button"
                  onClick={() => loadProject(project)}
                  className="group flex items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:bg-accent"
                >
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
                    {loadingProjectId === project.id ? (
                      <Loader2 size={19} className="animate-spin" />
                    ) : (
                      <FolderOpen size={19} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display font-bold">{project.name}</p>
                    <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                      {project.theme}
                    </p>
                    <p className="mt-2 text-[11px] text-muted-foreground">
                      {project.duration_seconds}s · {new Date(project.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <ArrowRight size={16} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-violet-400" />
                </button>
              ))}
            </div>
          )}
        </section>

      </div>
    </DashboardLayout>
  );
}
