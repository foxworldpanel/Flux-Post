import { useState, useEffect, useMemo } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Loader2,
  Archive,
  Power,
  RefreshCw,
  Unlink,
  Edit2,
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  Wifi,
  WifiOff,
} from "lucide-react";
import { toast } from "sonner";
import { socialService, SocialAccount, SocialPlatform, ConnectionStatus, OperationalStatus } from "@/services/social";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CONNECTION_STATUS_MAP: Record<ConnectionStatus, { label: string; color: string }> = {
  nao_conectada: { label: "Não Conectada", color: "bg-slate-500/10 text-muted-foreground" },
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

const PAGE_SIZE = 24;

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState<SocialPlatform | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<SocialAccount> | null>(null);
  const [filterPlatform, setFilterPlatform] = useState<"all" | SocialPlatform>("all");
  const [filterConnection, setFilterConnection] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

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

  const platformList: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];
  const activeAccounts = useMemo(
    () => accounts.filter(account => account.status !== "archived"),
    [accounts]
  );
  const filteredAccounts = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    return activeAccounts
      .filter(account => {
        const matchesPlatform =
          filterPlatform === "all" || account.platform === filterPlatform;
        const matchesConnection =
          filterConnection === "all" ||
          (filterConnection === "connected" && account.connection_status === "conectada") ||
          (filterConnection === "attention" && account.connection_status !== "conectada") ||
          (filterConnection === "paused" && account.status === "paused");
        const searchable = [
          account.account_name,
          account.external_display_name,
          account.username,
          account.platform,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return (
          matchesPlatform &&
          matchesConnection &&
          (!normalizedSearch || searchable.includes(normalizedSearch))
        );
      })
      .sort((a, b) => {
        const platformOrder = platformList.indexOf(a.platform) - platformList.indexOf(b.platform);
        return platformOrder || a.account_name.localeCompare(b.account_name, "pt-BR");
      });
  }, [activeAccounts, filterPlatform, filterConnection, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / PAGE_SIZE));
  const paginatedAccounts = filteredAccounts.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );
  const connectedCount = activeAccounts.filter(
    account => account.connection_status === "conectada"
  ).length;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterPlatform, filterConnection, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-7 px-4 pb-12 pt-6 animate-in fade-in duration-500 sm:px-6 sm:pt-8 lg:px-10 xl:px-12">
        <div className="flex flex-col gap-5 border-b border-border/70 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="eyebrow mb-2">Canais de distribuição</p>
            <h1 className="text-2xl font-bold text-foreground font-space sm:text-3xl">
              Central de Redes Sociais
            </h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">
              Organize e monitore todos os destinos de publicação das campanhas.
            </p>
          </div>
          <Button
            className="h-11 w-full shrink-0 bg-[#7C3AED] text-white hover:bg-[#6D28D9] sm:w-auto"
            onClick={() => { setSelectedPlatform(null); setIsAddOpen(true); }}
          >
            <Plus className="mr-2 h-4 w-4" /> Adicionar Conta
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Card className="border-border bg-card p-4 sm:col-span-2 xl:col-span-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Total cadastrado</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {activeAccounts.length}<span className="text-sm font-medium text-muted-foreground"> / 400</span>
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Users size={19} />
              </div>
            </div>
            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (activeAccounts.length / 400) * 100)}%` }} />
            </div>
          </Card>

          {platformList.map(platform => {
            const count = activeAccounts.filter(account => account.platform === platform).length;
            return (
            <Card key={platform} className="border-border bg-card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {PLATFORM_LABEL[platform]}
                  </p>
                  <p className="mt-1 text-xl font-bold text-foreground">
                    {count}<span className="text-xs font-medium text-muted-foreground"> / 100</span>
                  </p>
                </div>
                <span className="text-xl" aria-hidden>{PLATFORM_ICON[platform]}</span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, count)}%` }} />
              </div>
            </Card>
          )})}

          <Card className="border-border bg-card p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Conexões</p>
                <p className="mt-1 text-sm font-bold text-emerald-400">{connectedCount} online</p>
                <p className="text-xs text-amber-400">{activeAccounts.length - connectedCount} requer atenção</p>
              </div>
              <Wifi size={20} className="text-emerald-400" />
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 rounded-2xl border border-border bg-card p-4 shadow-[var(--card-shadow)] md:grid-cols-[minmax(240px,1fr)_220px_220px_auto] md:items-center">
          <div className="relative min-w-0">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchTerm}
              onChange={event => setSearchTerm(event.target.value)}
              placeholder="Buscar por nome, usuário ou plataforma..."
              className="border-border bg-muted/40 pl-10"
            />
          </div>

          <Select value={filterPlatform} onValueChange={value => setFilterPlatform(value as "all" | SocialPlatform)}>
            <SelectTrigger className="border-border bg-muted/40">
              <SelectValue placeholder="Todas as plataformas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as plataformas</SelectItem>
              {platformList.map(platform => (
                <SelectItem key={platform} value={platform}>{PLATFORM_LABEL[platform]}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterConnection} onValueChange={setFilterConnection}>
            <SelectTrigger className="border-border bg-muted/40">
              <SelectValue placeholder="Todos os status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os status</SelectItem>
              <SelectItem value="connected">Conectadas</SelectItem>
              <SelectItem value="attention">Requer atenção</SelectItem>
              <SelectItem value="paused">Pausadas</SelectItem>
            </SelectContent>
          </Select>

          <Badge variant="secondary" className="h-9 justify-center whitespace-nowrap px-3">
            {filteredAccounts.length} {filteredAccounts.length === 1 ? "conta" : "contas"}
          </Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {paginatedAccounts.map(account => (
              <Card key={account.id} className="group flex min-w-0 flex-col overflow-hidden border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-lg">
                <div className="mb-5 flex min-w-0 items-start justify-between gap-3">
                  <div className="flex min-w-0 gap-3">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted/50 text-xl">
                      {account.profile_image_url ? (
                        <img src={account.profile_image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        PLATFORM_ICON[account.platform]
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant="outline" className="h-5 px-2 text-[9px] uppercase">
                          {PLATFORM_LABEL[account.platform]}
                        </Badge>
                        {account.status === "paused" && (
                          <Badge variant="secondary" className="h-5 px-2 text-[9px]">Pausada</Badge>
                        )}
                      </div>
                      <h3 className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{account.account_name}</h3>
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-base font-bold text-foreground transition-colors group-hover:text-primary">
                          {account.external_display_name || account.username || 'Identidade Pendente'}
                        </span>
                        {account.username && account.username !== account.external_display_name && !account.username.startsWith('tiktok_conta_') && (
                           <span className="truncate text-xs text-muted-foreground">@{account.username.replace(/^@/, "")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge className={`gap-1.5 whitespace-nowrap text-[9px] ${CONNECTION_STATUS_MAP[account.connection_status]?.color || 'bg-slate-500/10 text-muted-foreground'}`}>
                      {account.connection_status === 'conectada' ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
                      {account.connection_status === 'conectada' ? 'Conectada' : CONNECTION_STATUS_MAP[account.connection_status]?.label}
                    </Badge>
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">PostPeer</span>
                  </div>
                </div>

                <div className="mt-auto space-y-3 border-t border-border pt-4">
                  <div className="grid grid-cols-2 gap-2">
                  {account.connection_status === 'conectada' ? (
                    <>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border text-xs text-muted-foreground hover:bg-muted/50"
                        onClick={() => socialService.syncAccount(account.id)
                          .then(() => { toast.success("Sincronizado!"); loadData(); })
                          .catch((e: Error) => toast.error(e.message))}>
                        <RefreshCw className="h-3.5 w-3.5" /> Sincronizar
                      </Button>
                      <Button variant="outline" size="sm" className="h-9 gap-1.5 border-red-500/30 text-xs text-red-400 hover:bg-red-500/10"
                        onClick={() => handleDisconnect(account)}>
                        <Unlink className="h-3.5 w-3.5" /> Desconectar
                      </Button>
                    </>
                  ) : (
                    <Button variant="outline" size="sm" className="col-span-2 h-9 border-purple-500/30 text-xs text-purple-400 hover:bg-purple-500/10"
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
                  </div>

                  <div className="grid grid-cols-3 gap-1 rounded-xl bg-muted/30 p-1">
                    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => {
                      setEditingAccount(account);
                      setIsDialogOpen(true);
                    }}>
                      <Edit2 className="h-3 w-3" /> Renomear
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[10px] font-semibold text-muted-foreground hover:text-foreground" onClick={() => toggleStatus(account)}>
                      <Power className={`h-3 w-3 ${account.status === 'active' ? 'text-emerald-500' : 'text-muted-foreground'}`} />
                      {account.status === "active" ? "Pausar" : "Ativar"}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 gap-1 px-2 text-[10px] font-semibold text-muted-foreground hover:text-red-400" onClick={() => archiveAccount(account.id)}>
                      <Archive className="h-3 w-3" /> Arquivar
                    </Button>
                  </div>
                </div>
              </Card>
            ))}

            {filteredAccounts.length === 0 && (
              <div className="col-span-full rounded-3xl border-2 border-dashed border-border py-20 text-center">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mx-auto mb-4 border border-border">
                   <Plus className="text-slate-600" />
                </div>
                <h3 className="mb-2 text-xl font-bold text-foreground">Nenhuma rede social encontrada</h3>
                <p className="mb-6 text-muted-foreground">Ajuste os filtros ou conecte uma nova conta.</p>
                <Button className="bg-[#7C3AED]" onClick={() => { setSelectedPlatform(null); setIsAddOpen(true); }}>
                  Adicionar conta
                </Button>
              </div>
            )}
            </div>

            {filteredAccounts.length > 0 && (
              <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredAccounts.length)} de {filteredAccounts.length} contas
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(page => Math.max(1, page - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" /> Anterior
                  </Button>
                  <Badge variant="secondary" className="h-8 px-3">
                    {currentPage} / {totalPages}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(page => Math.min(totalPages, page + 1))}
                  >
                    Próxima <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal Simples de Edição */}
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogContent className="bg-background border-border text-foreground max-w-md">
            <DialogHeader>
              <DialogTitle className="text-xl font-space font-bold">Configurar Conta</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSaveAccount} className="space-y-6 pt-4">
              <div className="space-y-2">
                <Label>Nome Interno (Flux)</Label>
                <Input 
                  placeholder="Ex: TikTok Conta 01" 
                  className="bg-muted/50 border-border h-10"
                  value={editingAccount?.account_name || ''}
                  onChange={(e) => setEditingAccount({...editingAccount!, account_name: e.target.value})}
                />
                <p className="text-[10px] text-muted-foreground">Este nome é usado apenas para sua organização interna.</p>
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
                <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" className="bg-[#7C3AED] px-8">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modal Adicionar Conta */}
        <Dialog open={isAddOpen} onOpenChange={(open) => { setIsAddOpen(open); if (!open) { setSelectedPlatform(null); setIsConnecting(false); } }}>
          <DialogContent className="bg-background border-border text-foreground max-w-lg">
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
                    className="flex flex-col items-center gap-2 p-6 rounded-xl bg-muted/50 border border-border hover:border-purple-500/50 hover:bg-purple-500/5 transition-all"
                  >
                    <span className="text-3xl">{PLATFORM_ICON[p]}</span>
                    <span className="text-sm font-bold">{PLATFORM_LABEL[p]}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="py-6 space-y-5 text-center">
                <div className="w-16 h-16 rounded-full bg-muted/50 border border-border flex items-center justify-center mx-auto text-3xl">
                  {PLATFORM_ICON[selectedPlatform]}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed px-4">
                  Você será redirecionado para o {PLATFORM_LABEL[selectedPlatform]} para autorizar o acesso.
                </p>
                <Button
                  className="bg-[#7C3AED] hover:bg-[#6D28D9] w-full h-11"
                  disabled={isConnecting}
                  onClick={() => handleStartConnection(selectedPlatform)}
                >
                  {isConnecting ? <Loader2 className="animate-spin" /> : `CONECTAR ${PLATFORM_LABEL[selectedPlatform].toUpperCase()}`}
                </Button>
                <Button variant="ghost" className="text-muted-foreground text-xs" onClick={() => setSelectedPlatform(null)}>Voltar</Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
