import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Video, Plus, Trash2, Clock, Calendar, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VideoTrack {
  id: string;
  nome: string;
  nicho: string | null;
  duracao_segundos: number | null;
  storage_path: string | null;
  vezes_usada: number | null;
  ultimo_uso: string | null;
  criado_em: string | null;
}

export default function VideosPage() {
  const [videos, setVideos] = useState<VideoTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<VideoTrack | null>(null);

  // Form states
  const [nome, setNome] = useState("");
  const [nicho, setNicho] = useState("outro");
  const [file, setFile] = useState<File | null>(null);

  const fetchVideos = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("videos")
        .select("*")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setVideos(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar vídeos: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "video/mp4") {
        toast.error("Por favor, selecione um arquivo MP4.");
        return;
      }
      setFile(selectedFile);
      if (!nome) setNome(selectedFile.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleSave = async () => {
    if (!file || !nome) {
      toast.error("Por favor, preencha o nome e selecione um arquivo.");
      return;
    }

    try {
      setUploading(true);
      
      // 1. Get video duration
      let duration = 0;
      try {
        const video = document.createElement('video');
        video.preload = 'metadata';
        video.src = URL.createObjectURL(file);
        await new Promise((resolve) => {
          video.onloadedmetadata = () => {
            duration = Math.round(video.duration);
            resolve(null);
          };
        });
      } catch (e) {
        console.warn("Could not get duration", e);
      }

      // 2. Upload to Supabase Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${crypto.randomUUID()}.${fileExt}`;
      const filePath = `${fileName}`; // Upload directly to bucket root

      const { error: uploadError } = await supabase.storage
        .from("videos")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("videos").getPublicUrl(filePath);

      // 3. Save metadata
      const { error: dbError } = await supabase.from("videos").insert({
        nome,
        nicho,
        duracao_segundos: duration,
        storage_path: publicUrl,
      });

      if (dbError) throw dbError;

      toast.success("Vídeo adicionado com sucesso!");
      setIsModalOpen(false);
      resetForm();
      fetchVideos();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setNicho("outro");
    setFile(null);
  };

  const handleDelete = async (id: string, storagePath: string | null) => {
    if (!confirm("Tem certeza que deseja excluir este vídeo?")) return;

    try {
      if (storagePath) {
        const cleanPath = storagePath.includes('/storage/v1/object/public/videos/')
          ? storagePath.split('/storage/v1/object/public/videos/')[1]
          : storagePath;
          
        await supabase.storage.from("videos").remove([cleanPath]);
      }
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;
      
      toast.success("Vídeo removido.");
      fetchVideos();
    } catch (error: any) {
      toast.error("Erro ao deletar: " + error.message);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPublicUrl = (path: string) => {
    if (!path) return "";
    if (path.startsWith('http')) return path;
    
    const { data } = supabase.storage.from("videos").getPublicUrl(path);
    return data.publicUrl;
  };

  const handlePreview = (video: VideoTrack) => {
    setSelectedVideo(video);
    setIsPreviewOpen(true);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-[#0A0A0F] font-display">Biblioteca de Vídeos</h1>
            <p className="text-muted-foreground">Gerencie seus clipes para postagem automática.</p>
          </div>

          <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2">
                <Plus size={18} />
                Adicionar Vídeo
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#13131F] border-white/10 text-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-display">Novo Vídeo</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo MP4</Label>
                  <Input
                    id="file"
                    type="file"
                    accept="video/mp4"
                    onChange={handleFileChange}
                    className="bg-[#0A0A0F] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome do Vídeo</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Por do sol na praia"
                    className="bg-[#0A0A0F] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nicho">Nicho</Label>
                  <Select value={nicho} onValueChange={setNicho}>
                    <SelectTrigger className="bg-[#0A0A0F] border-white/10 w-full">
                      <SelectValue placeholder="Selecione o nicho" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      <SelectItem value="viagem">Viagem</SelectItem>
                      <SelectItem value="comida">Comida</SelectItem>
                      <SelectItem value="natureza">Natureza</SelectItem>
                      <SelectItem value="dança">Dança</SelectItem>
                      <SelectItem value="motivação">Motivação</SelectItem>
                      <SelectItem value="humor">Humor</SelectItem>
                      <SelectItem value="outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={handleSave}
                  disabled={uploading}
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white w-full"
                >
                  {uploading ? "Fazendo upload..." : "Salvar Vídeo"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 rounded-xl bg-[#13131F] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <Card className="bg-[#13131F] border-white/5 border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-white/5">
                <Video size={40} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-white">Nenhum vídeo encontrado</p>
                <p className="text-muted-foreground">Adicione vídeos MP4 para começar a postar.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {videos.map((video) => (
              <Card key={video.id} className="bg-[#13131F] border-white/5 hover:border-white/10 transition-all overflow-hidden group flex flex-col">
                <div 
                  className="relative aspect-video bg-black flex items-center justify-center overflow-hidden cursor-pointer"
                  onClick={() => handlePreview(video)}
                >
                  {video.storage_path ? (
                    <video 
                      src={getPublicUrl(video.storage_path)} 
                      className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"
                      muted
                      playsInline
                    />
                  ) : (
                    <Video size={32} className="text-white/20" />
                  )}
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                    <div className="w-12 h-12 rounded-full bg-[#7C3AED] flex items-center justify-center text-white shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                      <Play size={24} fill="currentColor" />
                    </div>
                  </div>

                  <div className="absolute bottom-2 right-2 bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] text-white flex items-center gap-1">
                    <Clock size={10} />
                    {formatDuration(video.duracao_segundos)}
                  </div>
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] capitalize">
                      {video.nicho}
                    </Badge>
                  </div>
                </div>
                
                <CardHeader className="p-4 pb-2">
                  <CardTitle className="text-white text-base font-bold font-display line-clamp-1">
                    {video.nome}
                  </CardTitle>
                </CardHeader>
                
                <CardContent className="p-4 pt-0 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Play size={10} />
                      Usado {video.vezes_usada || 0} vezes
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <Calendar size={10} />
                      Último uso: {video.ultimo_uso ? format(new Date(video.ultimo_uso), "dd/MM/yy 'às' HH:mm", { locale: ptBR }) : "Nunca usado"}
                    </div>
                  </div>
                  
                  <div className="flex gap-2 pt-3 border-t border-white/5">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex-1 text-xs text-slate-400 hover:text-white hover:bg-white/5"
                      onClick={() => handlePreview(video)}
                    >
                      <Play size={12} className="mr-2" />
                      Preview
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDelete(video.id, video.storage_path)}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="bg-[#13131F] border-white/10 text-white max-w-4xl p-0 overflow-hidden">
          {selectedVideo && (
            <div className="flex flex-col">
              <div className="relative aspect-video bg-black">
                {selectedVideo.storage_path && (
                  <video 
                    src={getPublicUrl(selectedVideo.storage_path)} 
                    className="w-full h-full"
                    controls
                    autoPlay
                  />
                )}
              </div>
              <div className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-xl font-bold font-display">{selectedVideo.nome}</h2>
                  <Badge variant="secondary" className="bg-white/5 border-white/10 text-xs capitalize">
                    {selectedVideo.nicho}
                  </Badge>
                </div>
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <Clock size={16} />
                    {formatDuration(selectedVideo.duracao_segundos)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Play size={16} />
                    {selectedVideo.vezes_usada || 0} usos
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
