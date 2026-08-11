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

function SkeletonCard() {
  return (
    <Card className="bg-[#13131F] border-white/5 overflow-hidden flex flex-col h-full">
      <div className="aspect-[9/16] relative bg-slate-900">
        <Skeleton className="w-full h-full rounded-none" />
      </div>
      <CardContent className="p-3 space-y-2">
        <Skeleton className="h-8 w-full" />
      </CardContent>
    </Card>
  );
}

interface VideoCardProps {
  video: any;
  onImport: (video: any) => void;
  onPreview: (video: any) => void;
  isImporting: boolean;
  isImported: boolean;
  formatDuration: (s: number) => string;
  getResolutionInfo: (v: any) => { width: number, height: number, quality: string };
  isCandidate?: boolean;
  onDiscard?: (id: string) => void;
}

function VideoCard({ 
  video, 
  onImport, 
  onPreview, 
  isImporting, 
  isImported, 
  formatDuration, 
  getResolutionInfo,
  isCandidate,
  onDiscard
}: VideoCardProps) {
  const res = getResolutionInfo(video);
  const author = video.user?.name || video.author || "Pexels";
  const duration = video.duration;

  return (
    <Card className="bg-[#13131F] border-white/5 overflow-hidden group flex flex-col h-full hover:border-purple-500/30 transition-all">
      <div 
        className="aspect-[9/16] relative bg-slate-900 cursor-pointer overflow-hidden"
        onClick={() => onPreview(video)}
      >
        <img 
          src={video.image || video.preview_url} 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
          loading="lazy"
        />
        
        {/* Hover Overlay */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="bg-white/10 backdrop-blur-md rounded-full p-3 border border-white/20 transform scale-90 group-hover:scale-100 transition-transform">
            <Play className="w-6 h-6 text-white fill-white" />
          </div>
          <span className="absolute bottom-10 text-[10px] font-bold text-white uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-sm">
            Visualizar
          </span>
        </div>

        {/* Top Badges */}
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {isImported && (
             <Badge className="bg-emerald-500 text-white border-none text-[9px] font-bold py-0 h-5">
               <Check className="w-3 h-3 mr-1" /> NA BIBLIOTECA
             </Badge>
          )}
          {isCandidate && video.status && video.status !== 'pendente' && (
             <Badge className={cn(
               "text-[9px] font-bold py-0 h-5 border-none",
               video.status === 'aprovado' ? "bg-emerald-500 text-white" : "bg-rose-500 text-white"
             )}>
               {video.status.toUpperCase()}
             </Badge>
          )}
        </div>

        {/* Bottom Metadata Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 via-black/40 to-transparent flex flex-col gap-1">
          <div className="flex justify-between items-end">
            <div className="flex flex-col">
              <span className="text-[9px] text-white/70 font-medium flex items-center gap-1">
                <User className="w-2.5 h-2.5" /> {author}
              </span>
              <span className="text-[9px] text-white/50 uppercase font-bold tracking-wider">
                Pexels • {res.width}x{res.height}
              </span>
            </div>
            <div className="bg-black/60 backdrop-blur-md px-1.5 py-0.5 rounded text-[10px] font-bold text-white border border-white/10">
              {formatDuration(duration)}
            </div>
          </div>
        </div>
      </div>

      <CardContent className="p-3 bg-[#13131F] mt-auto border-t border-white/5">
        <div className="flex gap-2">
          {isImported ? (
            <Button className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs h-8 cursor-default hover:bg-emerald-500/10" disabled>
              ✓ IMPORTADO
            </Button>
          ) : (
            <Button 
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-xs h-8 font-bold" 
              disabled={isImporting}
              onClick={() => onImport(video)}
            >
              {isImporting ? <Loader2 className="w-3 h-3 animate-spin" /> : (isCandidate ? "APROVAR" : "IMPORTAR AGORA")}
            </Button>
          )}
          
          {isCandidate && video.status === 'pendente' && onDiscard && (
            <Button 
              size="icon" 
              variant="destructive" 
              className="bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 h-8 w-8"
              onClick={() => onDiscard(video.id)}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export default function GarimpoPage() {
  const [activeTab, setActiveTab] = useState("buscar");
  const [query, setQuery] = useState(() => sessionStorage.getItem('garimpo_query') || "");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<ContentCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [selectedCandidate, setSelectedCandidate] = useState<ContentCandidate | null>(null);
  const [candidateFilter, setCandidateFilter] = useState<'pendente' | 'aprovado' | 'descartado'>('pendente');
  const [importingId, setImportingId] = useState<string | null>(null);
  const [importedExternalIds, setImportedExternalIds] = useState<Set<string>>(new Set());

  // Pagination & Search State
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [searchType, setSearchType] = useState<'search' | 'popular'>('search');

  const [settings, setSettings] = useState<DiscoverySettings | null>(null);
  const [discoveryCategories, setDiscoveryCategories] = useState<DiscoveryCategory[]>([]);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [lastReport, setLastReport] = useState<DiscoveryReport | null>(null);

  // Filters state
  const [filterOrientation, setFilterOrientation] = useState<string>(() => sessionStorage.getItem('garimpo_orientation') || "portrait");
  const [filterDuration, setFilterDuration] = useState<string>("all");
  const [filterQuality, setFilterQuality] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("none");

  const fetchData = async () => {
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

  const performSearch = async (targetPage: number, isLoadMore: boolean = false) => {
    if (searchType === 'search' && !query) return toast.error("Digite um termo");
    
    setLoading(true);
    try {
      // Map filters to Pexels API
      const sizeMap: Record<string, string> = {
        'hd+': 'small',
        'fullhd+': 'medium',
        '4k': 'large'
      };

      const data = await contentService.searchPexels({ 
        query: searchType === 'search' ? query : undefined, 
        type: searchType,
        orientation: filterOrientation === 'all' ? undefined : filterOrientation,
        size: filterQuality !== 'all' ? sizeMap[filterQuality] : undefined,
        page: targetPage,
        per_page: 40
      });

      const newVideos = data.videos || [];
      if (isLoadMore) {
        setResults(prev => [...prev, ...newVideos]);
      } else {
        setResults(newVideos);
      }

      setTotalResults(data.total_results || 0);
      setHasNextPage(!!data.next_page);
      setPage(targetPage);

      if (!isLoadMore && newVideos.length === 0) toast.info("Nenhum vídeo encontrado.");
      
      // Cache query and filters
      sessionStorage.setItem('garimpo_query', query);
      sessionStorage.setItem('garimpo_orientation', filterOrientation);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setSearchType('search');
    performSearch(1, false);
  };

  const handlePopular = () => {
    setSearchType('popular');
    performSearch(1, false);
  };

  const handleLoadMore = () => {
    performSearch(page + 1, true);
  };

  const handleChipSearch = (term: string) => {
    setQuery(term);
    setSearchType('search');
    // We need to wait for state update or pass it directly
    // Using a direct call with the term
    setLoading(true);
    contentService.searchPexels({ 
      query: term, 
      type: 'search',
      orientation: filterOrientation === 'all' ? undefined : filterOrientation,
      page: 1,
      per_page: 40
    }).then(data => {
      setResults(data.videos || []);
      setTotalResults(data.total_results || 0);
      setHasNextPage(!!data.next_page);
      setPage(1);
      sessionStorage.setItem('garimpo_query', term);
    }).catch(err => toast.error(err.message))
      .finally(() => setLoading(false));
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
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={handlePopular} 
              disabled={loading}
              className={cn(
                "border-purple-500/30 text-purple-400 h-9",
                searchType === 'popular' && "bg-purple-600/10 border-purple-500"
              )}
            >
              <Video className="w-4 h-4 mr-2" /> POPULARES
            </Button>
            <Badge className="bg-purple-500/10 text-purple-400 border-purple-500/20 px-3 py-1">Fase 2.3 Ativa</Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="bg-[#13131F] border border-white/5 p-1">
            <TabsTrigger value="buscar" className="px-8 data-[state=active]:bg-purple-600">EXPLORAR</TabsTrigger>
            <TabsTrigger value="candidatos" className="px-8 data-[state=active]:bg-purple-600">FILA ({candidates.length})</TabsTrigger>
            <TabsTrigger value="automacao" className="px-8 data-[state=active]:bg-purple-600">ESTRATÉGIA</TabsTrigger>
          </TabsList>

          <TabsContent value="buscar" className="space-y-6">
             <div className="bg-[#13131F] p-6 rounded-2xl border border-white/5 space-y-6">
                <div className="flex gap-4">
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
                  <Button onClick={handleSearch} disabled={loading} className="bg-purple-600 px-8">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Search className="w-4 h-4 mr-2" />}
                    Buscar
                  </Button>
                </div>

                {/* Related Searches Chips */}
                {query && (
                  <div className="flex flex-wrap gap-2">
                    {["Nature", "Forest", "Waterfall", "Ocean", "Mountain", "Sunset", "Wildlife", "Flowers", "Rain", "Beach"].map(chip => (
                      <button
                        key={chip}
                        onClick={() => handleChipSearch(chip)}
                        className="text-[10px] px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 hover:bg-purple-600/20 hover:text-purple-400 transition-colors"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap gap-4 pt-4 border-t border-white/5 items-center">
                  <div className="flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Filtros API:</span>
                  </div>
                  
                  <Select value={filterOrientation} onValueChange={setFilterOrientation}>
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 h-8 text-xs">
                      <SelectValue placeholder="Orientação" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Orientações</SelectItem>
                      <SelectItem value="portrait">Vertical (Portrait)</SelectItem>
                      <SelectItem value="landscape">Horizontal (Landscape)</SelectItem>
                      <SelectItem value="square">Quadrado (Square)</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterQuality} onValueChange={setFilterQuality}>
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 h-8 text-xs">
                      <SelectValue placeholder="Qualidade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Qualidades</SelectItem>
                      <SelectItem value="hd+">HD+</SelectItem>
                      <SelectItem value="fullhd+">Full HD+</SelectItem>
                      <SelectItem value="4k">4K (Large)</SelectItem>
                    </SelectContent>
                  </Select>

                  <div className="h-4 w-px bg-white/10 mx-2" />

                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-500 uppercase font-bold">Local:</span>
                  </div>

                  <Select value={filterDuration} onValueChange={setFilterDuration}>
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 h-8 text-xs">
                      <SelectValue placeholder="Duração" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas Duração</SelectItem>
                      <SelectItem value="15">até 15s</SelectItem>
                      <SelectItem value="15-30">15–30s</SelectItem>
                      <SelectItem value="30-60">30–60s</SelectItem>
                      <SelectItem value="60+">60s+</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[140px] bg-white/5 border-white/10 h-8 text-xs">
                      <SelectValue placeholder="Ordenar" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Mais Relevantes</SelectItem>
                      <SelectItem value="short">Mais Curtos</SelectItem>
                      <SelectItem value="long">Mais Longos</SelectItem>
                    </SelectContent>
                  </Select>

                  {totalResults > 0 && (
                    <span className="ml-auto text-[10px] text-slate-500 font-mono uppercase">
                      {results.length} de {totalResults.toLocaleString()} vídeos carregados
                    </span>
                  )}
                </div>
             </div>
             
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {(loading && results.length === 0) && Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))}

                {filteredResults.map(video => (
                  <VideoCard 
                    key={video.id} 
                    video={video}
                    onImport={handleApprove}
                    onPreview={(v) => setSelectedCandidate({
                      id: 'new',
                      source: 'pexels',
                      external_id: v.id.toString(),
                      preview_url: v.image,
                      original_url: v.url,
                      duration: v.duration,
                      author: v.user?.name || v.author,
                      category: 'Manual',
                      status: 'pendente',
                      metadata: v,
                      user_id: '',
                      discovered_at: new Date().toISOString()
                    })}
                    isImporting={importingId === video.id.toString()}
                    isImported={importedExternalIds.has(video.id.toString())}
                    formatDuration={formatDuration}
                    getResolutionInfo={getResolutionInfo}
                  />
                ))}

                {!loading && (query || searchType === 'popular') && results.length === 0 && (
                  <div className="col-span-full py-20 text-center">
                    <p className="text-slate-500 italic">Nenhum resultado encontrado.</p>
                  </div>
                )}
             </div>

             {hasNextPage && (
               <div className="flex flex-col items-center gap-4 py-8">
                 <Button 
                   variant="outline" 
                   onClick={handleLoadMore} 
                   disabled={loading}
                   className="bg-[#13131F] border-white/5 hover:border-purple-500/50 hover:bg-purple-600/10 px-12 h-12 text-sm font-bold uppercase tracking-widest transition-all"
                 >
                   {loading ? (
                     <Loader2 className="w-5 h-5 animate-spin mr-3" />
                   ) : (
                     <RotateCw className="w-5 h-5 mr-3" />
                   )}
                   Carregar Mais
                 </Button>
                 <p className="text-[10px] text-slate-500 font-mono">Página {page} | Exibindo {results.length} de {totalResults.toLocaleString()}</p>
               </div>
             )}
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
              {loadingCandidates ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <SkeletonCard key={i} />
                ))
              ) : (
                candidates.map(cand => (
                  <VideoCard 
                    key={cand.id} 
                    video={{
                      ...cand,
                      id: cand.external_id,
                      image: cand.preview_url,
                      user: { name: cand.author }
                    }}
                    onImport={(v) => handleApprove(v, cand.id)}
                    onPreview={() => setSelectedCandidate(cand)}
                    isImporting={importingId === cand.id}
                    isImported={cand.status === 'aprovado' || importedExternalIds.has(cand.external_id)}
                    formatDuration={formatDuration}
                    getResolutionInfo={getResolutionInfo}
                    isCandidate={true}
                    onDiscard={(id) => {
                      contentService.discardCandidate(cand.id);
                      fetchData();
                      toast.info("Descartado");
                    }}
                  />
                ))
              )}
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
          <DialogContent className="max-w-4xl bg-[#0A0A0F] border-white/10 p-0 overflow-hidden ring-0">
             {selectedCandidate && (
               <div className="flex flex-col md:flex-row h-full max-h-[90vh]">
                  <div className="md:w-[45%] aspect-[9/16] bg-black flex items-center justify-center relative group">
                     <video 
                       src={selectedCandidate.metadata?.video_files?.find((f: any) => f.height > f.width)?.link || selectedCandidate.original_url} 
                       controls 
                       autoPlay 
                       loop
                       className="w-full h-full object-contain" 
                     />
                     <div className="absolute top-4 left-4">
                       <Badge className="bg-black/60 backdrop-blur-md border-white/10 text-[10px] font-bold">PREVIEW</Badge>
                     </div>
                  </div>
                  
                  <div className="md:w-[55%] p-8 space-y-8 bg-[#0D0D15] overflow-y-auto">
                     <DialogHeader className="space-y-1">
                        <div className="flex items-center gap-2 text-purple-400 mb-1">
                          <Video className="w-4 h-4" />
                          <span className="text-[10px] font-bold uppercase tracking-wider">Garimpo Inteligente</span>
                        </div>
                        <DialogTitle className="text-3xl font-space font-bold text-white">Visualização Técnica</DialogTitle>
                        <p className="text-slate-500 text-sm">Analise os metadados antes de importar para sua biblioteca.</p>
                     </DialogHeader>
                     
                     <div className="grid grid-cols-2 gap-4">
                        <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-1">
                           <div className="flex items-center gap-2 text-slate-500">
                             <Filter className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold uppercase tracking-tighter">Categoria</span>
                           </div>
                           <p className="text-white font-medium text-lg">{selectedCandidate.category || "Manual"}</p>
                        </div>
                        
                        <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-1">
                           <div className="flex items-center gap-2 text-slate-500">
                             <Clock className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold uppercase tracking-tighter">Duração</span>
                           </div>
                           <p className="text-white font-medium text-lg">{formatDuration(selectedCandidate.duration || 0)}</p>
                        </div>

                        <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-1">
                           <div className="flex items-center gap-2 text-slate-500">
                             <User className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold uppercase tracking-tighter">Autor</span>
                           </div>
                           <p className="text-white font-medium text-lg truncate">{selectedCandidate.author || "Pexels"}</p>
                        </div>

                        <div className="bg-white/[0.03] p-4 rounded-2xl border border-white/5 space-y-1">
                           <div className="flex items-center gap-2 text-slate-500">
                             <Maximize2 className="w-3.5 h-3.5" />
                             <span className="text-[10px] font-bold uppercase tracking-tighter">Resolução</span>
                           </div>
                           <p className="text-white font-medium text-lg">
                             {getResolutionInfo(selectedCandidate.metadata || selectedCandidate).width}x{getResolutionInfo(selectedCandidate.metadata || selectedCandidate).height}
                           </p>
                        </div>
                     </div>

                     <div className="space-y-4 pt-4">
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Fonte Oficial</label>
                          <a 
                            href={selectedCandidate.original_url || `https://www.pexels.com/video/${selectedCandidate.external_id}/`}
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-purple-400 hover:text-purple-300 text-sm flex items-center gap-2 group w-fit"
                          >
                            Ver no Pexels
                            <Eye className="w-4 h-4 transition-transform group-hover:scale-110" />
                          </a>
                        </div>

                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">ID Pexels</label>
                          <code className="bg-white/5 px-3 py-2 rounded-lg text-xs text-slate-400 border border-white/5 font-mono">
                            {selectedCandidate.external_id}
                          </code>
                        </div>
                     </div>
                     
                     <div className="pt-8 flex flex-col gap-4">
                        {importedExternalIds.has(selectedCandidate.external_id) ? (
                          <Button className="w-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 py-8 text-lg font-bold cursor-default hover:bg-emerald-500/10" disabled>
                            ✓ JÁ ESTÁ NA BIBLIOTECA
                          </Button>
                        ) : (
                          <Button 
                            className="w-full bg-purple-600 hover:bg-purple-700 py-8 text-lg font-bold shadow-2xl shadow-purple-600/20"
                            disabled={importingId === selectedCandidate.id || importingId === selectedCandidate.external_id}
                            onClick={() => handleApprove(selectedCandidate.metadata || selectedCandidate, selectedCandidate.id === 'new' ? undefined : selectedCandidate.id)}
                          >
                            {importingId ? <Loader2 className="w-6 h-6 animate-spin" /> : (selectedCandidate.id === 'new' ? "IMPORTAR AGORA" : "APROVAR E IMPORTAR")}
                          </Button>
                        )}
                        <p className="text-[10px] text-slate-500 text-center uppercase tracking-widest font-bold">
                          Vídeo fornecido por <a href="https://www.pexels.com" target="_blank" rel="noopener noreferrer" className="text-white hover:underline">Pexels</a>
                        </p>
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
