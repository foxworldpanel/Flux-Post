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
    try {
      const url = await contentService.getSignedUrl(item.storage_path);
      setSignedUrl(url);
    } catch (error) {
      toast.error("Erro ao carregar preview");
    } finally {
      setLoadingUrl(false);
    }
  };

  const handleDelete = async (item: ContentLibrary) => {
    if (!confirm("Deseja realmente remover este conteúdo da biblioteca?")) return;

    try {
      // 1. Storage
      const { error: storageError } = await supabase.storage
        .from("content-library")
        .remove([item.storage_path]);

      if (storageError) console.warn("Erro ao remover arquivo (prosseguindo):", storageError);

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
      <div className="space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-space font-bold text-foreground mb-2">
              Biblioteca de Conteúdo
            </h1>
            <p className="text-muted-foreground">
              Gerencie seus vídeos importados e processados para campanhas.
            </p>
          </div>
          <Button
            onClick={() => (window.location.href = "/garimpo")}
            className="bg-[#7C3AED] hover:bg-[#6D28D9] gap-2 h-12 px-6 font-bold shadow-lg shadow-purple-500/20"
          >
            <Search size={18} />
            Garimpar Conteúdo
          </Button>
        </div>

        {/* Filtros */}
        <div className="bg-card p-4 rounded-2xl border border-border grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
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
          <div className="flex items-center justify-end">
            <p className="text-xs text-slate-500 font-medium">
              {filteredItems.length} itens encontrados
            </p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
            <p className="text-slate-500 max-w-sm mb-8">
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {filteredItems.map((item) => (
              <Card
                key={item.id}
                className="bg-card border-border hover:border-purple-500/30 transition-all duration-300 overflow-hidden group flex flex-col"
              >
                <div
                  className="relative aspect-[9/16] bg-black cursor-pointer overflow-hidden"
                  onClick={() => handlePreview(item)}
                >
                  <div className="absolute inset-0 flex items-center justify-center bg-muted/50 group-hover:bg-transparent transition-colors">
                    <Video className="w-12 h-12 text-foreground/10 group-hover:scale-110 transition-transform duration-500" />
                  </div>

                  {/* Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent opacity-60 group-hover:opacity-100 transition-opacity" />

                  <div className="absolute bottom-4 left-4 right-4 space-y-2">
                    <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-[10px] backdrop-blur-md">
                      {item.category || "Sem Categoria"}
                    </Badge>
                    <h3 className="text-foreground font-bold text-sm line-clamp-2 leading-snug group-hover:text-purple-400 transition-colors">
                      {item.title}
                    </h3>
                  </div>

                  {/* Play Button Overlay */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-14 h-14 rounded-full bg-purple-600 flex items-center justify-center text-foreground shadow-2xl transform scale-90 group-hover:scale-100 transition-transform">
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

                <CardContent className="p-4 bg-[#0A0A0F]/50 flex-1 flex flex-col justify-between">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-[11px] text-slate-500">
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
          if (!open) setSignedUrl(null);
        }}
      >
        <DialogContent className="max-w-4xl bg-[#0A0A0F] border-border p-0 overflow-hidden shadow-2xl">
          {selectedItem && (
            <div className="grid grid-cols-1 md:grid-cols-3">
              <div className="md:col-span-2 bg-black flex items-center justify-center min-h-[500px]">
                {loadingUrl ? (
                  <Loader2 className="w-10 h-10 animate-spin text-purple-500" />
                ) : signedUrl ? (
                  <video src={signedUrl} className="max-h-[85vh] w-full" controls autoPlay />
                ) : (
                  <p className="text-slate-500">Falha ao carregar vídeo</p>
                )}
              </div>
              <div className="p-8 space-y-8 bg-card/80 backdrop-blur-xl border-l border-border">
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
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
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
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                          Criador
                        </span>
                        <span className="text-foreground font-medium">{selectedItem.author}</span>
                      </div>
                    )}
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-widest">
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
                    <p className="text-[10px] text-slate-500 uppercase font-bold mb-2">Créditos</p>
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
