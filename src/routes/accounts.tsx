import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Settings, Archive, Power } from "lucide-react";
import { toast } from "sonner";
import { socialService, SocialAccount, SocialPlatform } from "@/services/social";
import { artistService } from "@/services/artists";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<(SocialAccount & { artist?: { name: string } | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await socialService.getAccounts();
      setAccounts(data as any);
    } catch (err: any) {
      toast.error("Erro ao carregar contas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const toggleStatus = async (account: SocialAccount) => {
    const newStatus = account.status === 'active' ? 'paused' : 'active';
    try {
      await socialService.updateAccount(account.id, { status: newStatus });
      toast.success(`Conta ${newStatus === 'active' ? 'ativada' : 'pausada'} com sucesso.`);
      loadAccounts();
    } catch (err: any) {
      toast.error("Erro ao atualizar status: " + err.message);
    }
  };

  const archiveAccount = async (id: string) => {
    if (!confirm("Tem certeza que deseja arquivar esta conta?")) return;
    try {
      await socialService.archiveAccount(id);
      toast.success("Conta arquivada com sucesso.");
      loadAccounts();
    } catch (err: any) {
      toast.error("Erro ao arquivar: " + err.message);
    }
  };

  const platforms: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-space">Central de Contas Sociais</h1>
            <p className="text-slate-400">Gerencie todas as suas identidades sociais de distribuição.</p>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]" onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Adicionar Conta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-sm text-slate-500 font-bold uppercase">Total</p><p className="text-2xl font-bold text-white">{accounts.length}</p></Card>
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-sm text-slate-500 font-bold uppercase">TikTok</p><p className="text-2xl font-bold text-white">{accounts.filter(a => a.platform === 'tiktok').length}</p></Card>
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-sm text-slate-500 font-bold uppercase">Conectadas</p><p className="text-2xl font-bold text-emerald-400">{accounts.filter(a => a.connection_status === 'conectada').length}</p></Card>
          <Card className="bg-[#13131F] border-white/5 p-4"><p className="text-sm text-slate-500 font-bold uppercase">Não Conectadas</p><p className="text-2xl font-bold text-amber-400">{accounts.filter(a => a.connection_status === 'nao_conectada').length}</p></Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-500" /></div>
        ) : (
          <div className="space-y-12">
            {platforms.map(platform => {
              const platformAccounts = accounts.filter(a => a.platform === platform && a.status !== 'archived');
              if (platformAccounts.length === 0) return null;
              return (
                <section key={platform}>
                  <h2 className="text-xl font-bold text-white uppercase tracking-wider mb-6 flex items-center gap-3">
                    {platform} <Badge className="bg-white/10">{platformAccounts.length}</Badge>
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {platformAccounts.map(account => (
                      <Card key={account.id} className="bg-[#13131F] border-white/5 p-6 hover:border-purple-500/30 transition-all">
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="text-lg font-bold text-white">{account.account_name}</h3>
                            <p className="text-sm text-slate-400">@{account.username}</p>
                          </div>
                          <Badge className={account.connection_status === 'conectada' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-slate-500/10 text-slate-400'}>
                            {account.connection_status === 'conectada' ? '🟢 Conectada' : '⚪ Não Conectada'}
                          </Badge>
                        </div>
                        <div className="space-y-2 text-sm text-slate-400">
                          <p>Artista: {account.artist?.name || 'Label / Gravadora'}</p>
                          <p>Status: <span className={account.status === 'active' ? 'text-emerald-400' : 'text-amber-400'}>{account.status}</span></p>
                          <p>Posts/dia: {account.posts_per_day}</p>
                          <div className="flex gap-1 flex-wrap mt-2">
                            {account.preferred_categories?.map(cat => <Badge key={cat} className="bg-white/5 text-[10px]">{cat}</Badge>)}
                          </div>
                        </div>
                        <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
                          <Button variant="outline" size="sm" className="flex-1 border-white/10" onClick={() => toast.info("Configuração em breve")}>Configurar</Button>
                          <Button variant="ghost" size="icon" onClick={() => toggleStatus(account)}><Power size={16} /></Button>
                          <Button variant="ghost" size="icon" onClick={() => archiveAccount(account.id)} className="text-red-400"><Archive size={16} /></Button>
                        </div>
                      </Card>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
