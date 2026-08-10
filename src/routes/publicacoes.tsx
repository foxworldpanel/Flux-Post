import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  TrendingUp, 
  Calendar, 
  ExternalLink, 
  RefreshCw, 
  AlertCircle,
  Clock,
  CheckCircle2,
  Send,
  MoreVertical
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { socialService } from "@/services/social";

export default function PublicacoesPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publications, setPublications] = useState<any[]>([]);

  const fetchPublications = async () => {
    try {
      const { data, error } = await supabase
        .from('publications')
        .select(`
          *,
          content_library(title, storage_path, thumbnail_url),
          social_accounts(account_name, username)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPublications(data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar publicações: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPublications();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      await socialService.syncPostStatuses();
      await fetchPublications();
      toast.success("Status sincronizados com sucesso");
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + err.message);
    } finally {
      setSyncing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'published':
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 size={12} className="mr-1" /> PUBLICADO</Badge>;
      case 'scheduled':
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Calendar size={12} className="mr-1" /> AGENDADO</Badge>;
      case 'publishing':
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><RefreshCw size={12} className="mr-1 animate-spin" /> PUBLICANDO</Badge>;
      case 'failed':
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle size={12} className="mr-1" /> FALHOU</Badge>;
      default:
        return <Badge variant="outline" className="text-white/40 border-white/10 uppercase">{status}</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white font-space mb-2">Publicações</h1>
            <p className="text-slate-400">Histórico e status de todos os posts distribuídos.</p>
          </div>
          <Button 
            onClick={handleSync} 
            disabled={syncing || loading}
            variant="outline" 
            className="border-white/10 text-white bg-white/5 hover:bg-white/10"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
            Sincronizar Status
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-slate-400">Carregando publicações...</p>
            </div>
          ) : publications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center border border-dashed border-white/10 rounded-2xl bg-white/5 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-6">
                <Send className="w-8 h-8 text-slate-700" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">Nenhuma publicação encontrada</h3>
              <p className="text-slate-400 max-w-sm">Comece criando uma campanha ou agendando posts diretamente da biblioteca.</p>
              <Button className="mt-6 bg-[#7C3AED]" onClick={() => window.location.href = '/campanha'}>
                Criar Primeira Campanha
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {publications.map((pub) => (
                <Card key={pub.id} className="bg-[#13131F] border-white/5 hover:border-white/10 transition-colors overflow-hidden">
                  <div className="flex flex-col md:flex-row">
                    <div className="w-full md:w-48 aspect-video bg-black/40 relative">
                       {/* Aqui usaremos a thumbnail se disponível */}
                       <div className="w-full h-full flex items-center justify-center text-slate-700">
                          <TrendingUp size={32} />
                       </div>
                    </div>
                    
                    <CardContent className="flex-1 p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2">
                           {getStatusBadge(pub.status)}
                           <Badge variant="outline" className="border-white/5 text-[10px] text-slate-500 uppercase font-bold tracking-widest">{pub.platform}</Badge>
                        </div>
                        <h4 className="text-white font-medium line-clamp-1">{pub.caption || "Sem legenda"}</h4>
                        <div className="flex items-center gap-4 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Clock size={12} /> {format(new Date(pub.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp size={12} /> {pub.social_accounts?.account_name || pub.social_accounts?.username}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto">
                        {pub.post_url && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="flex-1 md:flex-none border-white/10 text-white text-xs h-8"
                            onClick={() => window.open(pub.post_url, '_blank')}
                          >
                            <ExternalLink size={14} className="mr-1" /> Ver Post
                          </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500">
                           <MoreVertical size={16} />
                        </Button>
                      </div>
                    </CardContent>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
