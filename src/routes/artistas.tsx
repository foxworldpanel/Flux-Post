import { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Plus, User, Globe, MessageSquare, Tag, Music2, Loader2, X, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { artistService } from '@/services/artists';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ArtistasPage() {
  const [artists, setArtists] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingArtist, setEditingArtist] = useState<any>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    genre: "",
    description: "",
    photo_url: "",
    priority_markets: [] as string[],
    primary_language: "pt-BR",
    communication_identity: "",
    priority_hashtags: [] as string[],
    blocked_hashtags: [] as string[],
    ai_briefing: "",
    status: "active"
  });

  const [newMarket, setNewMarket] = useState("");
  const [newHashtag, setNewHashtag] = useState("");
  const [newBlockedHashtag, setNewBlockedHashtag] = useState("");

  const loadArtists = async () => {
    try {
      setLoading(true);
      await artistService.ensureSourceeAssociated();
      const data = await artistService.getArtists();
      setArtists(data);
    } catch (error: any) {
      toast.error("Erro ao carregar artistas: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadArtists();
  }, []);

  const handleOpenCreate = () => {
    setEditingArtist(null);
    setFormData({
      name: "",
      slug: "",
      genre: "",
      description: "",
      photo_url: "",
      priority_markets: [],
      primary_language: "pt-BR",
      communication_identity: "",
      priority_hashtags: [],
      blocked_hashtags: [],
      ai_briefing: "",
      status: "active"
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (artist: any) => {
    setEditingArtist(artist);
    setFormData({
      name: artist.name || "",
      slug: artist.slug || "",
      genre: artist.genre || "",
      description: artist.description || "",
      photo_url: artist.photo_url || "",
      priority_markets: artist.priority_markets || [],
      primary_language: artist.primary_language || "pt-BR",
      communication_identity: artist.communication_identity || "",
      priority_hashtags: artist.priority_hashtags || [],
      blocked_hashtags: artist.blocked_hashtags || [],
      ai_briefing: artist.ai_briefing || "",
      status: artist.status || "active"
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name) {
      toast.error("O nome do artista é obrigatório");
      return;
    }

    try {
      setSaving(true);
      if (editingArtist) {
        await artistService.updateArtist(editingArtist.id, formData);
        toast.success("Artista atualizado com sucesso");
      } else {
        await artistService.createArtist(formData);
        toast.success("Artista criado com sucesso");
      }
      setIsModalOpen(false);
      loadArtists();
    } catch (error: any) {
      toast.error("Erro ao salvar: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  const addTag = (field: 'priority_markets' | 'priority_hashtags' | 'blocked_hashtags', value: string, setter: (v: string) => void) => {
    if (!value) return;
    const cleanValue = value.trim();
    if (!formData[field].includes(cleanValue)) {
      setFormData({ ...formData, [field]: [...formData[field], cleanValue] });
    }
    setter("");
  };

  const removeTag = (field: 'priority_markets' | 'priority_hashtags' | 'blocked_hashtags', index: number) => {
    const newTags = [...formData[field]];
    newTags.splice(index, 1);
    setFormData({ ...formData, [field]: newTags });
  };

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-white">Artistas</h1>
            <p className="text-slate-500 mt-1">Gerencie os artistas e suas identidades</p>
          </div>
          <Button onClick={handleOpenCreate} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            <Plus className="mr-2 h-4 w-4" /> Novo Artista
          </Button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin text-purple-500" size={40} />
          </div>
        ) : artists.length === 0 ? (
          <Card className="bg-[#13131F] border-white/5 border-dashed py-12">
            <CardContent className="flex flex-col items-center justify-center space-y-4">
              <User size={48} className="text-slate-700" />
              <div className="text-center">
                <p className="text-lg font-medium text-white">Nenhum artista encontrado</p>
                <p className="text-slate-500">Cadastre seu primeiro artista para começar.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            {artists.map((artist) => (
              <Card key={artist.id} className="bg-[#13131F] border-white/5 text-white overflow-hidden group hover:border-purple-500/30 transition-all">
                <div className="h-32 bg-gradient-to-br from-[#7C3AED]/20 to-[#4C1D95]/20 flex items-center justify-center relative">
                  <User size={60} className="text-white/5" />
                  <div className="absolute bottom-[-20px] left-6 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full border-4 border-[#13131F] bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                      {artist.photo_url ? (
                        <img src={artist.photo_url} alt={artist.name} className="w-full h-full object-cover" />
                      ) : (
                        <User size={40} className="text-slate-600" />
                      )}
                    </div>
                    <div className="pt-6">
                      <h2 className="text-2xl font-bold">{artist.name}</h2>
                      <Badge className={artist.status === 'active' ? 'bg-[#10B981]/20 text-[#10B981] border-none' : 'bg-slate-500/20 text-slate-500 border-none'}>
                        {artist.status === 'active' ? 'Ativo' : 'Inativo'}
                      </Badge>
                    </div>
                  </div>
                </div>
                
                <CardContent className="pt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                        <Music2 size={12} /> Gênero
                      </label>
                      <p className="text-slate-300">{artist.genre || "Não definido"}</p>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                        <Globe size={12} /> Mercados Prioritários
                      </label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {artist.priority_markets?.map((m: string, i: number) => (
                          <Badge key={i} variant="outline" className="border-white/10 text-slate-400 text-[10px]">{m}</Badge>
                        )) || <span className="text-slate-500 text-xs italic">Nenhum</span>}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                        <Tag size={12} /> Hashtags
                      </label>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {artist.priority_hashtags?.map((h: string, i: number) => (
                          <Badge key={i} variant="outline" className="border-white/10 text-slate-400 text-[10px]">#{h.replace('#', '')}</Badge>
                        )) || <span className="text-slate-500 text-xs italic">Nenhuma</span>}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                        <MessageSquare size={12} /> Identidade
                      </label>
                      <p className="text-sm text-slate-400 leading-relaxed italic line-clamp-3">
                        {artist.communication_identity ? `"${artist.communication_identity}"` : "Nenhuma identidade definida."}
                      </p>
                    </div>
                    <div className="pt-2">
                      <Button onClick={() => handleOpenEdit(artist)} variant="outline" className="w-full border-white/10 hover:bg-white/5 text-slate-300">
                        Editar Perfil Completo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-[#13131F] border-white/10 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-display">
                {editingArtist ? "Editar Artista" : "Novo Artista"}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-6 py-4">
              <div className="grid grid-cols-1 gap-4">
                <div className="space-y-2">
                  <Label>Nome do Artista</Label>
                  <Input 
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Sourcee"
                    className="bg-[#0A0A0F] border-white/10"
                  />
                  <p className="text-[10px] text-slate-500">O slug da URL será gerado automaticamente a partir do nome.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Gênero Musical</Label>
                  <Input 
                    value={formData.genre}
                    onChange={(e) => setFormData({ ...formData, genre: e.target.value })}
                    placeholder="Ex: Eletrônico / Progressive"
                    className="bg-[#0A0A0F] border-white/10"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={formData.status} onValueChange={(v) => setFormData({ ...formData, status: v })}>
                    <SelectTrigger className="bg-[#0A0A0F] border-white/10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      <SelectItem value="active">Ativo</SelectItem>
                      <SelectItem value="inactive">Inativo</SelectItem>
                      <SelectItem value="archived">Arquivado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Mercados Prioritários</Label>
                <div className="flex gap-2 mb-2">
                  <Input 
                    value={newMarket}
                    onChange={(e) => setNewMarket(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addTag('priority_markets', newMarket, setNewMarket)}
                    placeholder="Adicionar mercado (ex: Brasil)"
                    className="bg-[#0A0A0F] border-white/10"
                  />
                  <Button size="icon" variant="ghost" onClick={() => addTag('priority_markets', newMarket, setNewMarket)}>
                    <Plus size={16} />
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {formData.priority_markets.map((m, i) => (
                    <Badge key={i} className="bg-purple-500/20 text-purple-300 gap-1 pr-1">
                      {m} <X size={12} className="cursor-pointer" onClick={() => removeTag('priority_markets', i)} />
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Identidade de Comunicação</Label>
                <Textarea 
                  value={formData.communication_identity}
                  onChange={(e) => setFormData({ ...formData, communication_identity: e.target.value })}
                  placeholder="Descreva a personalidade do artista..."
                  className="bg-[#0A0A0F] border-white/10 min-h-[80px]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Hashtags Prioritárias</Label>
                  <div className="flex gap-2 mb-2">
                    <Input 
                      value={newHashtag}
                      onChange={(e) => setNewHashtag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag('priority_hashtags', newHashtag, setNewHashtag)}
                      placeholder="Tag"
                      className="bg-[#0A0A0F] border-white/10"
                    />
                    <Button size="icon" variant="ghost" onClick={() => addTag('priority_hashtags', newHashtag, setNewHashtag)}>
                      <Plus size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.priority_hashtags.map((h, i) => (
                      <Badge key={i} variant="outline" className="text-slate-400 gap-1 pr-1">
                        #{h} <X size={12} className="cursor-pointer" onClick={() => removeTag('priority_hashtags', i)} />
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Hashtags Bloqueadas</Label>
                  <div className="flex gap-2 mb-2">
                    <Input 
                      value={newBlockedHashtag}
                      onChange={(e) => setNewBlockedHashtag(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && addTag('blocked_hashtags', newBlockedHashtag, setNewBlockedHashtag)}
                      placeholder="Tag"
                      className="bg-[#0A0A0F] border-white/10"
                    />
                    <Button size="icon" variant="ghost" onClick={() => addTag('blocked_hashtags', newBlockedHashtag, setNewBlockedHashtag)}>
                      <Plus size={16} />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {formData.blocked_hashtags.map((h, i) => (
                      <Badge key={i} variant="outline" className="text-red-400/50 gap-1 pr-1 border-red-900/20">
                        #{h} <X size={12} className="cursor-pointer" onClick={() => removeTag('blocked_hashtags', i)} />
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Sparkles size={14} className="text-purple-400" /> Briefing para IA
                </Label>
                <Textarea 
                  value={formData.ai_briefing}
                  onChange={(e) => setFormData({ ...formData, ai_briefing: e.target.value })}
                  placeholder="Instruções para a IA gerar legendas..."
                  className="bg-[#0A0A0F] border-white/10 min-h-[100px]"
                />
              </div>
            </div>
            <DialogFooter className="sticky bottom-0 bg-[#13131F] pt-4">
              <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={saving} className="bg-[#7C3AED] hover:bg-[#6D28D9]">
                {saving ? "Salvando..." : "Salvar Alterações"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

const Sparkles = ({ size, className }: { size: number, className?: string }) => (
  <svg 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
    <path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/>
  </svg>
);
