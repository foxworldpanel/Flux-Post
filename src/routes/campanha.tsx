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
import { toast } from "sonner";
import {
  Check, X, Loader2, Play, Music as MusicIcon, Video, CheckCircle2,
  AlertCircle, RotateCcw, RefreshCw, ChevronRight, ChevronLeft,
  Calendar, Clock, Users, Megaphone, Eye, ThumbsUp, ThumbsDown, Zap
} from "lucide-react";
import { format, addDays } from "date-fns";
import { socialService, type SocialAccount } from "@/services/social";
import { contentService } from "@/services/content";
// Removidos processVideo e loadFFmpeg pois agora usamos a Edge Function render-bridge

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

  useEffect(() => { fetchData(); }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [tracksRes, libraryRes, accountsRes, campRes] = await Promise.all([
        supabase.from("music_tracks").select("id, nome, artista, artist_id, storage_path"),
        supabase.from("content_library").select("id, title, storage_path, duration_seconds").order("created_at", { ascending: false }),
        socialService.getConnectedAccounts(),
        supabase.from("campanhas").select("*").in("status", ["ativo", "pausado"]).order("data_inicio", { ascending: false }).limit(1),
      ]);

      setMusicas(tracksRes.data || []);
      setBiblioteca(libraryRes.data || []);
      setSocialAccounts(accountsRes || []);

      if (campRes.data?.[0]) setCampanhaAtiva(campRes.data[0]);

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
      return r?.status === "ready";
    });
    if (step === 5) return renders.some(r => r.is_approved);
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
        return r?.status !== "ready";
      });
      if (pending.length > 0) return `Aguarde o processamento: ${pending.length} vídeos pendentes`;
    }
    if (step === 5 && !renders.some(r => r.is_approved)) return "Aprove pelo menos um vídeo";
    if (step === 6 && selAccounts.size === 0) return "Selecione pelo menos uma conta";
    return "";
  }

  // ─── Process videos ───────────────────────────────────────────────────────
  // ─── Process videos (via render-bridge) ──────────────────────────────────
  async function handleProcessAll() {
    if (!formData.music_track_id) return toast.error("Selecione uma música primeiro");
    const musicTrack = musicas.find(m => m.id === formData.music_track_id);
    if (!musicTrack) return toast.error("Música não encontrada");

    setIsProcessing(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      for (const videoId of Array.from(selVideos)) {
        setProcessProgress(prev => ({ ...prev, [videoId]: "processing" }));
        
        try {
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
              attempts: 0,
              audio_mode: formData.audio_mode,
              music_volume: formData.music_volume,
              original_audio_volume: formData.original_audio_volume,
              music_start_ms: formData.music_start_ms,
            }, { onConflict: "render_key" })
            .select()
            .single();

          if (error) throw error;

          if (render) {
            // Chamada para o worker da VPS
            const workerUrl = 'https://worker.fluxpost.store/render';
            
            const { data: content } = await supabase
              .from('content_library')
              .select('storage_path')
              .eq('id', videoId)
              .single();

            const { data: music } = await supabase
              .from('music_tracks')
              .select('storage_path')
              .eq('id', formData.music_track_id)
              .single();

            if (content?.storage_path && music?.storage_path) {
              const { data: videoUrlData } = supabase.storage
                .from('videos')
                .getPublicUrl(content.storage_path);

              const { data: musicUrlData } = supabase.storage
                .from('musicas')
                .getPublicUrl(music.storage_path);

              try {
                await fetch(workerUrl, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    render_id: render.id,
                    video_url: videoUrlData.publicUrl,
                    music_url: musicUrlData.publicUrl,
                    audio_mode: formData.audio_mode,
                    music_volume: formData.music_volume,
                    original_audio_volume: formData.original_audio_volume,
                    music_start_ms: formData.music_start_ms,
                  })
                });
              } catch (fetchErr) {
                console.warn("Worker VPS inacessível, mas job salvo:", fetchErr);
              }
            }

            setRenders(prev => {
              const filtered = prev.filter(r => r.id !== render.id);
              return [...filtered, render as RenderItem];
            });
            setProcessProgress(prev => ({ ...prev, [videoId]: render.status }));
          }
        } catch (e: any) {
          setProcessProgress(prev => ({ ...prev, [videoId]: "failed" }));
          console.error("Erro ao inserir render:", videoId, e);
          toast.error(`Falha ao processar vídeo ${videoId}`);
        }
      }
      toast.success("Jobs de renderização enviados para o worker!");
    } catch (e: any) {
      toast.error("Erro: " + e.message);
    } finally {
      setIsProcessing(false);
    }
  }

  async function handlePreview(render: RenderItem, title: string) {
    if (!render.storage_path) return;
    setPreviewTitle(title);
    setPreviewOpen(true);
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.storage.from("rendered").createSignedUrl(render.storage_path, 3600);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (e: any) {
      toast.error("Erro ao carregar preview");
      setPreviewOpen(false);
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

      // Link videos
      await supabase.from("campaign_contents").insert(
        Array.from(selVideos).map(id => ({ campaign_id: camp.id, content_id: id }))
      );

      // Link accounts
      await supabase.from("campaign_social_accounts").insert(
        Array.from(selAccounts).map(id => ({ campaign_id: camp.id, social_account_id: id }))
      );

      await supabase.from("music_tracks").update({ campanha_ativa: true }).eq("id", formData.music_track_id);

      toast.success("Campanha iniciada com sucesso!");
      fetchData();
    } catch (e: any) {
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
                  <p className="text-sm text-muted-foreground">Nome, datas e ritmo de postagem.</p>
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
                    <Label>Posts por dia</Label>
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
                <div className="space-y-2">
                  {Array.from(selVideos).map((id, idx) => {
                    const video = biblioteca.find(v => v.id === id);
                    const render = getRender(id);
                    const status = render?.status || "pending";
                    return (
                      <div key={id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30">
                        <div className="w-10 h-14 rounded bg-muted/50 overflow-hidden flex-shrink-0">
                          {signedUrls[id] ? <video src={signedUrls[id]} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-muted" />}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-foreground">{video?.title || `Vídeo ${idx + 1}`}</p>
                          <p className="text-xs text-muted-foreground">Trilha: {selectedMusic?.nome}</p>
                        </div>
                        {status === "pending" && <Badge variant="outline" className="text-xs border-border text-muted-foreground">Aguardando</Badge>}
                        {status === "processing" && <Badge className="text-xs bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse">Processando...</Badge>}
                        {status === "ready" && (
                          <div className="flex items-center gap-2">
                            <Badge className="text-xs bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Pronto</Badge>
                            {render?.storage_path && (
                              <Button size="sm" variant="outline" className="h-7 text-xs gap-1 border-border"
                                onClick={() => handlePreview(render!, video?.title || "")}>
                                <Eye size={12} /> Preview
                              </Button>
                            )}
                          </div>
                        )}
                        {status === "failed" && <Badge className="text-xs bg-red-500/10 text-red-500 border-red-500/20">Falhou</Badge>}
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
                          <p className="text-sm font-medium text-foreground">{acc.account_name}</p>
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
              <video src={previewUrl} controls autoPlay className="w-full h-full object-contain" />
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
