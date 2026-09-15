import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Video,
  Plus,
  Trash2,
  Clock,
  Calendar,
  Play,
  ExternalLink,
  Loader2,
  Search,
  Filter,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useAuth } from "@/hooks/useAuth";
import { contentService } from "@/services/content";

interface ContentLibrary {
  id: string;
  title: string;
  storage_path: string;
  file_type?: string;
  category: string | null;
  status: string | null;
  source: string | null;
  author: string | null;
  original_url: string | null;
  thumbnail_url: string | null;
  duration_seconds: number | null;
  credit: string | null;
  use_count: number | null;
  created_at: string | null;
}

export default function VideosPage() {
  const [items, setItems] = useState<ContentLibrary[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ContentLibrary | null>(null);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loadingUrl, setLoadingUrl] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [failedThumbnails, setFailedThumbnails] = useState<Set<string>>(new Set());

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterSource, setFilterSource] = useState("all");

  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await contentService.getLibrary();
      setItems(data as unknown as ContentLibrary[]);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao carregar biblioteca: " + errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handlePreview = async (item: ContentLibrary) => {
    setSelectedItem(item);
    setIsPreviewOpen(true);
    setLoadingUrl(true);
    setPreviewError(null);
    setSignedUrl(null);
    try {
      const url = await contentService.getSignedUrl(item.storage_path);
      if (!url) throw new Error("URL do vídeo não encontrada");
      setSignedUrl(url);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Erro ao carregar preview";
      setPreviewError(message);
      toast.error(message);
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleDelete = async (item: ContentLibrary) => {
    if (!confirm("Deseja realmente remover este conteúdo da biblioteca?")) return;

    try {
      // 1. Storage
      if (!/^https?:\/\//i.test(item.storage_path)) {
        const { error: storageError } = await supabase.storage
          .from("content-library")
          .remove([item.storage_path]);

        if (storageError) console.warn("Erro ao remover arquivo (prosseguindo):", storageError);
      }

      // 2. Database
      const { error } = await supabase.from("content_library").delete().eq("id", item.id);

      if (error) throw error;

      toast.success("Conteúdo removido");
      fetchData();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      toast.error("Erro ao remover: " + errorMessage);
    }
  };

  const filteredItems = items.filter((item) => {
    const matchesSearch =
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.author?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = filterCategory === "all" || item.category === filterCategory;
    const matchesSource = filterSource === "all" || item.source === filterSource;
    return matchesSearch && matchesCategory && matchesSource;
  });

  const categories = Array.from(new Set(items.map((i) => i.category).filter(Boolean)));
  const sources = Array.from(new Set(items.map((i) => i.source).filter(Boolean)));

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-7 px-4 pb-12 pt-6 animate-in fade-in duration-500 sm:px-6 sm:pt-8 lg:px-10 xl:px-12">
        <div className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-2">Acervo visual</p>
            <h1 className="text-2xl font-space font-bold text-foreground sm:text-3xl">
              Biblioteca de Conteúdo
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Gerencie seus vídeos importados e processados para campanhas.
            </p>
          </div>
          <Button
            onClick={() => (window.location.href = "/garimpo")}
            className="h-11 w-full shrink-0 gap-2 bg-[#7C3AED] px-6 font-bold text-white shadow-lg shadow-purple-500/20 hover:bg-[#6D28D9] sm:w-auto"
          >
            <Search size={18} />
            Garimpar Conteúdo
          </Button>
        </div>

        {/* Filtros */}
        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--card-shadow)] md:grid-cols-2 xl:grid-cols-[1.35fr_1fr_1fr_auto] xl:items-center">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por título ou autor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-muted/50 border-border pl-10"
            />
          </div>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="bg-muted/50 border-border">
              <SelectValue placeholder="Filtrar Categoria" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas as Categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c!}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="bg-muted/50 border-border">
              <SelectValue placeholder="Filtrar Fonte" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="all">Todas as Fontes</SelectItem>
              {sources.map((s) => (
                <SelectItem key={s} value={s!}>
                  {s === "pexels" ? "Pexels" : s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex items-center md:justify-end">
            <Badge variant="secondary" className="h-9 whitespace-nowrap px-3 font-medium">
              {filteredItems.length} {filteredItems.length === 1 ? "vídeo" : "vídeos"}
            </Badge>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div
                key={i}
                className="aspect-[9/16] rounded-2xl bg-card animate-pulse border border-border"
              />
            ))}
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="min-h-[400px] flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl bg-card/30 text-center px-6">
            <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
              <Video className="w-10 h-10 text-slate-700" />
            </div>
            <h3 className="text-foreground font-space font-bold text-xl mb-2">Biblioteca Vazia</h3>
            <p className="text-muted-foreground max-w-sm mb-8">
              Você ainda não importou nenhum conteúdo. Vá para o Garimpo para encontrar vídeos
              virais.
            </p>
            <Button
              onClick={() => (window.location.href = "/garimpo")}
              variant="outline"
              className="border-border hover:bg-muted/50"
            >
              Abrir Garimpo
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="group flex flex-col overflow-hidden border-border bg-card transition-all duration-300 hover:-translate-y-0.5 hover:border-purple-500/30 hover:shadow-xl"
              >
                <div
                  className="relative aspect-[9/14] cursor-pointer overflow-hidden bg-black"
                  onClick={() => handlePreview(item)}
                >
                  {item.thumbnail_url && !failedThumbnails.has(item.id) ? (
                    <img
                      src={item.thumbnail_url}
                      alt={`Preview de ${item.title}`}
                      loading="lazy"
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.035]"
                      onError={() =>
                        setFailedThumbnails(previous => new Set(previous).add(item.id))
                      }
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-gradient-to-br from-muted/80 to-background text-muted-foreground">
                      <Video className="h-12 w-12 opacity-25" />
                      <span className="text-xs">Thumbnail indisponível</span>
                    </div>
                  )}

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] backdrop-blur-md">
                      {item.category || "Sem Categoria"}
                    </Badge>
                    <h3 className="line-clamp-2 text-sm font-bold leading-snug text-white transition-colors group-hover:text-purple-300">
                      {item.title}
                    </h3>
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex h-14 w-14 scale-90 items-center justify-center rounded-full bg-purple-600 text-white shadow-2xl transition-transform group-hover:scale-100">
                      <Play size={24} fill="currentColor" className="ml-1" />
                    </div>
                  </div>

                  <div className="absolute top-4 right-4">
                    <Badge
                      variant="secondary"
                      className="bg-black/60 backdrop-blur-md border-border text-[10px] capitalize"
                    >
                      {item.source === "pexels" ? "Pexels" : "Manual"}
                    </Badge>
                  </div>
                </div>

                <CardContent className="flex flex-1 flex-col justify-between bg-background/35 p-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Calendar size={12} />
                      {item.created_at
                        ? format(new Date(item.created_at), "dd/MM/yy", { locale: ptBR })
                        : "-"}
                    </div>
                    {item.author && (
                      <div className="text-[11px] text-muted-foreground font-medium truncate">
                        Por: {item.author}
                      </div>
                    )}
                    {item.duration_seconds ? (
                      <div className="text-[11px] text-muted-foreground">
                        Duração: {Math.floor(item.duration_seconds / 60)}:{String(item.duration_seconds % 60).padStart(2, "0")}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2 pt-4 mt-4 border-t border-border">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="flex-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      onClick={() => handlePreview(item)}
                    >
                      <Play size={14} className="mr-2" />
                      Preview
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                      onClick={() => handleDelete(item)}
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

      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) {
            setSignedUrl(null);
            setPreviewError(null);
          }
        }}
      >
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-hidden border-border bg-background p-0 shadow-2xl">
          {selectedItem && (
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="flex min-h-[420px] items-center justify-center bg-black md:col-span-2 md:min-h-[620px]">
                {loadingUrl ? (
                  <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                ) : signedUrl && !previewError ? (
                  <video
                    src={signedUrl}
                    poster={selectedItem.thumbnail_url || undefined}
                    className="max-h-[88vh] h-full w-full object-contain"
                    controls
                    autoPlay
                    playsInline
                    onError={() => setPreviewError("O arquivo do vídeo não está mais disponível na origem.")}
                  />
                ) : (
                  <div className="max-w-sm space-y-3 px-6 text-center">
                    <Video className="mx-auto h-10 w-10 text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">
                      {previewError || "Falha ao carregar vídeo"}
                    </p>
                    {selectedItem.original_url && (
                      <Button variant="outline" asChild>
                        <a href={selectedItem.original_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink size={14} />
                          Abrir na fonte
                        </a>
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="max-h-[88vh] space-y-8 overflow-y-auto border-l border-border bg-card/80 p-6 backdrop-blur-xl md:p-8">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20">
                      {selectedItem.category}
                    </Badge>
                    <h2 className="text-2xl font-space font-bold text-foreground pt-2 leading-tight">
                      {selectedItem.title}
                    </h2>
                  </div>

                  <div className="space-y-4 pt-4">
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Fonte
                      </span>
                      <span className="text-foreground font-medium flex items-center gap-2">
                        {selectedItem.source === "pexels" ? "Pexels" : "Importação Manual"}
                        {selectedItem.original_url && (
                          <a
                            href={selectedItem.original_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300"
                          >
                            <ExternalLink size={14} />
                          </a>
                        )}
                      </span>
                    </div>
                    {selectedItem.author && (
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                          Criador
                        </span>
                        <span className="text-foreground font-medium">{selectedItem.author}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">
                        Data de Importação
                      </span>
                      <span className="text-foreground font-medium">
                        {selectedItem.created_at
                          ? format(new Date(selectedItem.created_at), "PPPP", { locale: ptBR })
                          : "-"}
                      </span>
                    </div>
                  </div>
                </div>

                {selectedItem.credit && (
                  <div className="p-4 bg-muted/50 rounded-xl border border-border">
                    <p className="text-[10px] text-muted-foreground uppercase font-bold mb-2">Créditos</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{selectedItem.credit}</p>
                  </div>
                )}

                <div className="pt-8">
                  <Button
                    variant="outline"
                    className="w-full h-12 border-border hover:bg-red-500/10 hover:text-red-500 transition-all group"
                    onClick={() => {
                      handleDelete(selectedItem);
                      setIsPreviewOpen(false);
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-2 group-hover:scale-110 transition-transform" />
                    Remover da Biblioteca
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
