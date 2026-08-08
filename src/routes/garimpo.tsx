import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Play, Check, Loader2, Library, ChevronLeft, ChevronRight, Filter, Trash2, RotateCw, Eye } from "lucide-react";
import { contentService } from "@/services/content";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export default function GarimpoPage() {
  const [activeTab, setActiveTab] = useState("buscar");
  const [query, setQuery] = useState("");
  const [orientation, setOrientation] = useState<"landscape" | "portrait" | "square" | "all">("portrait");
  const [category, setCategory] = useState("Outros");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);

  const fetchCandidates = async () => {
    setLoadingCandidates(true);
    const { data } = await supabase.from('content_candidates').select('*').eq('status', 'pendente');
    setCandidates(data || []);
    setLoadingCandidates(false);
  };

  useEffect(() => {
    if (activeTab === "candidatos") fetchCandidates();
  }, [activeTab]);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const data = await contentService.searchPexels({ query, orientation: orientation === "all" ? undefined : orientation });
      setResults(data.videos || []);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (video: any, candidateId?: string) => {
    try {
      toast.loading("Importando...");
      await contentService.importPexelsVideo({ videoId: video.id || parseInt(video.external_id), category: video.category || category, candidateId });
      toast.success("Importado!");
      if (candidateId) fetchCandidates();
      setSelectedVideo(null);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8">
        <h1 className="text-4xl font-bold text-white">Garimpo</h1>
        
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-[#13131F]">
            <TabsTrigger value="buscar">BUSCAR</TabsTrigger>
            <TabsTrigger value="candidatos">CANDIDATOS</TabsTrigger>
            <TabsTrigger value="automacao">AUTOMAÇÃO</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-6">
            <div className="bg-[#13131F] p-6 rounded-2xl grid grid-cols-12 gap-4">
              <Input className="col-span-6 bg-white/5" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Button onClick={handleSearch} className="col-span-2">Buscar</Button>
            </div>
            <div className="grid grid-cols-4 gap-6">
              {results.map(video => (
                <Card key={video.id} className="bg-[#13131F]">
                  <img src={video.image} className="aspect-[9/16] w-full object-cover" />
                  <CardContent className="p-4">
                    <Button onClick={() => handleApprove(video)} className="w-full">Aprovar</Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="candidatos">
            <div className="grid grid-cols-4 gap-6">
              {candidates.map(cand => (
                <Card key={cand.id} className="bg-[#13131F]">
                  <img src={cand.preview_url} className="aspect-[9/16] w-full object-cover" />
                  <CardContent className="p-4 flex gap-2">
                    <Button size="sm" className="flex-1" onClick={() => handleApprove(cand, cand.id)}><Check /></Button>
                    <Button size="sm" variant="destructive" className="flex-1" onClick={() => contentService.discardCandidate(cand.id).then(fetchCandidates)}><Trash2 /></Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="automacao">
            <Card className="bg-[#13131F] p-6">
                <Button onClick={() => contentService.runDiscovery().then(() => toast.success("Garimpo rodado!"))} className="bg-purple-600">
                    <RotateCw className="mr-2" /> EXECUTAR GARIMPO AGORA
                </Button>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
