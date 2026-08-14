import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import { renderService } from "@/services/renderService";
import { toast } from "sonner";
import { Play, Save, Loader2, Video as VideoIcon, Music, CheckCircle2, History } from "lucide-react";
import { storageService } from "@/services/storage";

interface LibraryItem {
  id: string;
  nome: string;
  storage_path: string;
}

type ProcessStep = "idle" | "enqueued" | "completed";

export default function ProcessarPage() {
  const [videos, setVideos] = useState<LibraryItem[]>([]);
  const [musics, setMusics] = useState<LibraryItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedMusic, setSelectedMusic] = useState<string>("");
  
  const [step, setStep] = useState<ProcessStep>("idle");
  const [progress, setProgress] = useState(0);
  const [resultRender, setResultRender] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      const [videosRes, musicsRes] = await Promise.all([
        supabase.from("videos").select("id, nome, storage_path"),
        supabase.from("music_tracks").select("id, nome, storage_path"),
      ]);
      
      if (videosRes.data) setVideos(videosRes.data);
      if (musicsRes.data) setMusics(musicsRes.data);
    };
    fetchData();
  }, []);

  const handleProcess = async () => {
    if (!selectedVideo || !selectedMusic) {
      toast.error("Selecione um vídeo e uma música");
      return;
    }

    try {
      setStep("enqueued");
      setProgress(20);
      setResultRender(null);
      setPreviewUrl(null);

      const render = await renderService.requestRender({
        videoId: selectedVideo,
        musicId: selectedMusic,
        audioMode: 'music_plus_original',
        musicVolume: 80,
        originalAudioVolume: 20
      });

      toast.info("Trabalho enfileirado! Acompanhando progresso...");

      // Poll for render status
      const pollInterval = setInterval(async () => {
        const { data, error } = await supabase
          .from('media_renders')
          .select('*')
          .eq('id', render.id)
          .single();

        if (error) {
          clearInterval(pollInterval);
          throw error;
        }

        if (data.status === 'ready' && data.storage_path) {
          clearInterval(pollInterval);
          
          const { data: signedUrlData } = await supabase.storage
            .from('rendered')
            .createSignedUrl(data.storage_path, 3600);

          setPreviewUrl(signedUrlData?.signedUrl || null);
          setResultRender(data);
          setStep("completed");
          setProgress(100);
          toast.success("Vídeo processado com sucesso!");
        } else if (data.status === 'failed') {
          clearInterval(pollInterval);
          throw new Error(data.error_message || "Erro no processamento remoto");
        } else if (data.status === 'processing') {
          setProgress(60);
        }
      }, 3000);

    } catch (error: any) {
      console.error(error);
      setStep("idle");
      toast.error("Erro no processamento: " + error.message);
    }
  };

  const handleSave = async () => {
    if (!resultRender || !selectedVideo || !selectedMusic) return;

    try {
      setSaving(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não autenticado");

      // Link the existing render to the library
      const { error: dbError } = await supabase.from("videos").insert({
        nome: `Remoto ${new Date().toLocaleDateString()}`,
        storage_path: resultRender.storage_path,
        user_id: user.id
      });

      if (dbError) throw dbError;
      
      toast.success("Vídeo adicionado à biblioteca!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStepLabel = () => {
    switch (step) {
      case "enqueued": return "Aguardando processamento remoto...";
      case "completed": return "Concluído!";
      default: return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground font-display">Processar Vídeo</h1>
          <p className="text-muted-foreground">Combine seus vídeos com as melhores trilhas sonoras.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <VideoIcon className="text-[#7C3AED]" size={20} />
                Vídeo Original
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Escolha o vídeo</Label>
                <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione um vídeo" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {videos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Music className="text-[#7C3AED]" size={20} />
                Trilha Sonora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-muted-foreground">Escolha a música</Label>
                <Select value={selectedMusic} onValueChange={setSelectedMusic}>
                  <SelectTrigger className="bg-background border-border text-foreground">
                    <SelectValue placeholder="Selecione uma música" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border text-foreground">
                    {musics.map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col items-center space-y-6">
          <Button
            size="lg"
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-foreground w-full md:w-auto px-12 h-14 text-lg font-bold gap-2"
            disabled={step !== "idle" && step !== "completed" || !selectedVideo || !selectedMusic}
            onClick={handleProcess}
          >
            {step !== "idle" && step !== "completed" ? (
              <>
                <Loader2 className="animate-spin" size={24} />
                Processando...
              </>
            ) : (
              <>
                <Play size={24} />
                Processar Vídeo
              </>
            )}
          </Button>

          {step !== "idle" && (
            <div className="w-full space-y-3 animate-in fade-in duration-500">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground flex items-center gap-2">
                  {step === "completed" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Loader2 size={16} className="animate-spin text-[#7C3AED]" />}
                  {getStepLabel()}
                </span>
                <span className="text-foreground font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-muted/50" />
            </div>
          )}
        </div>

        {previewUrl && (
          <Card className="bg-card border-border overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="flex flex-row items-center justify-between border-b border-border pb-4">
              <CardTitle className="text-foreground">Resultado Remoto</CardTitle>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-foreground gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar na biblioteca
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <video
                src={previewUrl}
                controls
                className="w-full aspect-video"
              />
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
