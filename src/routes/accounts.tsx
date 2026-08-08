import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Users, Globe, Smartphone, Settings, Trash2, Archive, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { socialService, SocialAccount, SocialPlatform } from "@/services/social";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [loading, setLoading] = useState(true);

  const loadAccounts = async () => {
    try {
      setLoading(true);
      const data = await socialService.getAccounts();
      setAccounts(data as unknown as SocialAccount[]);
    } catch (err: any) {
      toast.error("Erro ao carregar contas: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const platforms: SocialPlatform[] = ['tiktok', 'instagram', 'youtube', 'facebook'];

  return (
    <DashboardLayout>
      <div className="space-y-8 p-8 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 font-space">Central de Contas Sociais</h1>
            <p className="text-slate-400">Gerencie todas as suas identidades sociais de distribuição.</p>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            <Plus className="mr-2 h-4 w-4" /> Adicionar Conta
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-[#13131F] border-white/5 p-4">
            <p className="text-sm text-slate-500 font-bold uppercase">Total</p>
            <p className="text-2xl font-bold text-white">{accounts.length}</p>
          </Card>
          <Card className="bg-[#13131F] border-white/5 p-4">
            <p className="text-sm text-slate-500 font-bold uppercase">TikTok</p>
            <p className="text-2xl font-bold text-white">{accounts.filter(a => a.platform === 'tiktok').length}</p>
          </Card>
          <Card className="bg-[#13131F] border-white/5 p-4">
            <p className="text-sm text-slate-500 font-bold uppercase">Conectadas</p>
            <p className="text-2xl font-bold text-emerald-400">{accounts.filter(a => a.connection_status === 'conectada').length}</p>
          </Card>
          <Card className="bg-[#13131F] border-white/5 p-4">
            <p className="text-sm text-slate-500 font-bold uppercase">Não Conectadas</p>
            <p className="text-2xl font-bold text-amber-400">{accounts.filter(a => a.connection_status === 'nao_conectada').length}</p>
          </Card>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-purple-500" /></div>
        ) : (
          <div className="space-y-12">
            {platforms.map(platform => {
              const platformAccounts = accounts.filter(a => a.platform === platform);
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
                          <p>Artista: {account.metadata?.artist_name || 'Nenhum'}</p>
                          <p>Posts/dia: {account.posts_per_day}</p>
                        </div>
                        <div className="flex gap-2 mt-6 pt-4 border-t border-white/5">
                           <Button variant="outline" className="flex-1 border-white/10 hover:bg-white/5">Configurar</Button>
                           <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white"><Settings size={16} /></Button>
                        </div>
                      </Card>
                    ))}
                    {platformAccounts.length === 0 && (
                      <div className="col-span-full py-12 text-center text-slate-500 border border-dashed border-white/5 rounded-xl">
                        Nenhuma conta em {platform}
                      </div>
                    )}
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
