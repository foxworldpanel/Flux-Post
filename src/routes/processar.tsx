import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { processVideo } from "@/services/videoProcessor";
import { Download, Video, Music, Loader2 } from "lucide-react";

export default function ProcessarPage() {
  const [videos, setVideos] = useState<any[]>([]);
  const [musicas, setMusicas] = useState<any[]>([]);
  const [selectedVideo, setSelectedVideo] = useState("");
  const [selectedMusic, setSelectedMusic] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [finalUrl, setFinalUrl] = useState("");

  useEffect(() => {
    fetchLibrary();
  }, []);

  async function fetchLibrary() {
    const { data: videoData } = await supabase.from("videos").select("*");
    const { data: musicData } = await supabase.from("music_tracks").select("*");
    setVideos(videoData || []);
    setMusicas(musicData || []);
  }

  const handleProcess = async () => {
    if (!selectedVideo || !selectedMusic) {
      toast.error("Selecione um vídeo e uma música");
      return;
    }

    const video = videos.find(v => v.id === selectedVideo);
    const music = musicas.find(m => m.id === selectedMusic);

    const videoFullUrl = supabase.storage.from('videos').getPublicUrl(video.storage_path).data.publicUrl;
    const musicFullUrl = supabase.storage.from('musicas').getPublicUrl(music.storage_path).data.publicUrl;

    setProcessing(true);
    setProgress(0);
    setFinalUrl("");

    try {
      const url = await processVideo(videoFullUrl, musicFullUrl, (p) => setProgress(p));
      setFinalUrl(url);
      toast.success("Vídeo processado com sucesso!");
    } catch (error: any) {
      console.error(error);
      toast.error("Erro no processamento: " + error.message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
        <h1 className="text-3xl font-bold text-white">Processar Vídeo</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="bg-[#13131F] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Video className="text-primary" size={20} />
                Selecionar Vídeo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedVideo} onValueChange={setSelectedVideo}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Escolha um vídeo" />
                </SelectTrigger>
                <SelectContent className="bg-[#13131F] border-white/10 text-white">
                  {videos.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F] border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Music className="text-primary" size={20} />
                Selecionar Música
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={selectedMusic} onValueChange={setSelectedMusic}>
                <SelectTrigger className="bg-white/5 border-white/10 text-white">
                  <SelectValue placeholder="Escolha uma música" />
                </SelectTrigger>
                <SelectContent className="bg-[#13131F] border-white/10 text-white">
                  {musicas.map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        <Button 
          className="w-full bg-[#7C3AED] hover:bg-[#6D28D9] text-white py-6 text-lg"
          onClick={handleProcess}
          disabled={processing}
        >
          {processing ? (
            <span className="flex items-center gap-2">
              <Loader2 className="animate-spin" /> Processando {progress}%
            </span>
          ) : "Processar Vídeo"}
        </Button>

        {processing && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-white/60">
              <span>Progresso FFmpeg</span>
              <span>{progress}%</span>
            </div>
            <Progress value={progress} className="h-2 bg-white/5" />
          </div>
        )}

        {finalUrl && (
          <Card className="bg-[#13131F] border-white/10 animate-in zoom-in duration-300">
            <CardContent className="p-6 space-y-4">
              <h2 className="text-xl font-semibold text-white">Resultado</h2>
              <video 
                src={finalUrl} 
                controls 
                className="w-full rounded-lg border border-white/10 aspect-video bg-black"
              />
              <Button asChild className="w-full bg-emerald-600 hover:bg-emerald-700">
                <a href={finalUrl} download="video_processado.mp4">
                  <Download className="mr-2" size={20} /> Baixar Vídeo
                </a>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
