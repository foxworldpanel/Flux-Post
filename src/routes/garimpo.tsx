import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Check, Loader2, Trash2, RotateCw, Plus, X, Search, Info } from "lucide-react";
import { contentService, DiscoverySettings, DiscoveryCategory, ContentCandidate, DiscoveryReport } from "@/services/content";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";

export default function GarimpoPage() {
  const [activeTab, setActiveTab] = useState("buscar");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<ContentCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<any | null>(null);
  const [importingId, setImportingId] = useState<string | null>(null);

  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [discoveryCategories, setDiscoveryCategories] = useState<DiscoveryCategory[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const fetchData = async () => {
    if (activeTab === "candidatos") {
      setLoadingCandidates(true);
      const { data } = await supabase.from('content_candidates').select('*').eq('status', 'pendente').order('discovered_at', { ascending: false });
      setCandidates((data as ContentCandidate[]) || []);
      setLoadingCandidates(false);
    } else if (activeTab === "automacao") {
      setLoadingSettings(true);
      const { data: s } = await supabase.from('content_discovery_settings').select('*').maybeSingle();
      const { data: c } = await supabase.from('content_discovery_categories').select('*').order('name');
      
      setSettings(s as DiscoverySettings);
      setDiscoveryCategories((c as DiscoveryCategory[]) || []);
      setLoadingSettings(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleSearch = async () => {
    if (!query) return toast.error("Digite um termo");
    setLoading(true);
    try {
      const data = await contentService.searchPexels({ query, orientation: 'portrait' });
      setResults(data.videos || []);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (video: any, candidateId?: string) => {
    const vidId = video.id || (video.metadata?.pexels_id) || parseInt(video.external_id);
    setImportingId(candidateId || vidId.toString());
    try {
      await contentService.importPexelsVideo({ videoId: vidId, category: video.category || "Outros", candidateId });
      toast.success("Importado com sucesso!");
      if (candidateId) fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setImportingId(null);
    }
  };

  const updateSettings = async (updates: Partial<DiscoverySettings>) => {
    if (!settings) return;
    const { error } = await supabase.from('content_discovery_settings').update(updates).eq('id', settings.id);
    if (error) return toast.error(error.message);
    setSettings({ ...settings, ...updates });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Garimpo</h1>
            <p className="text-slate-400">Automação de estoque com Pexels.</p>
          </div>
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1">Phase 2.2</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#13131F] border border-white/5 p-1">
            <TabsTrigger value="buscar" className="px-8 data-[state=active]:bg-purple-600">BUSCAR</TabsTrigger>
            <TabsTrigger value="candidatos" className="px-8 data-[state=active]:bg-purple-600">CANDIDATOS {candidates.length}</TabsTrigger>
            <TabsTrigger value="automacao" className="px-8 data-[state=active]:bg-purple-600">AUTOMAÇÃO</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-6">
             <div className="bg-[#13131F] p-6 rounded-2xl border border-white/5 flex gap-4">
                <Input className="bg-white/5 border-white/10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: chocolate cake..." />
                <Button onClick={handleSearch} disabled={loading} className="bg-purple-600"><Search className="w-4 h-4 mr-2" /> Buscar</Button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
               {results.map(video => (
                 <Card key={video.id} className="bg-[#13131F] border-white/5 overflow-hidden group">
                   <div className="aspect-[9/16] relative">
                     <img src={video.image} className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                       <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setSelectedVideo(video)}><Play className="fill-white"/></Button>
                     </div>
                   </div>
                   <CardContent className="p-4"><Button className="w-full" onClick={() => handleApprove(video)}>Aprovar</Button></CardContent>
                 </Card>
               ))}
             </div>
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              {candidates.map(cand => (
                <Card key={cand.id} className="bg-[#13131F] border-white/5 overflow-hidden">
                  <div className="aspect-[9/16] relative">
                    <img src={cand.preview_url} className="w-full h-full object-cover" />
                  </div>
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs text-slate-400">{cand.category} • {cand.duration}s</p>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1" onClick={() => handleApprove(cand, cand.id)}><Check className="w-4 h-4" /></Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => contentService.discardCandidate(cand.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="automacao" className="space-y-6">
             <div className="grid grid-cols-2 gap-8">
                <Card className="bg-[#13131F] border-white/5">
                  <CardHeader><CardTitle>Configurações</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                     <label className="text-sm">Estoque Alvo</label>
                     <Input type="number" value={settings?.target_stock} onChange={e => updateSettings({ target_stock: parseInt(e.target.value) })} />
                  </CardContent>
                </Card>
                <Card className="bg-[#13131F] border-white/5">
                  <CardHeader><CardTitle>Execução</CardTitle></CardHeader>
                  <CardContent>
                    <Button onClick={async () => {
                       const res = await contentService.runDiscovery();
                       toast.success(res.message);
                       fetchData();
                    }} className="w-full bg-purple-600"><RotateCw className="mr-2" /> EXECUTAR AGORA</Button>
                  </CardContent>
                </Card>
             </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl bg-[#0A0A0F] border-white/10 p-0 overflow-hidden">
             {selectedVideo && (
               <video src={selectedVideo.video_files?.find((f: any) => f.height > f.width)?.link} controls autoPlay className="w-full max-h-[80vh]" />
             )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}