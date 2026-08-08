import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Play, Check, Loader2, ExternalLink, Library, ChevronLeft, ChevronRight, Filter, Settings, Trash2 } from "lucide-react";
import { contentService } from "@/services/content";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function GarimpoPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("buscar");
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | "square" | "all">("portrait");
  const [category, setCategory] = useState("Outros");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [importingId, setImportingId] = useState<number | null>(null);
  const [importedIds, setImportedIds] = useState<Set<number>>(new Set());

  const categories = ["Receitas", "Natureza", "Satisfying", "Animais", "Lifestyle", "Viagens", "Humor/Memes", "Carros", "Fitness", "Curiosidades", "Relaxante", "Outros"];

  const handleSearch = async (resetPage = true) => {
    if (!query) return toast.error("Digite um termo");
    setLoading(true);
    const currentPage = resetPage ? 1 : page;
    if (resetPage) setPage(1);

    try {
      const data = await contentService.searchPexels({ query, orientation: orientation === "all" ? undefined : orientation, page: currentPage, per_page: 20 });
      setResults(data.videos || []);
      setTotalResults(data.total_results || 0);
    } catch (err: any) {
      toast.error("Erro ao buscar: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async (video: any) => {
    setImportingId(video.id);
    try {
      await contentService.importPexelsVideo({ videoId: video.id, category });
      setImportedIds(prev => new Set([...prev, video.id]));
      toast.success("Importado com sucesso!");
      setSelectedVideo(null);
    } catch (err: any) {
      toast.error("Erro na importação: " + err.message);
    } finally {
      setImportingId(null);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8">
        <div>
          <h1 className="text-4xl font-bold text-white mb-2">Garimpo</h1>
          <p className="text-slate-400">Descubra, importe e automatize seu estoque de conteúdo.</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#13131F] border border-white/5">
            <TabsTrigger value="buscar" className="px-6">BUSCAR</TabsTrigger>
            <TabsTrigger value="candidatos" className="px-6">CANDIDATOS</TabsTrigger>
            <TabsTrigger value="automacao" className="px-6">AUTOMAÇÃO</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-6">
            <div className="bg-[#13131F] p-6 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-12 gap-4">
              <Input className="md:col-span-6 bg-white/5 border-white/10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Termo de busca..." />
              <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                <SelectTrigger className="md:col-span-2 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="portrait">Vertical</SelectItem></SelectContent>
              </Select>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="md:col-span-2 bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
              <Button className="md:col-span-2 bg-purple-600" onClick={() => handleSearch()} disabled={loading}>{loading ? <Loader2 className="animate-spin" /> : "Buscar"}</Button>
            </div>
            
            <div className="grid grid-cols-4 gap-6">
              {results.map(video => (
                <Card key={video.id} className="bg-[#13131F] border-white/5 overflow-hidden">
                  <div className="aspect-[9/16] relative group">
                    <img src={video.image} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                        <Button size="icon" onClick={() => setSelectedVideo(video)}><Play/></Button>
                    </div>
                  </div>
                  <CardContent className="p-4">
                    <Button className="w-full" disabled={importedIds.has(video.id)} onClick={() => handleImport(video)}>
                        {importedIds.has(video.id) ? "Importado" : "Aprovar"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="candidatos">
            <div className="p-8 text-center text-slate-500 border border-dashed border-white/10 rounded-3xl">
              Fila de candidatos pendente de revisão.
            </div>
          </TabsContent>

          <TabsContent value="automacao">
            <Card className="bg-[#13131F] border-white/5">
                <CardHeader>
                    <CardTitle>Configuração do Garimpo Automático</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <Button onClick={() => contentService.runDiscovery()} className="bg-purple-600">EXECUTAR GARIMPO AGORA</Button>
                </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl bg-[#0A0A0F] border-white/10">
             {selectedVideo && <video src={selectedVideo.video_files[0]?.link} controls className="w-full" />}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
