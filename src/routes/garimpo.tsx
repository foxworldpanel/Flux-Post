import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Play, Check, Loader2, Trash2, RotateCw, Settings, Info, Plus, X } from "lucide-react";
import { contentService } from "@/services/content";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
  const [importingId, setImportingId] = useState<string | null>(null);

  // Settings state
  const [settings, setSettings] = useState<any>(null);
  const [discoveryCategories, setDiscoveryCategories] = useState<any[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);

  const categories = ["Receitas", "Natureza", "Satisfying", "Animais", "Lifestyle", "Viagens", "Humor/Memes", "Carros", "Fitness", "Curiosidades", "Relaxante", "Outros"];

  const fetchData = async () => {
    if (activeTab === "candidatos") {
      setLoadingCandidates(true);
      const { data } = await supabase.from('content_candidates').select('*').eq('status', 'pendente').order('discovered_at', { ascending: false });
      setCandidates(data || []);
      setLoadingCandidates(false);
    } else if (activeTab === "automacao") {
      setLoadingSettings(true);
      const { data: s } = await supabase.from('content_discovery_settings').select('*').maybeSingle();
      const { data: c } = await supabase.from('content_discovery_categories').select('*').order('name');
      
      if (!s) {
        // Seed initial settings
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: newSettings } = await supabase.from('content_discovery_settings').insert({ user_id: user.id, target_stock: 100 }).select().single();
          setSettings(newSettings);
        }
      } else {
        setSettings(s);
      }
      setDiscoveryCategories(c || []);
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
      const data = await contentService.searchPexels({ query, orientation: orientation === "all" ? undefined : orientation });
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
      await contentService.importPexelsVideo({ videoId: vidId, category: video.category || category, candidateId });
      toast.success("Importado com sucesso!");
      if (candidateId) fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setImportingId(null);
    }
  };

  const handleDiscard = async (id: string) => {
    try {
      await contentService.discardCandidate(id);
      fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const updateSettings = async (updates: any) => {
    try {
      const { error } = await supabase.from('content_discovery_settings').update(updates).eq('id', settings.id);
      if (error) throw error;
      setSettings({ ...settings, ...updates });
      toast.success("Configurações salvas");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  const addCategory = async (name: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from('content_discovery_categories').insert({ user_id: user?.id, name, target_count: 10 });
      if (error) throw error;
      fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2">Garimpo</h1>
            <p className="text-slate-400">Descubra, importe e automatize seu estoque de conteúdo.</p>
          </div>
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1">
            Phase 2.2 Operational
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#13131F] border border-white/5 p-1">
            <TabsTrigger value="buscar" className="px-8 data-[state=active]:bg-purple-600">BUSCAR</TabsTrigger>
            <TabsTrigger value="candidatos" className="px-8 data-[state=active]:bg-purple-600">
              CANDIDATOS 
              {candidates.length > 0 && <Badge className="ml-2 bg-purple-500">{candidates.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="automacao" className="px-8 data-[state=active]:bg-purple-600">AUTOMAÇÃO</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-6">
             <div className="bg-[#13131F] p-6 rounded-2xl border border-white/5 grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
              <div className="md:col-span-6 space-y-2">
                <label className="text-sm font-medium text-slate-400">Palavra-chave</label>
                <Input className="bg-white/5 border-white/10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Ex: chocolate cake..." />
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-400">Orientação</label>
                <Select value={orientation} onValueChange={(v: any) => setOrientation(v)}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Todas</SelectItem><SelectItem value="portrait">Vertical</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="md:col-span-2 space-y-2">
                <label className="text-sm font-medium text-slate-400">Destino</label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="bg-white/5 border-white/10"><SelectValue /></SelectTrigger>
                  <SelectContent>{categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button onClick={handleSearch} className="md:col-span-2 bg-purple-600 hover:bg-purple-700 h-10" disabled={loading}>
                {loading ? <Loader2 className="animate-spin" /> : "Buscar"}
              </Button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {results.map(video => (
                <Card key={video.id} className="bg-[#13131F] border-white/5 overflow-hidden group">
                  <div className="aspect-[9/16] relative overflow-hidden">
                    <img src={video.image} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                        <Button size="icon" variant="secondary" className="rounded-full" onClick={() => setSelectedVideo(video)}><Play className="fill-white"/></Button>
                    </div>
                  </div>
                  <CardContent className="p-4 flex gap-2">
                    <Button className="w-full bg-purple-600" disabled={importingId === video.id.toString()} onClick={() => handleApprove(video)}>
                        {importingId === video.id.toString() ? <Loader2 className="animate-spin" /> : "Aprovar"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {candidates.length > 0 ? candidates.map(cand => (
                <Card key={cand.id} className="bg-[#13131F] border-white/5 overflow-hidden">
                  <div className="aspect-[9/16] relative">
                    <img src={cand.preview_url} className="w-full h-full object-cover" />
                    <div className="absolute top-2 left-2">
                      <Badge className="bg-black/60 backdrop-blur-md">{cand.category}</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Termo: {cand.search_term}</span>
                      <span>{cand.duration}s</span>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700" disabled={importingId === cand.id} onClick={() => handleApprove(cand, cand.id)}>
                        {importingId === cand.id ? <Loader2 className="animate-spin" /> : <Check className="w-4 h-4" />}
                      </Button>
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDiscard(cand.id)}><Trash2 className="w-4 h-4" /></Button>
                    </div>
                  </CardContent>
                </Card>
              )) : (
                <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                  <Info className="w-12 h-12 text-slate-700 mx-auto mb-4" />
                  <p className="text-slate-500">Nenhum candidato aguardando revisão.</p>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="automacao" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2 space-y-6">
                <Card className="bg-[#13131F] border-white/5">
                  <CardHeader><CardTitle>Configurações Gerais</CardTitle></CardHeader>
                  <CardContent className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Estoque Alvo Total</label>
                      <Input type="number" value={settings?.target_stock} onChange={e => updateSettings({ target_stock: parseInt(e.target.value) })} className="bg-white/5 border-white/10" />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm text-slate-400">Máximo por Execução</label>
                      <Input type="number" value={settings?.max_per_execution} onChange={e => updateSettings({ max_per_execution: parseInt(e.target.value) })} className="bg-white/5 border-white/10" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-[#13131F] border-white/5">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Categorias e Metas</CardTitle>
                    <Button size="sm" variant="outline" className="border-white/10" onClick={() => addCategory("Nova Categoria")}><Plus className="w-4 h-4 mr-2" /> Adicionar</Button>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {discoveryCategories.map(cat => (
                      <div key={cat.id} className="p-4 bg-white/5 rounded-xl border border-white/5 grid grid-cols-12 gap-4 items-center">
                        <div className="col-span-4 font-bold text-white">{cat.name}</div>
                        <div className="col-span-3">
                          <Input type="number" value={cat.target_count} onChange={async (e) => {
                            const val = parseInt(e.target.value);
                            await supabase.from('content_discovery_categories').update({ target_count: val }).eq('id', cat.id);
                            fetchData();
                          }} className="bg-black/20 border-white/5" placeholder="Meta" />
                        </div>
                        <div className="col-span-4 text-xs text-slate-500">
                          Termos: {(cat.search_terms || []).join(', ')}
                        </div>
                        <div className="col-span-1 flex justify-end">
                           <Button size="icon" variant="ghost" className="text-rose-500" onClick={async () => {
                             await supabase.from('content_discovery_categories').delete().eq('id', cat.id);
                             fetchData();
                           }}><X className="w-4 h-4"/></Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="bg-gradient-to-br from-purple-600/20 to-transparent border-purple-500/20">
                  <CardHeader><CardTitle className="text-purple-400">Execução</CardTitle></CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-slate-400">O sistema buscará candidatos automaticamente com base nas metas acima.</p>
                    <Button onClick={() => {
                      toast.loading("Executando garimpo...");
                      contentService.runDiscovery().then(res => {
                        toast.success(res.message, { id: "discovery" });
                        fetchData();
                      }).catch(err => toast.error(err.message));
                    }} className="w-full bg-purple-600 hover:bg-purple-700 h-12 font-bold shadow-lg shadow-purple-500/20">
                      <RotateCw className="w-4 h-4 mr-2" /> EXECUTAR GARIMPO AGORA
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedVideo} onOpenChange={() => setSelectedVideo(null)}>
          <DialogContent className="max-w-4xl bg-[#0A0A0F] border-white/10 p-0 overflow-hidden">
             {selectedVideo && (
               <video 
                src={selectedVideo.video_files?.find((f: any) => f.height > f.width)?.link || selectedVideo.video_files?.[0]?.link} 
                controls 
                autoPlay 
                className="w-full max-h-[80vh]" 
               />
             )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
