import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Play,
  Check,
  Loader2,
  ExternalLink,
  Library,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { contentService } from "@/services/content";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";

interface PexelsVideo {
  id: number;
  width: number;
  height: number;
  url: string;
  image: string;
  duration: number;
  user: {
    id: number;
    name: string;
    url: string;
  };
  video_files: Array<{
    id: number;
    quality: string;
    file_type: string;
    width: number;
    height: number;
    link: string;
  }>;
  video_pictures: Array<{
    id: number;
    picture: string;
    nr: number;
  }>;
}

export default function GarimpoPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | "square" | "all">(
    "portrait",
  );
  const [category, setCategory] = useState("Outros");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<PexelsVideo[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<PexelsVideo | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  const categories = [
    "Receitas",
    "Natureza",
    "Satisfying",
    "Animais",
    "Lifestyle",
    "Viagens",
    "Humor/Memes",
    "Carros",
    "Fitness",
    "Curiosidades",
    "Relaxante",
    "Outros",
  ];

  const handleSearch = async (resetPage = true) => {
    if (!query) {
      toast.error("Digite um termo para pesquisar");
      return;
    }

    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      const data = await contentService.searchPexels({
        query,
        orientation: orientation === "all" ? undefined : orientation,
        page: currentPage,
        per_page: 20,
      });

      if (data.error) throw new Error(data.error);

      setResults(data.videos || []);
      setTotalResults(data.total_results || 0);
    } catch (err: unknown) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : "Erro desconhecido";
      if (errorMessage.includes("PEXELS_API_KEY")) {
        toast.error("PEXELS_API_KEY não configurada no backend");
      } else {
        toast.error("Erro ao buscar vídeos: " + errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (video: PexelsVideo) => {
    if (importingId) return;

    try {
      setImportingId(video.id);
      toast.loading("Iniciando importação segura...", { id: "import-pexels" });

      const response = await contentService.importPexelsVideo({
        videoId: video.id,
        category: category,
      });

      setImportedIds((prev) => new Set([...prev, video.id]));
      toast.success("Vídeo importado com sucesso para a Biblioteca!", { id: "import-pexels" });
      setSelectedVideo(null);
    } catch (err: unknown) {
      const error = err as { message?: string; status?: number };
      console.error("Erro na importação:", error);

      if (
        error.status === 409 ||
        error.message?.includes("duplicate") ||
        error.message?.includes("Biblioteca")
      ) {
        setImportedIds((prev) => new Set([...prev, video.id]));
        toast.info("Este conteúdo já está na sua Biblioteca.", {
          id: "import-pexels",
          action: {
            label: "VER NA BIBLIOTECA",
            onClick: () => navigate("/videos"),
          },
        });
      } else if (error.status === 429 || error.message?.includes("rate limit")) {
        toast.error("Limite temporário da API Pexels. Tente novamente em instantes.", {
          id: "import-pexels",
        });
      } else {
        toast.error(error.message || "Erro ao importar vídeo", { id: "import-pexels" });
      }
    } finally {
      setImportingId(null);
    }
  };

  const handleNextPage = () => {
    setPage((p) => p + 1);
  };

  const handlePrevPage = () => {
    if (page > 1) setPage((p) => p - 1);
  };

  useEffect(() => {
    if (page > 1) {
      handleSearch(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-space font-bold text-white mb-2">Garimpo</h1>
            <p className="text-slate-400">
              Descubra e importe conteúdos virais do Pexels para sua biblioteca
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1"
            >
              Pexels Integration
            </Badge>
          </div>
        </div>

        {/* Filtros */}
        <div className="bg-[#13131F] p-6 rounded-2xl border border-white/5 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-6 items-end">
            <div className="lg:col-span-5 space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Search className="w-4 h-4" /> Palavra-chave
              </label>
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                placeholder="Ex: chocolate cake, nature, satisfying..."
                className="bg-white/5 border-white/10 h-11 focus:border-purple-500/50 transition-all"
              />
            </div>

            <div className="lg:col-span-2 space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Filter className="w-4 h-4" /> Orientação
              </label>
              <Select
                value={orientation}
                onValueChange={(v: "landscape" | "portrait" | "square" | "all") =>
                  setOrientation(v)
                }
              >
                <SelectTrigger className="bg-white/5 border-white/10 h-11">
                  <SelectValue placeholder="Orientação" />
                </SelectTrigger>
                <SelectContent className="bg-[#13131F] border-white/10">
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="portrait">Vertical (9:16)</SelectItem>
                  <SelectItem value="landscape">Horizontal (16:9)</SelectItem>
                  <SelectItem value="square">Quadrado (1:1)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-3 space-y-2">
              <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                <Library className="w-4 h-4" /> Categoria Destino
              </label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-white/5 border-white/10 h-11">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent className="bg-[#13131F] border-white/10">
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="lg:col-span-2">
              <Button
                onClick={() => handleSearch()}
                disabled={loading}
                className="bg-[#7C3AED] hover:bg-[#6D28D9] h-11 w-full font-bold shadow-lg shadow-purple-500/20"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Buscar Vídeos"}
              </Button>
            </div>
          </div>
        </div>

        {/* Resultados */}
        {results.length > 0 ? (
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {results.map((video) => (
                <Card
                  key={video.id}
                  className="bg-[#13131F] border-white/5 overflow-hidden group hover:border-purple-500/30 transition-all duration-300"
                >
                  <div className="relative aspect-[9/16] overflow-hidden bg-black">
                    <img
                      src={video.image}
                      alt={video.url}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 opacity-80"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="rounded-full bg-white/20 hover:bg-white/30 backdrop-blur-md"
                        onClick={() => setSelectedVideo(video)}
                      >
                        <Play className="w-5 h-5 fill-white text-white" />
                      </Button>
                    </div>
                    <Badge className="absolute top-3 right-3 bg-black/60 backdrop-blur-md border-white/10">
                      {Math.floor(video.duration / 60)}:
                      {(video.duration % 60).toString().padStart(2, "0")}
                    </Badge>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <p className="text-white font-medium text-sm truncate max-w-[150px]">
                          {video.user.name}
                        </p>
                        <p className="text-slate-500 text-[10px] uppercase tracking-wider">
                          Fonte: Pexels
                        </p>
                      </div>
                      <p className="text-slate-400 text-xs font-mono">
                        {video.width}x{video.height}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 bg-white/5 border-white/10 hover:bg-white/10 h-9"
                        onClick={() => setSelectedVideo(video)}
                      >
                        Visualizar
                      </Button>
                      <Button
                        size="sm"
                        disabled={importingId === video.id || importedIds.has(video.id)}
                        className={`flex-1 h-9 ${importedIds.has(video.id) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-purple-600 hover:bg-purple-700"}`}
                        onClick={() => handleImport(video)}
                      >
                        {importingId === video.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : importedIds.has(video.id) ? (
                          <Check className="w-4 h-4 mr-1" />
                        ) : (
                          "Aprovar"
                        )}
                        {importedIds.has(video.id) ? "Importado" : ""}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Paginação */}
            <div className="flex items-center justify-between border-t border-white/5 pt-8 pb-12">
              <p className="text-slate-500 text-sm">
                Mostrando{" "}
                <span className="text-white font-medium">
                  {(page - 1) * 20 + 1} - {Math.min(page * 20, totalResults)}
                </span>{" "}
                de <span className="text-white font-medium">{totalResults}</span> resultados
              </p>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={handlePrevPage}
                  disabled={page === 1 || loading}
                  className="bg-white/5 border-white/10 hover:bg-white/10"
                >
                  <ChevronLeft className="w-4 h-4 mr-2" /> Anterior
                </Button>
                <Button
                  variant="outline"
                  onClick={handleNextPage}
                  disabled={page * 20 >= totalResults || loading}
                  className="bg-white/5 border-white/10 hover:bg-white/10"
                >
                  Próxima <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-white/5 rounded-3xl bg-[#13131F]/30 text-center px-6">
            <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-6">
              <Search className="w-10 h-10 text-slate-700" />
            </div>
            <h3 className="text-white font-space font-bold text-xl mb-2">Inicie sua busca</h3>
            <p className="text-slate-500 max-w-sm mb-8">
              Digite termos relacionados ao seu nicho para encontrar os melhores vídeos para suas
              campanhas.
            </p>
            <div className="flex flex-wrap justify-center gap-2 max-w-md">
              {["chocolate cake", "cooking", "nature", "fitness", "cars", "lifestyle"].map(
                (term) => (
                  <Badge
                    key={term}
                    variant="outline"
                    className="cursor-pointer hover:bg-purple-500/10 hover:text-purple-400 hover:border-purple-500/30 transition-all px-3 py-1.5"
                    onClick={() => {
                      setQuery(term);
                      // Auto trigger search if clicked
                      setQuery((prev) => {
                        const newQuery = term;
                        // We need to trigger handleSearch with this new value
                        return newQuery;
                      });
                    }}
                  >
                    {term}
                  </Badge>
                ),
              )}
            </div>
          </div>
        )}

        {/* Garimpo Automático (Dashboard Preview) */}
        <Card className="bg-gradient-to-br from-[#13131F] to-[#0A0A0F] border-white/5 overflow-hidden group">
          <CardHeader className="border-b border-white/5 bg-white/5">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-xl font-space font-bold text-white">
                  Garimpo Automático
                </CardTitle>
                <CardDescription className="text-slate-400">
                  Em breve: Deixe nossa IA minerar conteúdos para você 24/7
                </CardDescription>
              </div>
              <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20">
                Alpha Access
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Status</p>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-slate-700" />
                  <p className="font-semibold text-slate-400">Desativado</p>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Estoque Mínimo
                </p>
                <p className="text-2xl font-space font-bold text-white">10</p>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                  Fontes Ativas
                </p>
                <div className="flex gap-1">
                  <Badge variant="secondary" className="bg-white/5 border-white/10 text-xs">
                    Pexels
                  </Badge>
                </div>
              </div>
              <div className="flex items-center">
                <Button
                  variant="outline"
                  className="w-full border-dashed border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all h-12"
                >
                  Configurar Automação
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modal de Preview */}
        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl bg-[#0A0A0F] border-white/10 p-0 overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="md:col-span-2 bg-black flex items-center justify-center min-h-[500px]">
                {selectedVideo && (
                  <video
                    src={
                      selectedVideo.video_files.find((f) => f.width < f.height)?.link ||
                      selectedVideo.video_files[0]?.link
                    }
                    controls
                    autoPlay
                    className="max-h-[80vh] w-full"
                  />
                )}
              </div>
              <div className="p-8 space-y-8 bg-[#13131F]/50 backdrop-blur-xl border-l border-white/5">
                <div className="space-y-4">
                  <DialogTitle className="text-2xl font-space font-bold text-white">
                    Detalhes do Vídeo
                  </DialogTitle>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Criador:</span>
                      <a
                        href={selectedVideo?.user.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                      >
                        {selectedVideo?.user.name} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Duração:</span>
                      <span className="text-white font-medium">{selectedVideo?.duration}s</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Resolução:</span>
                      <span className="text-white font-medium">
                        {selectedVideo?.width} x {selectedVideo?.height}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-400">Fonte:</span>
                      <span className="text-white font-medium">Pexels</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                      Categoria para Importação
                    </label>
                    <Select value={category} onValueChange={setCategory}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Escolha a categoria" />
                      </SelectTrigger>
                      <SelectContent className="bg-[#13131F] border-white/10">
                        {categories.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="pt-8">
                  <Button
                    className={`w-full h-12 font-bold ${importedIds.has(selectedVideo?.id || 0) ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-purple-600 hover:bg-purple-700 shadow-xl shadow-purple-500/20"}`}
                    disabled={
                      importingId === selectedVideo?.id || importedIds.has(selectedVideo?.id || 0)
                    }
                    onClick={() => selectedVideo && handleImport(selectedVideo)}
                  >
                    {importingId === selectedVideo?.id ? (
                      <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    ) : importedIds.has(selectedVideo?.id || 0) ? (
                      <Check className="w-5 h-5 mr-2" />
                    ) : (
                      <Check className="w-5 h-5 mr-2" />
                    )}
                    {importedIds.has(selectedVideo?.id || 0)
                      ? "Já na Biblioteca"
                      : "Aprovar e Importar"}
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
