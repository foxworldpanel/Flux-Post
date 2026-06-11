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
import { Music, Plus, Trash2, Play, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface MusicTrack {
  id: string;
  nome: string;
  artista: string | null;
  estilo: string | null;
  duracao_segundos: number | null;
  storage_path: string | null;
  vezes_usada: number | null;
  campanha_ativa: boolean | null;
  criado_em: string | null;
}

export default function MusicsPage() {
  const [musics, setMusics] = useState<MusicTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isModalOpen, setIsSidebarOpen] = useState(false);
  const { user } = useAuth();

  // Form states
  const [nome, setNome] = useState("");
  const [artista, setArtista] = useState("");
  const [estilo, setEstilo] = useState("lofi");
  const [file, setFile] = useState<File | null>(null);

  const fetchMusics = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("music_tracks")
        .select("*")
        .order("criado_em", { ascending: false });

      if (error) throw error;
      setMusics(data || []);
    } catch (error: any) {
      toast.error("Erro ao carregar músicas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMusics();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type !== "audio/mpeg" && selectedFile.type !== "audio/mp3") {
        toast.error("Por favor, selecione um arquivo MP3.");
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
      
      // 1. Get audio duration (optional but good)
      let duration = 0;
      try {
        const audio = new Audio();
        audio.src = URL.createObjectURL(file);
        await new Promise((resolve) => {
          audio.onloadedmetadata = () => {
            duration = Math.round(audio.duration);
            resolve(null);
          };
        });
      } catch (e) {
        console.warn("Could not get duration", e);
      }

      // 2. Upload to Storage
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const filePath = `${user?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("musicas")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // 3. Save metadata
      const { error: dbError } = await supabase.from("music_tracks").insert({
        nome,
        artista,
        estilo,
        duracao_segundos: duration,
        storage_path: filePath,
        user_id: user?.id,
      });

      if (dbError) throw dbError;

      toast.success("Música adicionada com sucesso!");
      setIsSidebarOpen(false);
      resetForm();
      fetchMusics();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const resetForm = () => {
    setNome("");
    setArtista("");
    setEstilo("lofi");
    setFile(null);
  };

  const handleDelete = async (id: string, storagePath: string | null) => {
    if (!confirm("Tem certeza que deseja excluir esta música?")) return;

    try {
      if (storagePath) {
        await supabase.storage.from("musicas").remove([storagePath]);
      }
      const { error } = await supabase.from("music_tracks").delete().eq("id", id);
      if (error) throw error;
      
      toast.success("Música removida.");
      fetchMusics();
    } catch (error: any) {
      toast.error("Erro ao deletar: " + error.message);
    }
  };

  const toggleCampanha = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("music_tracks")
        .update({ campanha_ativa: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      fetchMusics();
    } catch (error: any) {
      toast.error("Erro ao atualizar status: " + error.message);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-[#0A0A0F] font-display">Biblioteca de Músicas</h1>
            <p className="text-muted-foreground">Gerencie suas trilhas sonoras para automação.</p>
          </div>

          <Dialog open={isModalOpen} onOpenChange={setIsSidebarOpen}>
            <DialogTrigger asChild>
              <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] text-white gap-2">
                <Plus size={18} />
                Adicionar Música
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[#13131F] border-white/10 text-white sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle className="text-xl font-bold font-display">Nova Música</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="file">Arquivo MP3</Label>
                  <Input
                    id="file"
                    type="file"
                    accept=".mp3,audio/mpeg"
                    onChange={handleFileChange}
                    className="bg-[#0A0A0F] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome da Música</Label>
                  <Input
                    id="nome"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    placeholder="Ex: Chill Vibe"
                    className="bg-[#0A0A0F] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="artista">Artista</Label>
                  <Input
                    id="artista"
                    value={artista}
                    onChange={(e) => setArtista(e.target.value)}
                    placeholder="Nome do artista"
                    className="bg-[#0A0A0F] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estilo">Estilo</Label>
                  <Select value={estilo} onValueChange={setEstilo}>
                    <SelectTrigger className="bg-[#0A0A0F] border-white/10 w-full">
                      <SelectValue placeholder="Selecione o estilo" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      <SelectItem value="lofi">Lofi</SelectItem>
                      <SelectItem value="trap">Trap</SelectItem>
                      <SelectItem value="pop">Pop</SelectItem>
                      <SelectItem value="funk">Funk</SelectItem>
                      <SelectItem value="eletrônico">Eletrônico</SelectItem>
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
                  {uploading ? "Salvando..." : "Salvar Música"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-[#13131F] animate-pulse border border-white/5" />
            ))}
          </div>
        ) : musics.length === 0 ? (
          <Card className="bg-[#13131F] border-white/5 border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <div className="p-4 rounded-full bg-white/5">
                <Music size={40} className="text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-white">Nenhuma música encontrada</p>
                <p className="text-muted-foreground">Comece adicionando sua primeira trilha sonora.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {musics.map((music) => (
              <Card key={music.id} className="bg-[#13131F] border-white/5 hover:border-white/10 transition-all overflow-hidden group">
                <CardHeader className="pb-2 relative">
                  <div className="absolute top-4 right-4 flex gap-2">
                    {music.campanha_ativa && (
                      <Badge variant="success" className="gap-1">
                        <CheckCircle2 size={12} />
                        Ativa
                      </Badge>
                    )}
                    <Badge variant="secondary" className="bg-white/5 border-white/10 capitalize">
                      {music.estilo}
                    </Badge>
                  </div>
                  <div className="w-12 h-12 rounded-lg bg-[#7C3AED]/20 flex items-center justify-center mb-2">
                    <Music className="text-[#7C3AED]" size={24} />
                  </div>
                  <CardTitle className="text-white text-lg font-bold font-display line-clamp-1">
                    {music.nome}
                  </CardTitle>
                  <p className="text-sm text-slate-400">{music.artista || "Artista desconhecido"}</p>
                </CardHeader>
                <CardContent className="pt-0 space-y-4">
                  <div className="flex justify-between text-xs text-slate-500 font-medium">
                    <span>{formatDuration(music.duracao_segundos)}</span>
                    <span>Usada {music.vezes_usada || 0} vezes</span>
                  </div>
                  
                  <div className="flex gap-2 pt-2 border-t border-white/5">
                    <Button 
                      variant="ghost" 
                      className={`flex-1 gap-2 text-xs ${music.campanha_ativa ? 'text-emerald-500 hover:text-emerald-400' : 'text-slate-400 hover:text-white'} hover:bg-white/5`}
                      onClick={() => toggleCampanha(music.id, music.campanha_ativa)}
                    >
                      <Play size={14} />
                      {music.campanha_ativa ? 'Desativar' : 'Ativar'}
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="text-slate-400 hover:text-red-500 hover:bg-red-500/10"
                      onClick={() => handleDelete(music.id, music.storage_path)}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
