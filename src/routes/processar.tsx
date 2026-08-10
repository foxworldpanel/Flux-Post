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

interface LibraryItem {
  id: string;
  nome: string;
  storage_path: string;
}

type ProcessStep = "idle" | "loading-ffmpeg" | "downloading" | "processing" | "completed";

export default function ProcessarPage() {
  const [videos, setVideos] = useState<LibraryItem[]>([]);
  const [musics, setMusics] = useState<LibraryItem[]>([]);
  const [selectedVideo, setSelectedVideo] = useState<string>("");
  const [selectedMusic, setSelectedMusic] = useState<string>("");
  
  const [step, setStep] = useState<ProcessStep>("idle");
  const [progress, setProgress] = useState(0);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
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

    const video = videos.find(v => v.id === selectedVideo);
    const music = musics.find(m => m.id === selectedMusic);

    if (!video || !music) return;

    try {
      setStep("loading-ffmpeg");
      setProgress(10);
      setResultBlob(null);

      const blob = await processVideo(
        video.storage_path,
        music.storage_path,
        (message) => {
          if (message.includes("Writing file")) setStep("downloading");
          if (message.includes("Running command")) setStep("processing");
        }
      );

      setStep("completed");
      setProgress(100);
      setResultBlob(blob);
      toast.success("Vídeo processado com sucesso!");
    } catch (error: any) {
      console.error(error);
      setStep("idle");
      toast.error("Erro no processamento: " + error.message);
    }
  };

  const handleSave = async () => {
    if (!resultBlob || !selectedVideo || !selectedMusic) return;

    try {
      setSaving(true);
      const fileName = `processed-${Date.now()}.mp4`;
      
      console.log('Salvando vídeo processado:', fileName);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, resultBlob, {
          cacheControl: '3600',
          upsert: true,
          contentType: 'video/mp4'
        });

      if (uploadError) {
        console.error('Erro upload storage:', uploadError);
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      
      const publicUrl = publicUrlData.publicUrl;
      console.log('URL pública do vídeo processado:', publicUrl);

      const { error: dbError } = await supabase.from("videos_processados").insert({
        video_id: selectedVideo,
        music_track_id: selectedMusic,
        storage_path: publicUrl,
      });

      if (dbError) throw dbError;

      toast.success("Vídeo salvo na biblioteca!");
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const getStepLabel = () => {
    switch (step) {
      case "loading-ffmpeg": return "Carregando FFmpeg... (isso pode levar alguns segundos)";
      case "downloading": return "Baixando arquivos...";
      case "processing": return "Processando vídeo...";
      case "completed": return "Concluído!";
      default: return "";
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8">
        <div>
          <h1 className="text-3xl font-bold text-white font-display">Processar Vídeo</h1>
          <p className="text-slate-400">Combine seus vídeos com as melhores trilhas sonoras.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#13131F] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <VideoIcon className="text-[#7C3AED]" size={20} />
                Vídeo Original
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Escolha o vídeo</Label>
                <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                  <SelectTrigger className="bg-[#0A0A0F] border-white/10 text-white">
                    <SelectValue placeholder="Selecione um vídeo" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13131F] border-white/10 text-white">
                    {videos.map((v) => (
                      <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F] border-white/5">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Music className="text-[#7C3AED]" size={20} />
                Trilha Sonora
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-400">Escolha a música</Label>
                <Select value={selectedMusic} onValueChange={setSelectedMusic}>
                  <SelectTrigger className="bg-[#0A0A0F] border-white/10 text-white">
                    <SelectValue placeholder="Selecione uma música" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#13131F] border-white/10 text-white">
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
            className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white w-full md:w-auto px-12 h-14 text-lg font-bold gap-2"
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
                <span className="text-slate-400 flex items-center gap-2">
                  {step === "completed" ? <CheckCircle2 size={16} className="text-emerald-500" /> : <Loader2 size={16} className="animate-spin text-[#7C3AED]" />}
                  {getStepLabel()}
                </span>
                <span className="text-white font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2 bg-white/5" />
            </div>
          )}
        </div>

        {resultBlob && (
          <Card className="bg-[#13131F] border-white/5 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
            <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
              <CardTitle className="text-white">Resultado</CardTitle>
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {saving ? <Loader2 className="animate-spin" size={18} /> : <Save size={18} />}
                Salvar na biblioteca
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              <video
                src={URL.createObjectURL(resultBlob)}
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
