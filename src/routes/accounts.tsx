import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Settings, Archive, Power, X } from "lucide-react";
import { toast } from "sonner";
import { socialService, SocialAccount, SocialPlatform, ConnectionStatus, OperationalStatus } from "@/services/social";
import { artistService } from "@/services/artists";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

type SocialAccountWithArtist = SocialAccount & { artist?: { id: string; name: string } | null };

const AVAILABLE_CATEGORIES = [
  "Receitas", "Natureza", "Satisfying", "Animais", "Lifestyle", 
  "Viagens", "Humor/Memes", "Carros", "Fitness", "Curiosidades", 
  "Relaxante", "Outros"
];

const CONNECTION_STATUS_MAP: Record<ConnectionStatus, { label: string; color: string }> = {
  nao_conectada: { label: "Não Conectada", color: "bg-slate-500/10 text-slate-400" },
  conectada: { label: "Conectada", color: "bg-emerald-500/10 text-emerald-400" },
  requer_reconexao: { label: "Requer Reconexão", color: "bg-amber-500/10 text-amber-400" },
  erro: { label: "Erro", color: "bg-red-500/10 text-red-400" },
  token_expirado: { label: "Token Expirado", color: "bg-orange-500/10 text-orange-400" },
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  tiktok: "TikTok",
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
};

const PLATFORM_ICON: Record<SocialPlatform, string> = {
  tiktok: "📱",
  instagram: "📸",
  facebook: "👥",
  youtube: "🎥",
};

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccountWithArtist[]>([]);
  const [artists, setArtists] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<SocialAccountWithArtist> | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("Todas");
  const [filterStatus, setFilterStatus] = useState<string>("Ativas");

  const loadData = async () => {
    try {
      setLoading(true);
      const [accountsData, artistsData] = await Promise.all([
        socialService.getAccounts(),
        artistService.getArtists()
      ]);
      setAccounts(accountsData as any);
      setArtists(artistsData);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Capturar parâmetros de callback do OAuth / PostPeer
    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'tiktok_connected' || success === 'postpeer_connected') {
      toast.success(success === 'tiktok_connected' ? "TikTok conectado com sucesso!" : "Conta conectada via PostPeer!");
      window.history.replaceState({}, document.title, window.location.pathname);
      loadData();
    } else if (error) {
      let msg = error;
      if (error === 'config_pending' || error === 'postpeer_config_pending') msg = "Configuração PostPeer pendente.";
      if (error === 'already_connected') msg = "Esta conta social já está conectada ao Flux Post.";
      
      toast.error(msg);
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAccount?.platform || !editingAccount?.account_name) {
      toast.error("Preencha os campos obrigatórios.");
      return;
    }

    try {
      const payload = {
        ...editingAccount,
        posts_per_day: Number(editingAccount.posts_per_day || 3),
        timezone: editingAccount.timezone || 'America/Sao_Paulo',
        status: editingAccount.status || 'active',
        preferred_categories: editingAccount.preferred_categories || [],
        receive_all_campaigns: !!editingAccount.receive_all_campaigns
      };

      if (editingAccount.id) {
        await socialService.updateAccount(editingAccount.id, payload);
        toast.success("Conta atualizada com sucesso.");
      } else {
        await socialService.createAccount(payload);
        toast.success("Conta criada com sucesso.");
      }
      setIsDialogOpen(false);
      setEditingAccount(null);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao salvar conta: " + err.message);
    }
  };

  const toggleStatus = async (account: SocialAccount) => {
    const newStatus = account.status === 'active' ? 'paused' : 'active';
    try {
      await socialService.updateAccount(account.id, { status: newStatus as OperationalStatus });
      toast.success(`Conta ${newStatus === 'active' ? 'ativada' : 'pausada'} com sucesso.`);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const archiveAccount = async (id: string) => {
    if (!confirm("Tem certeza que deseja arquivar esta conta?")) return;
    try {
      await socialService.archiveAccount(id);
      toast.success("Conta arquivada com sucesso.");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao arquivar: " + err.message);
    }
  };

  /** Fluxo novo: cria pending mínimo e vai direto para o OAuth do PostPeer */
  const handleStartConnection = async (platform: SocialPlatform) => {
    try {
      setIsConnecting(true);
      const { authorization_url } = await socialService.startConnection(platform);
      window.location.href = authorization_url;
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao iniciar conexão.");
      setIsConnecting(false);
    }
  };

  /** Reconectar uma conta já existente (card CONECTAR) */
  const handleReconnect = async (account: SocialAccount) => {
    try {
      setIsConnecting(true);
      const { authorization_url } = await socialService.connectAccount(account.id);
      if (authorization_url) window.location.href = authorization_url;
    } catch (err: any) {
      toast.error(err.message || "Erro ao iniciar conexão.");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = async (account: SocialAccount) => {
    if (!confirm(`Deseja desconectar a conta ${account.account_name}?`)) return;
    try {
      await socialService.disconnectAccount(account.id);
      toast.success("Conta desconectada.");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao desconectar: " + err.message);
    }
  };

  const filteredAccounts = accounts.filter(a => {
    const matchPlatform = filterPlatform === "Todas" || a.platform === filterPlatform.toLowerCase();
    const matchStatus = 
      (filterStatus === "Ativas" && a.status === 'active') ||
      (filterStatus === "Pausadas" && a.status === 'paused') ||
      (filterStatus === "Arquivadas" && a.status === 'archived');
    return matchPlatform && matchStatus;
  });

  const platformList: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-space">Central de Contas Sociais</h1>
            <p className="text-slate-400">Gerencie suas identidades editoriais para distribuição.</p>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => { setSelectedPlatform(null); setIsAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar Conta
          </Button>
        </div>

        {/* Métricas Reais */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-[10px] text-slate-500 font-bold uppercase">Total</p><p className="text-xl font-bold text-white">{accounts.length}</p></Card>
          {platformList.map(p => (
            <Card key={p} className="bg-[#13131F] border-white/5 p-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase">{p}</p>
              <p className="text-xl font-bold text-white">{accounts.filter(a => a.platform === p).length}</p>
            </Card>
          ))}
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-[10px] text-slate-500 font-bold uppercase">Conectadas</p><p className="text-xl font-bold text-emerald-400">{accounts.filter(a => a.connection_status === 'conectada').length}</p></Card>
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-[10px] text-slate-500 font-bold uppercase">Resto</p><p className="text-xl font-bold text-amber-400">{accounts.filter(a => a.connection_status !== 'conectada').length}</p></Card>
        </div>

        {/* Filtros */}
        <div className="flex gap-4 items-center bg-[#13131F]/50 p-4 rounded-xl border border-white/5">
          <div className="flex items-center gap-2">
            <Label className="text-slate-500 text-xs uppercase">Plataforma:</Label>
            <div className="flex gap-2">
              {["Todas", ...platformList].map(p => (
                <Button key={p} variant={filterPlatform === p ? "default" : "outline"} size="sm" 
                  className={filterPlatform === p ? "bg-[#7C3AED]" : "border-white/10 text-slate-400 text-xs h-7"}
                  onClick={() => setFilterPlatform(p)}>
                  {p}
                </Button>
              ))}
            </div>
          </div>
          <div className="h-4 w-[1px] bg-white/10 mx-2" />
          <div className="flex items-center gap-2">
            <Label className="text-slate-500 text-xs uppercase">Status:</Label>
            <div className="flex gap-2">
              {["Ativas", "Pausadas", "Arquivadas"].map(s => (
                <Button key={s} variant={filterStatus === s ? "default" : "outline"} size="sm" 
                  className={filterStatus === s ? "bg-purple-600/50" : "border-white/10 text-slate-400 text-xs h-7"}
                  onClick={() => setFilterStatus(s)}>
                  {s}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccounts.map(account => (
              <Card key={account.id} className="bg-[#13131F] border-white/5 p-6 hover:border-purple-500/30 transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-xl">
                      {account.platform === 'tiktok' ? '📱' : account.platform === 'instagram' ? '📸' : account.platform === 'youtube' ? '🎥' : '👥'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">{account.account_name}</h3>
                      <p className="text-xs text-slate-500">@{account.username || 'sem_user'}</p>
                    </div>
                  </div>
                  <Badge className={CONNECTION_STATUS_MAP[account.connection_status]?.color || 'bg-slate-500/10 text-slate-400'}>
                    {CONNECTION_STATUS_MAP[account.connection_status]?.label || 'Desconhecido'}
                  </Badge>
                </div>

                <div className="flex-1 space-y-3">
                   <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 uppercase font-bold">Artista/Label</span>
                      <span className="text-white truncate max-w-[120px]">{account.artist?.name || 'Label / Gravadora'}</span>
                   </div>
                   <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 uppercase font-bold">Provider</span>
                      <span className="text-white bg-white/5 px-2 py-0.5 rounded uppercase text-[9px]">
                        {account.provider === 'postpeer' ? 'PostPeer' : (account.provider || 'Direto')}
                      </span>
                   </div>
                   <div className="flex justify-between items-center text-[10px]">
                      <span className="text-slate-500 uppercase font-bold">Posts/Dia</span>
                      <span className="text-white">{account.posts_per_day} posts</span>
                   </div>
                   {account.editorial_profile && (
                     <div className="bg-white/5 p-3 rounded-lg border border-white/5 italic text-xs text-slate-400 leading-relaxed">
                        "{account.editorial_profile.length > 80 ? account.editorial_profile.substring(0, 80) + '...' : account.editorial_profile}"
                     </div>
                   )}
                   <div className="flex flex-wrap gap-1.5 pt-2">
                      {account.preferred_categories?.map(cat => (
                        <Badge key={cat} variant="secondary" className="bg-purple-500/10 text-purple-400 border-none text-[9px] uppercase px-2 py-0">
                          {cat}
                        </Badge>
                      ))}
                      {(!account.preferred_categories || account.preferred_categories.length === 0) && (
                        <span className="text-[10px] text-slate-600 uppercase">Sem categorias</span>
                      )}
                   </div>
                </div>

                <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
                  <Button variant="outline" size="sm" className="flex-1 border-white/10 hover:bg-white/5 text-xs h-8" onClick={() => {
                    setEditingAccount(account);
                    setIsDialogOpen(true);
                  }}>
                    CONFIGURAR
                  </Button>
                  {account.connection_status === 'nao_conectada' && (
                    <Button variant="outline" size="sm" className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs h-8" 
                      disabled={isConnecting}
                      onClick={() => handleReconnect(account)}>
                      CONECTAR
                    </Button>
                  )}
                  {account.connection_status === 'conectada' && (
                    <Button variant="outline" size="sm" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8" 
                      onClick={() => handleDisconnect(account)}>
                      DESCONECTAR
                    </Button>
                  )}
                  {account.connection_status === 'conectada' && (
                <Button variant="outline" size="sm" className="flex-1 border-white/10 hover:bg-white/5 text-slate-400 text-xs h-8" 
                      onClick={() => socialService.syncAccount(account.id)
                        .then(() => { toast.success("Sincronizado!"); loadData(); })
                        .catch((e: Error) => toast.error(e.message))}>
                      SINCRONIZAR
                    </Button>
                  )}
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-white" onClick={() => toggleStatus(account)}>
                      <Power className={`w-4 h-4 ${account.status === 'active' ? 'text-emerald-500' : 'text-slate-500'}`} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-400" onClick={() => archiveAccount(account.id)}>
                      <Archive className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredAccounts.length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-white/5 rounded-3xl">
                <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 border border-white/10">
                   <Plus className="text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Nenhuma conta social encontrada</h3>
                <p className="text-slate-500 mb-6">Conecte uma rede social em poucos cliques. O login é feito na própria plataforma.</p>
                <Button className="bg-[#7C3AED]" onClick={() => { setSelectedPlatform(null); setIsAddOpen(true); }}>
                  ADICIONAR PRIMEIRA CONTA
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Modal CRUD */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-[#0A0A0F] border-white/10 text-white max-w-2xl overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-2xl font-space font-bold">Configurar Conta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-6 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Plataforma *</Label>
                  <Select value={editingAccount?.platform} onValueChange={(val) => setEditingAccount({...editingAccount!, platform: val as SocialPlatform})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-10">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      {platformList.map(p => <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Nome da Conta *</Label>
                  <Input 
                    placeholder="Ex: Sourcee Recipes Main" 
                    className="bg-white/5 border-white/10 h-10"
                    value={editingAccount?.account_name || ''}
                    onChange={(e) => setEditingAccount({...editingAccount!, account_name: e.target.value})}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Username (@)</Label>
                  <Input 
                    placeholder="Ex: sourcee_recipes" 
                    className="bg-white/5 border-white/10 h-10"
                    value={editingAccount?.username || ''}
                    onChange={(e) => setEditingAccount({...editingAccount!, username: e.target.value})}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Artista / Label</Label>
                  <Select value={editingAccount?.artist_id || 'label'} onValueChange={(val) => setEditingAccount({...editingAccount!, artist_id: val === 'label' ? undefined : val})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-10">
                      <SelectValue placeholder="Label / Gravadora" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      <SelectItem value="label">Label / Gravadora (Geral)</SelectItem>
                      {artists.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Perfil Editorial</Label>
                <Textarea 
                  placeholder="Descreva a linha editorial desta conta..." 
                  className="bg-white/5 border-white/10 min-h-[80px]"
                  value={editingAccount?.editorial_profile || ''}
                  onChange={(e) => setEditingAccount({...editingAccount!, editorial_profile: e.target.value})}
                />
                <p className="text-[10px] text-slate-500">Ex: "Focada em receitas e conteúdos de comida."</p>
              </div>

              <div className="space-y-3">
                <Label>Categorias Preferidas</Label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_CATEGORIES.map(cat => {
                    const isSelected = editingAccount?.preferred_categories?.includes(cat);
                    return (
                      <Badge 
                        key={cat} 
                        variant="outline" 
                        className={`cursor-pointer border-white/10 transition-colors ${isSelected ? 'bg-purple-600 border-purple-600 text-white' : 'hover:bg-white/5 text-slate-400'}`}
                        onClick={() => {
                          const current = editingAccount?.preferred_categories || [];
                          const updated = isSelected ? current.filter(c => c !== cat) : [...current, cat];
                          setEditingAccount({...editingAccount!, preferred_categories: updated});
                        }}
                      >
                        {cat}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Posts por Dia</Label>
                  <Select value={String(editingAccount?.posts_per_day || 3)} onValueChange={(val) => setEditingAccount({...editingAccount!, posts_per_day: Number(val)})}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#13131F] border-white/10 text-white">
                      {[1, 2, 3, 4, 5, 6].map(n => <SelectItem key={n} value={String(n)}>{n} posts/dia</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Timezone</Label>
                  <Input 
                    placeholder="America/Sao_Paulo" 
                    className="bg-white/5 border-white/10 h-10"
                    value={editingAccount?.timezone || 'America/Sao_Paulo'}
                    onChange={(e) => setEditingAccount({...editingAccount!, timezone: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between bg-white/5 p-4 rounded-xl border border-white/5">
                <div className="space-y-1">
                  <Label>Receber todas as campanhas</Label>
                  <p className="text-[10px] text-slate-500 max-w-[80%]">Quando ativo, esta conta poderá participar automaticamente de campanhas compatíveis.</p>
                </div>
                <Switch 
                  checked={!!editingAccount?.receive_all_campaigns}
                  onCheckedChange={(val) => setEditingAccount({...editingAccount!, receive_all_campaigns: val})}
                />
              </div>

              <div className="space-y-2">
                <Label>Status Operacional</Label>
                <div className="flex gap-4">
                   {['active', 'paused'].map(s => (
                     <div key={s} className="flex items-center gap-2 cursor-pointer" onClick={() => setEditingAccount({...editingAccount!, status: s as OperationalStatus})}>
                        <div className={`w-4 h-4 rounded-full border border-white/20 flex items-center justify-center ${editingAccount?.status === s ? 'bg-purple-600' : ''}`}>
                           {editingAccount?.status === s && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        <span className="text-sm capitalize">{s === 'active' ? 'Ativa' : 'Pausada'}</span>
                     </div>
                   ))}
                </div>
              </div>

              <DialogFooter className="gap-3">
                <Button type="button" variant="ghost" className="text-slate-400" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-[#7C3AED] px-8">Salvar Conta</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Adicionar Conta — fluxo simples em 2 passos */}
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setSelectedPlatform(null); setIsConnecting(false); } }}>
          <DialogContent className="bg-[#0A0A0F] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-space">
                {selectedPlatform ? `Conectar ${PLATFORM_LABEL[selectedPlatform]}` : "Qual rede social você deseja conectar?"}
              </DialogTitle>
            </DialogHeader>

            {!selectedPlatform ? (
              <div className="grid grid-cols-2 gap-4 py-4">
                {platformList.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setSelectedPlatform(p)}
                    className="flex flex-col items-center gap-2 p-6 rounded-xl bg-white/5 border border-white/10 hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                  >
                    <span className="text-3xl">{PLATFORM_ICON[p]}</span>
                    <span className="text-sm font-bold">{PLATFORM_LABEL[p]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-6 space-y-5 text-center">
                <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-3xl">
                  {PLATFORM_ICON[selectedPlatform]}
                </div>
                <p className="text-sm text-slate-400 leading-relaxed px-4">
                  Você fará login diretamente no {PLATFORM_LABEL[selectedPlatform]}. O Flux Post não recebe sua senha.
                </p>
                <Button
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] w-full h-11"
                  disabled={isConnecting}
                  onClick={() => handleStartConnection(selectedPlatform)}
                >
                  {isConnecting ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : null}
                  CONECTAR {PLATFORM_LABEL[selectedPlatform].toUpperCase()}
                </Button>
                <Button variant="ghost" className="text-slate-500 text-xs" disabled={isConnecting} onClick={() => setSelectedPlatform(null)}>
                  Escolher outra rede social
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

