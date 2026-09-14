import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
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
  Pause,
  Play
} from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { socialService } from "@/services/social";

const STOPPABLE_PUBLICATION_STATUSES = [
  "agendado",
  "pending",
  "scheduled",
  "waiting_render",
  "ready_to_post"
];

export default function PublicacoesPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [changingCampaign, setChangingCampaign] = useState<string | null>(null);
  const [publications, setPublications] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const fetchPublications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão não encontrada");

      // Consultas separadas: evita que uma FK/relationship ambígua do PostgREST
      // derrube a tela inteira de Publicações.
      const [pubRes, campRes, accountRes, contentRes] = await Promise.all([
        supabase
          .from("publications")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false }),
        supabase
          .from("campanhas")
          .select("*")
          .eq("user_id", user.id)
          .order("criado_em", { ascending: false }),
        supabase
          .from("social_accounts")
          .select("id, account_name, username, platform")
          .eq("user_id", user.id),
        supabase
          .from("content_library")
          .select("id, title, thumbnail_url")
          .eq("user_id", user.id)
      ]);

      if (pubRes.error) throw pubRes.error;
      if (campRes.error) throw campRes.error;
      if (accountRes.error) throw accountRes.error;
      if (contentRes.error) throw contentRes.error;

      const accountMap = new Map((accountRes.data || []).map(a => [a.id, a]));
      const contentMap = new Map((contentRes.data || []).map(c => [c.id, c]));

      setPublications((pubRes.data || []).map(pub => ({
        ...pub,
        social_account: accountMap.get(pub.social_account_id) || null,
        content: contentMap.get(pub.content_id) || null
      })));
      setCampaigns(campRes.data || []);
    } catch (err: any) {
      toast.error("Erro ao carregar publicações: " + (err?.message || String(err)));
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

  const changeCampaignStatus = async (campaign: any) => {
    const pause = campaign.status === "ativo";
    setChangingCampaign(campaign.id);
    try {
      const { error: campaignError } = await supabase
        .from("campanhas")
        .update({ status: pause ? "pausado" : "ativo" })
        .eq("id", campaign.id);
      if (campaignError) throw campaignError;

      // Ao pausar, as publicações ainda não enviadas ficam explicitamente
      // pausadas. Provider posts já criados nunca são tocados.
      if (pause) {
        const { error: publicationsError } = await supabase
          .from("publications")
          .update({ status: "paused" })
          .eq("campaign_id", campaign.id)
          .is("provider_post_id", null)
          .in("status", STOPPABLE_PUBLICATION_STATUSES);
        if (publicationsError) throw publicationsError;
      } else {
        const { error: publicationsError } = await supabase
          .from("publications")
          .update({ status: "scheduled" })
          .eq("campaign_id", campaign.id)
          .is("provider_post_id", null)
          .eq("status", "paused");
        if (publicationsError) throw publicationsError;
      }

      toast.success(pause ? "Campanha pausada" : "Campanha retomada");
      await fetchPublications();
    } catch (err: any) {
      toast.error("Erro ao alterar campanha: " + (err?.message || String(err)));
    } finally {
      setChangingCampaign(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case "published":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 size={12} className="mr-1" /> PUBLICADO</Badge>;
      case "scheduled":
      case "agendado":
      case "pending":
        return <Badge className="bg-blue-500/10 text-blue-500 border-blue-500/20"><Calendar size={12} className="mr-1" /> AGENDADO</Badge>;
      case "paused":
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20"><Pause size={12} className="mr-1" /> PAUSADO</Badge>;
      case "publishing":
      case "processing":
        return <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/20"><RefreshCw size={12} className="mr-1 animate-spin" /> PUBLICANDO</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-500 border-red-500/20"><AlertCircle size={12} className="mr-1" /> FALHOU</Badge>;
      default:
        return <Badge variant="outline" className="text-foreground/40 border-border uppercase">{status || "-"}</Badge>;
    }
  };

  const visibleCampaigns = campaigns.filter(c => c.status !== "rascunho");

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-space mb-2">Publicações</h1>
            <p className="text-muted-foreground">Campanhas, histórico e status de todos os posts distribuídos.</p>
          </div>
          <Button onClick={handleSync} disabled={syncing || loading} variant="outline" className="border-border text-foreground bg-muted/50 hover:bg-white/10">
            <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
            Sincronizar Status
          </Button>
        </div>

        {visibleCampaigns.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-xl font-semibold">Campanhas</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              {visibleCampaigns.map(campaign => {
                const campaignPubs = publications.filter(p => p.campaign_id === campaign.id);
                const published = campaignPubs.filter(p => p.status === "published").length;
                const canToggle = campaign.status === "ativo" || campaign.status === "pausado";
                return (
                  <Card key={campaign.id} className="bg-card border-border">
                    <CardContent className="p-5 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold truncate">{campaign.nome}</h3>
                          <Badge variant="outline" className="uppercase text-[10px]">{campaign.status}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{published} publicados de {campaignPubs.length} planejados</p>
                      </div>
                      {canToggle && (
                        <Button
                          variant="outline"
                          disabled={changingCampaign === campaign.id}
                          onClick={() => changeCampaignStatus(campaign)}
                        >
                          {campaign.status === "ativo" ? <Pause className="w-4 h-4 mr-2" /> : <Play className="w-4 h-4 mr-2" />}
                          {campaign.status === "ativo" ? "Pausar" : "Retomar"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Histórico de posts</h2>
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-muted/50">
              <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
              <p className="text-muted-foreground">Carregando publicações...</p>
            </div>
          ) : publications.length === 0 ? (
            <div className="py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-muted/50 text-center">
              <Send className="w-8 h-8 text-slate-700 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">Nenhuma publicação encontrada</h3>
              <Button className="mt-6 bg-[#7C3AED]" onClick={() => window.location.href = "/campanha"}>Criar Campanha</Button>
            </div>
          ) : (
            <div className="space-y-4">
              {publications.map(pub => (
                <Card key={pub.id} className="bg-card border-border overflow-hidden">
                  <CardContent className="p-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getStatusBadge(pub.status)}
                        <Badge variant="outline" className="border-border text-[10px] text-muted-foreground uppercase font-bold tracking-widest">{pub.platform || pub.social_account?.platform || "-"}</Badge>
                      </div>
                      <h4 className="text-foreground font-medium line-clamp-1">{pub.caption || pub.content?.title || "Sem legenda"}</h4>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Clock size={12} /> {format(new Date(pub.created_at), "dd 'de' MMM, HH:mm", { locale: ptBR })}</span>
                        <span className="flex items-center gap-1"><TrendingUp size={12} /> {pub.social_account?.account_name || pub.social_account?.username || "Conta"}</span>
                      </div>
                    </div>
                    {pub.post_url && (
                      <Button variant="outline" size="sm" className="border-border text-foreground text-xs h-8" onClick={() => window.open(pub.post_url, "_blank")}>
                        <ExternalLink size={14} className="mr-1" /> Ver Post
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
