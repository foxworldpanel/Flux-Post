import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Archive, Power, RefreshCw, Unlink, Edit2 } from "lucide-react";
import { toast } from "sonner";
import { socialService, SocialAccount, SocialPlatform, ConnectionStatus, OperationalStatus } from "@/services/social";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

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
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<SocialAccount> | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<string>("Todas");

  const loadData = async () => {
    try {
      setLoading(true);
      const accountsData = await socialService.getAccounts();
      setAccounts(accountsData as any);
    } catch (err: any) {
      toast.error("Erro ao carregar dados: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const params = new URLSearchParams(window.location.search);
    const success = params.get('success');
    const error = params.get('error');

    if (success === 'postpeer_connected') {
      toast.success("Conta conectada com sucesso!");
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
    if (!editingAccount?.account_name || !editingAccount.id) {
      toast.error("Preencha o nome da conta.");
      return;
    }

    try {
      await socialService.updateAccount(editingAccount.id, { 
        account_name: editingAccount.account_name,
        status: editingAccount.status
      });
      toast.success("Conta atualizada.");
      setIsDialogOpen(false);
      setEditingAccount(null);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao salvar: " + err.message);
    }
  };

  const toggleStatus = async (account: SocialAccount) => {
    const newStatus = account.status === 'active' ? 'paused' : 'active';
    try {
      await socialService.updateAccount(account.id, { status: newStatus as OperationalStatus });
      toast.success(`Conta ${newStatus === 'active' ? 'ativada' : 'pausada'}.`);
      loadData();
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const archiveAccount = async (id: string) => {
    if (!confirm("Arquivar esta conta?")) return;
    try {
      await socialService.archiveAccount(id);
      toast.success("Conta arquivada.");
      loadData();
    } catch (err: any) {
      toast.error("Erro ao arquivar: " + err.message);
    }
  };

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
    const matchStatus = a.status !== 'archived';
    return matchPlatform && matchStatus;
  });

  const platformList: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-space">Central de Contas Sociais</h1>
            <p className="text-slate-400">Destinos de publicação para suas campanhas.</p>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => { setSelectedPlatform(null); setIsAddOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar Conta
          </Button>
        </div>

        {/* Métricas Simplificadas */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-[10px] text-slate-500 font-bold uppercase">Total</p><p className="text-xl font-bold text-white">{accounts.length}</p></Card>
          {platformList.map(p => (
            <Card key={p} className="bg-[#13131F] border-white/5 p-4">
              <p className="text-[10px] text-slate-500 font-bold uppercase">{p}</p>
              <p className="text-xl font-bold text-white">{accounts.filter(a => a.platform === p).length}</p>
            </Card>
          ))}
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-[10px] text-slate-500 font-bold uppercase">Conectadas</p><p className="text-xl font-bold text-emerald-400">{accounts.filter(a => a.connection_status === 'conectada').length}</p></Card>
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-[10px] text-slate-500 font-bold uppercase">Off</p><p className="text-xl font-bold text-amber-400">{accounts.filter(a => a.connection_status !== 'conectada').length}</p></Card>
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
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-500" /></div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccounts.map(account => (
              <Card key={account.id} className="bg-[#13131F] border-white/5 p-6 hover:border-purple-500/30 transition-all flex flex-col group">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center border border-white/10 text-xl overflow-hidden">
                      {account.profile_image_url ? (
                        <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        PLATFORM_ICON[account.platform]
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-500 uppercase tracking-tight">{account.account_name}</h3>
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-white group-hover:text-purple-400 transition-colors">
                          {account.external_display_name || account.username || 'Identidade Pendente'}
                        </span>
                        {account.username && account.username !== account.external_display_name && !account.username.startsWith('tiktok_conta_') && (
                           <span className="text-xs text-slate-500">@{account.username}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={`text-[10px] ${CONNECTION_STATUS_MAP[account.connection_status]?.color || 'bg-slate-500/10 text-slate-400'}`}>
                      {account.connection_status === 'conectada' ? '🟢 CONECTADA' : CONNECTION_STATUS_MAP[account.connection_status]?.label}
                    </Badge>
                    <span className="text-[9px] text-slate-600 uppercase font-bold tracking-widest">PostPeer</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-auto pt-4 border-t border-white/5">
                  {account.connection_status === 'conectada' ? (
                    <>
                      <Button variant="outline" size="sm" className="flex-1 border-white/10 hover:bg-white/5 text-slate-400 text-xs h-8 gap-1.5" 
                        onClick={() => socialService.syncAccount(account.id)
                          .then(() => { toast.success("Sincronizado!"); loadData(); })
                          .catch((e: Error) => toast.error(e.message))}>
                        <RefreshCw className="w-3 h-3" /> SINCRONIZAR
                      </Button>
                      <Button variant="outline" size="sm" className="flex-1 border-red-500/30 text-red-400 hover:bg-red-500/10 text-xs h-8 gap-1.5" 
                        onClick={() => handleDisconnect(account)}>
                        <Unlink className="w-3 h-3" /> DESCONECTAR
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="flex-1 border-purple-500/30 text-purple-400 hover:bg-purple-500/10 text-xs h-8" 
                      disabled={isConnecting}
                      onClick={() => {
                        if (account.provider === 'postpeer' && account.provider_profile_id) {
                           socialService.syncAccount(account.id)
                             .then((res: any) => {
                               if (res.success) {
                                 toast.success("Conta vinculada!");
                                 loadData();
                               } else {
                                 handleReconnect(account);
                                }
                             })
                             .catch(() => handleReconnect(account));
                        } else {
                          handleReconnect(account);
                        }
                      }}>
                      {account.provider === 'postpeer' && account.provider_profile_id ? 'VERIFICAR CONEXÃO' : 'CONECTAR'}
                    </Button>
                  )}

                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-8 px-2 text-[10px] text-slate-500 hover:text-white uppercase font-bold" onClick={() => {
                      setEditingAccount(account);
                      setIsDialogOpen(true);
                    }}>
                      RENOMEAR
                    </Button>
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
                <h3 className="text-xl font-bold text-white mb-2">Nenhuma conta social</h3>
                <p className="text-slate-500 mb-6">Conecte uma rede social para começar a distribuir conteúdo.</p>
                <Button className="bg-[#7C3AED]" onClick={() => { setSelectedPlatform(null); setIsAddOpen(true); }}>
                  ADICIONAR CONTA
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Modal Simples de Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-[#0A0A0F] border-white/10 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-space font-bold">Configurar Conta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label>Nome Interno (Flux)</Label>
                <Input 
                  placeholder="Ex: TikTok Conta 01" 
                  className="bg-white/5 border-white/10 h-10"
                  value={editingAccount?.account_name || ''}
                  onChange={(e) => setEditingAccount({...editingAccount!, account_name: e.target.value})}
                />
                <p className="text-[10px] text-slate-500">Este nome é usado apenas para sua organização interna.</p>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
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

              <DialogFooter>
                <Button type="button" variant="ghost" className="text-slate-400" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-[#7C3AED] px-8">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Adicionar Conta */}
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setSelectedPlatform(null); setIsConnecting(false); } }}>
          <DialogContent className="bg-[#0A0A0F] border-white/10 text-white max-w-lg">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold font-space text-center">
                {selectedPlatform ? `Conectar ${PLATFORM_LABEL[selectedPlatform]}` : "Escolha a plataforma"}
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
                  Você será redirecionado para o {PLATFORM_LABEL[selectedPlatform]} para autorizar o acesso.
                </p>
                <Button
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] w-full h-11"
                  disabled={isConnecting}
                  onClick={() => handleStartConnection(selectedPlatform)}
                >
                  {isConnecting ? <Loader2 className="animate-spin" /> : `CONECTAR ${PLATFORM_LABEL[selectedPlatform].toUpperCase()}`}
                </Button>
                <Button variant="ghost" className="text-slate-500 text-xs" onClick={() => setSelectedPlatform(null)}>Voltar</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}


