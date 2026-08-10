import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Play, Check, Loader2, Trash2, RotateCw, Plus, X, Search, Eye, Filter, CheckCircle2, XCircle, Clock, Video, Maximize2, Monitor, User } from "lucide-react";
import { contentService, DiscoverySettings, DiscoveryCategory, ContentCandidate, DiscoveryReport } from "@/services/content";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export default function GarimpoPage() {
  const [activeTab, setActiveTab] = useState("buscar");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<ContentCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ContentCandidate | null>(null);
  const [candidateFilter, setCandidateFilter] = useState<'pendente' | 'aprovado' | 'descartado'>('pendente');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedExternalIds, setImportedExternalIds] = useState<Set<string>>(new Set());

  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [discoveryCategories, setDiscoveryCategories] = useState<DiscoveryCategory[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [lastReport, setLastReport] = useState<DiscoveryReport | null>(null);

  // Filters state
  const [filterOrientation, setFilterOrientation] = useState<string>("portrait");
  const [filterDuration, setFilterDuration] = useState<string>("all");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("none");

  const fetchData = async () => {
    // Load imported IDs for deduplication display
    const library = await contentService.getLibrary();
    const ids = new Set(library.map(item => item.metadata?.pexels_id?.toString()).filter(Boolean));
    setImportedExternalIds(ids as Set<string>);

    if (activeTab === "candidatos") {
      setLoadingCandidates(true);
      const { data, error } = await supabase
        .from('content_candidates')
        .select('*')
        .eq('status', candidateFilter)
        .order('discovered_at', { ascending: false });
      
      if (error) toast.error(error.message);
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
  }, [activeTab, candidateFilter]);

  const handleSearch = async () => {
    if (!query) return toast.error("Digite um termo");
    setLoading(true);
    try {
      const data = await contentService.searchPexels({ 
        query, 
        orientation: filterOrientation as any 
      });
      setResults(data.videos || []);
      if (data.videos?.length === 0) toast.info("Nenhum vídeo encontrado.");
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `0:${secs.toString().padStart(2, '0')}`;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getResolutionInfo = (video: any) => {
    const portrait = video.video_files?.find((f: any) => f.height > f.width) || video.video_files?.[0];
    if (portrait) {
      return {
        width: portrait.width,
        height: portrait.height,
        quality: portrait.quality // 'hd', 'sd', etc.
      };
    }
    return { width: video.width, height: video.height, quality: 'hd' };
  };

  const filteredResults = results.filter(video => {
    // Duration filter
    if (filterDuration !== "all") {
      const d = video.duration;
      if (filterDuration === "15" && d > 15) return false;
      if (filterDuration === "15-30" && (d < 15 || d > 30)) return false;
      if (filterDuration === "30-60" && (d < 30 || d > 60)) return false;
      if (filterDuration === "60+" && d < 60) return false;
    }
    
    // Quality filter
    if (filterQuality !== "all") {
      const res = getResolutionInfo(video);
      if (filterQuality === "hd+" && res.height < 720) return false;
      if (filterQuality === "fullhd+" && res.height < 1080) return false;
    }

    return true;
  }).sort((a, b) => {
    if (sortBy === "short") return a.duration - b.duration;
    if (sortBy === "long") return b.duration - a.duration;
    return 0;
  });

  const handleApprove = async (item: any, candidateId?: string) => {
    const vidId = item.id || (item.metadata?.pexels_id) || parseInt(item.external_id);
    setImportingId(candidateId || vidId.toString());
    try {
      await contentService.importPexelsVideo({ 
        videoId: vidId, 
        category: item.category || "Outros", 
        candidateId 
      });
      toast.success("Importado com sucesso!");
      if (candidateId) fetchData();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setImportingId(null);
      if (selectedCandidate?.id === candidateId) setSelectedCandidate(null);
    }
  };

  const updateSettings = async (updates: Partial<DiscoverySettings>) => {
    if (!settings) return;
    const { error } = await supabase.from('content_discovery_settings').update(updates).eq('id', settings.id);
    if (error) return toast.error(error.message);
    setSettings({ ...settings, ...updates });
    toast.success("Configurações atualizadas");
  };

  const handleAddCategory = async () => {
    const name = prompt("Nome da categoria:");
    if (!name) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from('content_discovery_categories').insert({
      user_id: user.id,
      name,
      target_count: 50,
      is_active: true,
      search_terms: [name.toLowerCase()]
    });

    if (error) toast.error(error.message);
    else fetchData();
  };

  const handleUpdateCategory = async (id: string, updates: Partial<DiscoveryCategory>) => {
    const { error } = await supabase.from('content_discovery_categories').update(updates).eq('id', id);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const handleRemoveCategory = async (id: string) => {
    if (!confirm("Remover esta categoria?")) return;
    const { error } = await supabase.from('content_discovery_categories').delete().eq('id', id);
    if (error) toast.error(error.message);
    else fetchData();
  };

  const handleUpdateTerms = async (id: string, termsString: string) => {
    const search_terms = termsString.split(',').map(t => t.trim()).filter(t => t.length > 0);
    handleUpdateCategory(id, { search_terms });
  };

  const getStatusIcon = (status: string) => {
    switch(status) {
      case 'aprovado': return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
      case 'descartado': return <XCircle className="w-4 h-4 text-rose-400" />;
      default: return <Clock className="w-4 h-4 text-amber-400" />;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-space">Garimpo</h1>
            <p className="text-slate-400">Automação de estoque inteligente e curadoria.</p>
          </div>
          <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1">Fase 2.2 Consolidada</Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#13131F] border border-white/5 p-1">
            <TabsTrigger value="buscar" className="px-8 data-[state=active]:bg-purple-600">BUSCAR</TabsTrigger>
            <TabsTrigger value="candidatos" className="px-8 data-[state=active]:bg-purple-600">FILA ({candidates.length})</TabsTrigger>
            <TabsTrigger value="automacao" className="px-8 data-[state=active]:bg-purple-600">ESTRATÉGIA</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-6">
             <div className="bg-[#13131F] p-6 rounded-2xl border border-white/5 flex gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <Input 
                    className="bg-white/5 border-white/10 pl-10" 
                    value={query} 
                    onChange={(e) => setQuery(e.target.value)} 
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Pesquisar no Pexels..." 
                  />
                </div>
                <Button onClick={handleSearch} disabled={loading} className="bg-purple-600">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                  Buscar
                </Button>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {results.map(video => (
                 <Card key={video.id} className="bg-[#13131F] border-white/5 overflow-hidden group">
                   <div className="aspect-[9/16] relative bg-slate-900">
                     <img src={video.image} className="w-full h-full object-cover" />
                     <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                       <Button size="icon" variant="secondary" className="rounded-full h-12 w-12" onClick={() => setSelectedCandidate({
                         id: 'new',
                         source: 'pexels',
                         external_id: video.id.toString(),
                         preview_url: video.image,
                         original_url: video.url,
                         duration: video.duration,
                         author: video.user.name,
                         category: 'Manual',
                         status: 'pendente',
                         metadata: video,
                         user_id: '',
                         discovered_at: new Date().toISOString()
                       })}><Eye className="w-6 h-6"/></Button>
                     </div>
                   </div>
                   <CardContent className="p-4">
                     <Button 
                       className="w-full bg-purple-600" 
                       disabled={importingId === video.id.toString()}
                       onClick={() => handleApprove(video)}
                     >
                       {importingId === video.id.toString() ? <Loader2 className="w-4 h-4 animate-spin" /> : "Importar Agora"}
                     </Button>
                   </CardContent>
                 </Card>
               ))}
             </div>
          </TabsContent>

          <TabsContent value="candidatos" className="space-y-6">
            <div className="flex justify-between items-center bg-[#13131F] p-4 rounded-xl border border-white/5">
              <div className="flex gap-2">
                <Button 
                  variant={candidateFilter === 'pendente' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setCandidateFilter('pendente')}
                  className={candidateFilter === 'pendente' ? 'bg-purple-600' : ''}
                >Pendentes</Button>
                <Button 
                  variant={candidateFilter === 'aprovado' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setCandidateFilter('aprovado')}
                  className={candidateFilter === 'aprovado' ? 'bg-emerald-600' : ''}
                >Aprovados</Button>
                <Button 
                  variant={candidateFilter === 'descartado' ? 'default' : 'ghost'} 
                  size="sm"
                  onClick={() => setCandidateFilter('descartado')}
                  className={candidateFilter === 'descartado' ? 'bg-rose-600' : ''}
                >Descartados</Button>
              </div>
              <p className="text-xs text-slate-500 font-mono">Exibindo {candidates.length} registros</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {candidates.map(cand => (
                <Card key={cand.id} className="bg-[#13131F] border-white/5 overflow-hidden group">
                  <div className="aspect-[9/16] relative bg-slate-900">
                    <img src={cand.preview_url} className="w-full h-full object-cover" />
                    <div className="absolute top-2 right-2">
                       <Badge className="bg-black/60 backdrop-blur-md border-white/10">{cand.duration}s</Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs font-bold text-purple-400 uppercase">{cand.category}</p>
                        <p className="text-[10px] text-slate-500 mt-1 truncate max-w-[140px]">De: {cand.author}</p>
                      </div>
                      {getStatusIcon(cand.status)}
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="secondary" 
                        className="flex-1 bg-white/5 hover:bg-white/10" 
                        onClick={() => setSelectedCandidate(cand)}
                      >
                        VISUALIZAR
                      </Button>
                      {cand.status === 'pendente' && (
                        <Button 
                          size="icon" 
                          variant="destructive" 
                          className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20"
                          onClick={() => {
                            contentService.discardCandidate(cand.id);
                            fetchData();
                            toast.info("Descartado");
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="automacao" className="space-y-6">
             <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 space-y-6">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-bold text-white font-space">Categorias & Metas</h2>
                    <Button onClick={handleAddCategory} variant="outline" size="sm" className="border-purple-500/30 text-purple-400">
                      <Plus className="w-4 h-4 mr-2" /> Adicionar Categoria
                    </Button>
                  </div>

                  <div className="space-y-4">
                    {discoveryCategories.map(cat => (
                      <Card key={cat.id} className="bg-[#13131F] border-white/5">
                        <CardContent className="p-6">
                          <div className="flex flex-col gap-6">
                            <div className="flex justify-between items-start">
                              <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="text-lg font-bold text-white">{cat.name}</h3>
                                  <Badge className={cat.is_active ? "bg-emerald-500/10 text-emerald-400" : "bg-slate-500/10 text-slate-400"}>
                                    {cat.is_active ? "Ativa" : "Inativa"}
                                  </Badge>
                                </div>
                                <p className="text-xs text-slate-500">Déficit: {Math.max(0, (cat.target_count || 0))} unidades</p>
                              </div>
                              <div className="flex gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleUpdateCategory(cat.id, { is_active: !cat.is_active })}>
                                  <RotateCw className="w-4 h-4" />
                                </Button>
                                <Button size="icon" variant="ghost" className="text-rose-500" onClick={() => handleRemoveCategory(cat.id)}>
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                               <div className="space-y-2">
                                  <label className="text-xs text-slate-500 font-bold uppercase">Meta de Estoque</label>
                                  <Input 
                                    type="number" 
                                    className="bg-white/5" 
                                    defaultValue={cat.target_count} 
                                    onBlur={(e) => handleUpdateCategory(cat.id, { target_count: parseInt(e.target.value) })}
                                  />
                               </div>
                               <div className="space-y-2">
                                  <label className="text-xs text-slate-500 font-bold uppercase">Termos de Busca (CSV)</label>
                                  <Input 
                                    className="bg-white/5" 
                                    defaultValue={cat.search_terms?.join(', ')} 
                                    onBlur={(e) => handleUpdateTerms(cat.id, e.target.value)}
                                    placeholder="termo 1, termo 2..."
                                  />
                               </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                   <Card className="bg-[#13131F] border-white/5">
                      <CardHeader><CardTitle>Parâmetros Globais</CardTitle></CardHeader>
                      <CardContent className="space-y-6">
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Capacidade de Execução</label>
                            <Input 
                              type="number" 
                              value={settings?.max_per_execution} 
                              onChange={e => updateSettings({ max_per_execution: parseInt(e.target.value) })} 
                            />
                            <p className="text-[10px] text-slate-500">Máximo de vídeos importados por rodada.</p>
                         </div>
                         <div className="space-y-2">
                            <label className="text-sm font-medium">Orientação Preferencial</label>
                            <Select 
                              value={settings?.default_orientation} 
                              onValueChange={(val: any) => updateSettings({ default_orientation: val })}
                            >
                              <SelectTrigger className="bg-white/5">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Todas</SelectItem>
                                <SelectItem value="portrait">Vertical (Portrait)</SelectItem>
                                <SelectItem value="landscape">Horizontal (Landscape)</SelectItem>
                              </SelectContent>
                            </Select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                               <label className="text-xs text-slate-500">Duração Mín (s)</label>
                               <Input type="number" value={settings?.min_duration} onChange={e => updateSettings({ min_duration: parseInt(e.target.value) })} />
                            </div>
                            <div className="space-y-2">
                               <label className="text-xs text-slate-500">Duração Máx (s)</label>
                               <Input type="number" value={settings?.max_duration} onChange={e => updateSettings({ max_duration: parseInt(e.target.value) })} />
                            </div>
                         </div>
                      </CardContent>
                   </Card>

                   <Card className="bg-purple-600/10 border-purple-500/20">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <RotateCw className="w-4 h-4 text-purple-400" />
                          Executar Crawler
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-slate-400">Inicia a busca automática no Pexels baseada nas categorias deficitárias.</p>
                        <Button 
                          onClick={async () => {
                            setLoading(true);
                            try {
                              const res = await contentService.runDiscovery();
                              setLastReport(res);
                              toast.success(res.message);
                              fetchData();
                            } catch(e: any) {
                              toast.error(e.message);
                            } finally {
                              setLoading(false);
                            }
                          }} 
                          disabled={loading}
                          className="w-full bg-purple-600 hover:bg-purple-700"
                        >
                          {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "DISPARAR AGORA"}
                        </Button>
                      </CardContent>
                   </Card>

                   {lastReport && (
                     <Card className="bg-slate-900 border-white/5">
                       <CardHeader><CardTitle className="text-sm">Última Rodada</CardTitle></CardHeader>
                       <CardContent className="space-y-2">
                          {lastReport.summary.details.map((d, i) => (
                            <div key={i} className="flex justify-between text-xs border-b border-white/5 pb-1">
                               <span className="text-slate-400">{d.category}</span>
                               <span className={d.added > 0 ? "text-emerald-400" : "text-slate-600"}>+{d.added}</span>
                            </div>
                          ))}
                       </CardContent>
                     </Card>
                   )}
                </div>
             </div>
          </TabsContent>
        </Tabs>

        <Dialog open={!!selectedCandidate} onOpenChange={() => setSelectedCandidate(null)}>
          <DialogContent className="max-w-4xl bg-[#0A0A0F] border-white/10 p-0 overflow-hidden">
             {selectedCandidate && (
               <div className="flex flex-col md:flex-row h-full">
                  <div className="md:w-1/2 aspect-[9/16] bg-black">
                     <video 
                       src={selectedCandidate.metadata?.video_files?.find((f: any) => f.height > f.width)?.link || selectedCandidate.original_url} 
                       controls 
                       autoPlay 
                       className="w-full h-full object-contain" 
                     />
                  </div>
                  <div className="md:w-1/2 p-8 space-y-6 bg-[#0D0D15]">
                     <DialogHeader>
                        <DialogTitle className="text-2xl font-space font-bold">Detalhes do Candidato</DialogTitle>
                     </DialogHeader>
                     
                     <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                           <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Categoria</p>
                              <p className="text-white font-medium">{selectedCandidate.category}</p>
                           </div>
                           <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                              <p className="text-[10px] text-slate-500 font-bold uppercase">Duração</p>
                              <p className="text-white font-medium">{selectedCandidate.duration} segundos</p>
                           </div>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                           <p className="text-[10px] text-slate-500 font-bold uppercase">Autor / Fonte</p>
                           <p className="text-white font-medium">{selectedCandidate.author || "Pexels"}</p>
                        </div>

                        <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                           <p className="text-[10px] text-slate-500 font-bold uppercase">Status Atual</p>
                           <div className="flex items-center gap-2 mt-1">
                              {getStatusIcon(selectedCandidate.status)}
                              <span className="capitalize text-white">{selectedCandidate.status}</span>
                           </div>
                        </div>
                     </div>

                     <div className="pt-8 flex gap-3">
                        {selectedCandidate.status === 'pendente' && (
                           <>
                             <Button 
                               className="flex-1 bg-emerald-600 hover:bg-emerald-700" 
                               onClick={() => handleApprove(selectedCandidate, selectedCandidate.id)}
                               disabled={importingId === selectedCandidate.id}
                             >
                               {importingId === selectedCandidate.id ? <Loader2 className="w-4 h-4 animate-spin" /> : "APROVAR E IMPORTAR"}
                             </Button>
                             <Button 
                               variant="destructive" 
                               onClick={() => {
                                 contentService.discardCandidate(selectedCandidate.id);
                                 setSelectedCandidate(null);
                                 fetchData();
                               }}
                             >
                               DESCARTAR
                             </Button>
                           </>
                        )}
                        {selectedCandidate.status !== 'pendente' && (
                           <Button variant="outline" className="w-full" onClick={() => setSelectedCandidate(null)}>FECHAR</Button>
                        )}
                     </div>
                  </div>
               </div>
             )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
