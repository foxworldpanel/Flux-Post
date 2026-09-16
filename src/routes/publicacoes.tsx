import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Activity,
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  ExternalLink,
  History,
  Pause,
  Play,
  RefreshCw,
  Send,
  TrendingUp,
  Trash2,
  Users,
  XCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { socialService } from "@/services/social";

const normalizeStatus = (status?: string | null) => (status || "").toLowerCase();
const ACTIVE_CAMPAIGN_STATUSES = new Set(["ativo", "pausado"]);
const SCHEDULED_STATUSES = new Set([
  "agendado",
  "pending",
  "scheduled",
  "waiting_render",
  "ready_to_post",
  "queued",
  "paused",
]);
const TERMINAL_STATUSES = new Set(["published", "failed", "cancelled", "canceled"]);

const accountLabel = (account: any) => {
  if (!account) return "Conta";
  const name = account.account_name || "Conta";
  const rawUsername = account.username?.trim();
  if (!rawUsername) return name;
  const username = rawUsername.startsWith("@") ? rawUsername : "@" + rawUsername;
  return name + " • " + username;
};

const safeDate = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const shortDate = (value?: string | null) => {
  if (!value) return "—";
  const date = value.length <= 10 ? new Date(value + "T12:00:00") : safeDate(value);
  return date && !Number.isNaN(date.getTime()) ? format(date, "dd/MM/yyyy") : "—";
};

const shortTime = (value?: string | null) => value ? value.slice(0, 5) : "—";

const publicationMoment = (publication: any) =>
  publication.scheduled_for || publication.published_at || publication.created_at;

const publicationMomentLabel = (publication: any) => {
  const date = safeDate(publicationMoment(publication));
  return date
    ? format(date, "dd 'de' MMM 'às' HH:mm", { locale: ptBR })
    : "Data não informada";
};

export default function PublicacoesPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [changingCampaign, setChangingCampaign] = useState<string | null>(null);
  const [deletingCampaign, setDeletingCampaign] = useState<string | null>(null);
  const [campaignToDelete, setCampaignToDelete] = useState<any | null>(null);
  const [cleaningStale, setCleaningStale] = useState(false);
  const [showStaleCleanup, setShowStaleCleanup] = useState(false);
  const [expandedCampaign, setExpandedCampaign] = useState<string | null>(null);
  const [showFinished, setShowFinished] = useState(false);
  const [publications, setPublications] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);

  const fetchPublications = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão não encontrada");

      const [pubRes, campRes, accountRes, contentRes] = await Promise.all([
        supabase.from("publications").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
        supabase.from("campanhas").select("*").eq("user_id", user.id).order("criado_em", { ascending: false }),
        supabase.from("social_accounts").select("id, account_name, username, platform").eq("user_id", user.id),
        supabase.from("content_library").select("id, title, thumbnail_url").eq("user_id", user.id),
      ]);

      if (pubRes.error) throw pubRes.error;
      if (campRes.error) throw campRes.error;
      if (accountRes.error) throw accountRes.error;
      if (contentRes.error) throw contentRes.error;

      const accountMap = new Map((accountRes.data || []).map(account => [account.id, account]));
      const contentMap = new Map((contentRes.data || []).map(contentItem => [contentItem.id, contentItem]));

      setPublications((pubRes.data || []).map(publication => ({
        ...publication,
        social_account: accountMap.get(publication.social_account_id) || null,
        content: contentMap.get(publication.content_id) || null,
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
      const result = await socialService.syncPostStatuses();
      await fetchPublications();
      const checked = typeof result?.checked === "number" ? ": " + result.checked + " verificados" : "";
      toast.success("Status sincronizados" + checked);
    } catch (err: any) {
      toast.error("Erro ao sincronizar: " + (err?.message || String(err)));
    } finally {
      setSyncing(false);
    }
  };

  const changeCampaignStatus = async (campaign: any) => {
    const pause = campaign.status === "ativo";
    setChangingCampaign(campaign.id);
    try {
      const { data, error } = await supabase.rpc("set_campaign_paused", {
        p_campaign_id: campaign.id,
        p_paused: pause,
      });
      if (error) throw error;
      if (data && (data as any).ok === false) {
        throw new Error((data as any).error || "Não foi possível alterar a campanha");
      }
      toast.success(pause ? "Campanha pausada" : "Campanha retomada");
      await fetchPublications();
    } catch (err: any) {
      toast.error("Erro ao alterar campanha: " + (err?.message || String(err)));
    } finally {
      setChangingCampaign(null);
    }
  };

  const deleteCampaign = async () => {
    if (!campaignToDelete?.id) return;

    setDeletingCampaign(campaignToDelete.id);
    try {
      const { data, error } = await (supabase as any).rpc("delete_campaign_atomic", {
        p_campaign_id: campaignToDelete.id,
      });
      if (error) throw error;
      if (!data || (data as any).ok !== true) {
        throw new Error((data as any)?.error || "O banco não confirmou a exclusão");
      }

      const removed = Number((data as any).removed_publications || 0);
      const preserved = Number((data as any).preserved_publications || 0);
      setCampaignToDelete(null);
      setExpandedCampaign(current =>
        current === campaignToDelete.id ? null : current
      );
      toast.success(
        preserved > 0
          ? `Campanha excluída. ${removed} agendamentos removidos e ${preserved} posts publicados preservados no histórico.`
          : `Campanha excluída. ${removed} agendamentos removidos.`
      );
      await fetchPublications();
    } catch (err: any) {
      toast.error("Erro ao excluir campanha: " + (err?.message || String(err)));
    } finally {
      setDeletingCampaign(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const current = normalizeStatus(status);
    switch (current) {
      case "published":
        return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"><CheckCircle2 size={12} className="mr-1" />PUBLICADO</Badge>;
      case "scheduled":
      case "agendado":
      case "pending":
      case "queued":
      case "waiting_render":
      case "ready_to_post":
        return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20"><Calendar size={12} className="mr-1" />AGENDADO</Badge>;
      case "paused":
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20"><Pause size={12} className="mr-1" />PAUSADO</Badge>;
      case "publishing":
      case "processing":
        return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20"><RefreshCw size={12} className="mr-1 animate-spin" />PUBLICANDO</Badge>;
      case "failed":
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20"><AlertCircle size={12} className="mr-1" />FALHOU</Badge>;
      case "cancelled":
      case "canceled":
        return <Badge className="bg-slate-500/10 text-slate-400 border-slate-500/20"><XCircle size={12} className="mr-1" />CANCELADO</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground border-border uppercase">{status || "-"}</Badge>;
    }
  };

  const getCampaignBadge = (status: string) => {
    const current = normalizeStatus(status);
    if (current === "ativo") {
      return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">ATIVA</Badge>;
    }
    if (current === "pausado") {
      return <Badge className="bg-amber-500/10 text-amber-400 border-amber-500/20">PAUSADA</Badge>;
    }
    if (current === "concluido" || current === "concluído") {
      return <Badge className="bg-violet-500/10 text-violet-400 border-violet-500/20">CONCLUÍDA</Badge>;
    }
    return <Badge variant="outline" className="text-muted-foreground border-border uppercase">{status || "ENCERRADA"}</Badge>;
  };

  const visibleCampaigns = useMemo(
    () => campaigns.filter(campaign => normalizeStatus(campaign.status) !== "rascunho"),
    [campaigns],
  );

  const publicationsByCampaign = useMemo(() => {
    const grouped = new Map<string, any[]>();
    publications.forEach(publication => {
      if (!publication.campaign_id) return;
      const current = grouped.get(publication.campaign_id) || [];
      current.push(publication);
      grouped.set(publication.campaign_id, current);
    });
    return grouped;
  }, [publications]);

  const campaignSortTime = (campaign: any, upcoming: boolean) => {
    const campaignPublications = publicationsByCampaign.get(campaign.id) || [];
    const publicationTimes = campaignPublications
      .filter(publication => !upcoming || (
        SCHEDULED_STATUSES.has(normalizeStatus(publication.status)) &&
        !publication.provider_post_id
      ))
      .map(publication => safeDate(publicationMoment(publication))?.getTime() || 0)
      .filter(Boolean);

    if (publicationTimes.length > 0) {
      return upcoming ? Math.min(...publicationTimes) : Math.max(...publicationTimes);
    }

    return safeDate(campaign.data_inicio || campaign.start_date || campaign.criado_em)?.getTime() || 0;
  };

  const activeCampaigns = useMemo(
    () => visibleCampaigns
      .filter(campaign => ACTIVE_CAMPAIGN_STATUSES.has(normalizeStatus(campaign.status)))
      .sort((left, right) => campaignSortTime(left, true) - campaignSortTime(right, true)),
    [visibleCampaigns, publicationsByCampaign],
  );

  const finishedCampaigns = useMemo(
    () => visibleCampaigns
      .filter(campaign => !ACTIVE_CAMPAIGN_STATUSES.has(normalizeStatus(campaign.status)))
      .sort((left, right) => campaignSortTime(right, false) - campaignSortTime(left, false)),
    [visibleCampaigns, publicationsByCampaign],
  );

  const standalonePublications = useMemo(
    () => publications.filter(publication => !publication.campaign_id),
    [publications],
  );

  const staleStandalonePublications = useMemo(() => {
    const staleBefore = Date.now() - 2 * 60 * 1000;
    return standalonePublications.filter(publication => {
      if (!["publishing", "processing"].includes(normalizeStatus(publication.status))) {
        return false;
      }
      const updatedAt = safeDate(publication.updated_at || publication.created_at);
      return Boolean(updatedAt && updatedAt.getTime() < staleBefore);
    });
  }, [standalonePublications]);

  const scheduledTotal = publications.filter(publication =>
    SCHEDULED_STATUSES.has(normalizeStatus(publication.status))
  ).length;
  const publishingTotal = publications.filter(publication =>
    ["publishing", "processing"].includes(normalizeStatus(publication.status))
  ).length;
  const publishedTotal = publications.filter(publication =>
    normalizeStatus(publication.status) === "published"
  ).length;
  const problemTotal = publications.filter(publication =>
    normalizeStatus(publication.status) === "failed"
  ).length;

  const toggleHistory = (campaignId: string) => {
    setExpandedCampaign(current => current === campaignId ? null : campaignId);
  };

  const cleanupStalePublications = async () => {
    setCleaningStale(true);
    try {
      const { data, error } = await (supabase as any).rpc(
        "cleanup_stale_orphan_publications"
      );
      if (error) throw error;
      if (!data || (data as any).ok !== true) {
        throw new Error((data as any)?.error || "O banco não confirmou a limpeza");
      }

      const removed = Number((data as any).removed_publications || 0);
      setShowStaleCleanup(false);
      toast.success(
        removed === 1
          ? "1 publicação travada foi removida."
          : `${removed} publicações travadas foram removidas.`
      );
      await fetchPublications();
    } catch (err: any) {
      toast.error("Erro ao limpar publicações: " + (err?.message || String(err)));
    } finally {
      setCleaningStale(false);
    }
  };

  const renderPublicationHistory = (campaignPublications: any[]) => {
    const ordered = [...campaignPublications].sort((left, right) => {
      const leftTime = safeDate(publicationMoment(left))?.getTime() || 0;
      const rightTime = safeDate(publicationMoment(right))?.getTime() || 0;
      return rightTime - leftTime;
    });

    if (ordered.length === 0) {
      return <div className="py-8 text-center text-sm text-muted-foreground">Nenhum post registrado nesta campanha.</div>;
    }

    return <div className="max-h-[520px] overflow-y-auto pr-1 space-y-2">
      {ordered.map(publication => <div key={publication.id} className="rounded-xl border border-border/70 bg-background/40 p-3 md:p-4">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {getStatusBadge(publication.status)}
              <Badge variant="outline" className="border-border text-[10px] text-muted-foreground uppercase tracking-wider">
                {publication.platform || publication.social_account?.platform || "-"}
              </Badge>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Clock size={12} />{publicationMomentLabel(publication)}
              </span>
            </div>
            <p className="text-sm font-medium text-foreground line-clamp-2">
              {publication.caption || publication.content?.title || "Sem legenda"}
            </p>
            <div className="flex items-center gap-x-4 gap-y-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><TrendingUp size={12} />{accountLabel(publication.social_account)}</span>
              {publication.content?.title && <span className="truncate max-w-[320px]">{publication.content.title}</span>}
            </div>
            {normalizeStatus(publication.status) === "failed" && publication.error_message && (
              <p className="text-xs text-red-400 line-clamp-2">{publication.error_message}</p>
            )}
          </div>
          {publication.post_url && <Button
            variant="outline"
            size="sm"
            className="border-border text-foreground text-xs shrink-0"
            onClick={() => window.open(publication.post_url, "_blank")}
          >
            <ExternalLink size={14} className="mr-1" />Ver post
          </Button>}
        </div>
      </div>)}
    </div>;
  };

  const renderCampaignCard = (campaign: any, compact = false) => {
    const campaignPublications = publicationsByCampaign.get(campaign.id) || [];
    const published = campaignPublications.filter(publication => normalizeStatus(publication.status) === "published").length;
    const scheduled = campaignPublications.filter(publication => SCHEDULED_STATUSES.has(normalizeStatus(publication.status))).length;
    const inProgress = campaignPublications.filter(publication => ["publishing", "processing"].includes(normalizeStatus(publication.status))).length;
    const failed = campaignPublications.filter(publication => normalizeStatus(publication.status) === "failed").length;
    const cancelled = campaignPublications.filter(publication => ["cancelled", "canceled"].includes(normalizeStatus(publication.status))).length;
    const handled = campaignPublications.filter(publication =>
      Boolean(publication.provider_post_id) || TERMINAL_STATUSES.has(normalizeStatus(publication.status))
    ).length;
    const progress = campaignPublications.length > 0
      ? Math.min(100, Math.round((handled / campaignPublications.length) * 100))
      : 0;
    const accountCount = new Set(campaignPublications.map(publication => publication.social_account_id).filter(Boolean)).size;
    const nextPublication = campaignPublications
      .filter(publication =>
        SCHEDULED_STATUSES.has(normalizeStatus(publication.status)) &&
        !publication.provider_post_id &&
        safeDate(publication.scheduled_for)
      )
      .sort((left, right) =>
        (safeDate(left.scheduled_for)?.getTime() || 0) - (safeDate(right.scheduled_for)?.getTime() || 0)
      )[0];
    const canToggle = ["ativo", "pausado"].includes(normalizeStatus(campaign.status));
    const expanded = expandedCampaign === campaign.id;
    const dateStart = campaign.data_inicio || campaign.start_date;
    const dateEnd = campaign.data_fim || campaign.end_date;
    const timeStart = campaign.daily_start_time || campaign.horario_inicio;
    const timeEnd = campaign.daily_end_time || campaign.horario_fim;
    const postsPerDay = campaign.posts_por_dia || campaign.posts_per_day;

    return <Card
      key={campaign.id}
      className={"h-full overflow-hidden bg-card border-border transition-colors " + (normalizeStatus(campaign.status) === "ativo" ? "border-primary/35" : "")}
    >
      <CardContent className={(compact ? "p-4" : "p-5 md:p-6") + " h-full"}>
        <div className="flex h-full flex-col gap-5">
          <div className={compact ? "relative" : "relative min-h-[108px]"}>
            <div className={nextPublication && normalizeStatus(campaign.status) === "ativo" ? "min-w-0 sm:pr-40" : "min-w-0"}>
              <div className="mb-2 flex min-w-0 items-center gap-2">
                <h3 className="min-w-0 flex-1 truncate text-lg font-semibold text-foreground">{campaign.nome || "Campanha sem nome"}</h3>
                {getCampaignBadge(campaign.status)}
              </div>
              <div className="flex min-h-10 flex-wrap content-start gap-x-4 gap-y-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Calendar size={14} className="text-primary" />
                  {shortDate(dateStart)} até {shortDate(dateEnd)}
                </span>
                {(timeStart || timeEnd) && <span className="flex items-center gap-1.5">
                  <Clock size={14} className="text-primary" />
                  {shortTime(timeStart)}–{shortTime(timeEnd)}
                </span>}
                <span className="flex items-center gap-1.5">
                  <Users size={14} className="text-primary" />
                  {accountCount} {accountCount === 1 ? "conta" : "contas"}
                </span>
                {postsPerDay && <span>{postsPerDay} posts/dia por conta</span>}
              </div>
            </div>
            {nextPublication && normalizeStatus(campaign.status) === "ativo" && <div className="mt-3 w-fit rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 sm:absolute sm:right-0 sm:top-0 sm:mt-0">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Próximo post</p>
              <p className="text-sm font-semibold text-primary">{publicationMomentLabel(nextPublication)}</p>
            </div>}
          </div>

          {!compact && <div className="grid min-h-[68px] grid-cols-2 gap-2 lg:grid-cols-4">
            <div className="rounded-lg bg-muted/40 p-3"><p className="text-xl font-semibold">{campaignPublications.length}</p><p className="text-[11px] text-muted-foreground">Total de posts</p></div>
            <div className="rounded-lg bg-blue-500/5 p-3"><p className="text-xl font-semibold text-blue-400">{scheduled}</p><p className="text-[11px] text-muted-foreground">Agendados</p></div>
            <div className="rounded-lg bg-emerald-500/5 p-3"><p className="text-xl font-semibold text-emerald-400">{published}</p><p className="text-[11px] text-muted-foreground">Publicados</p></div>
            <div className="rounded-lg bg-amber-500/5 p-3"><p className="text-xl font-semibold text-amber-400">{inProgress}</p><p className="text-[11px] text-muted-foreground">Publicando</p></div>
          </div>}

          <div className={compact ? "" : "min-h-[52px]"}>
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Progresso de envio</span>
              <span className="font-medium text-foreground">{handled} de {campaignPublications.length} ({progress}%)</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: progress + "%" }} />
            </div>
            {(failed > 0 || cancelled > 0) && <p className="mt-2 text-xs text-muted-foreground">
              {failed > 0 ? failed + (failed === 1 ? " falha" : " falhas") : ""}
              {failed > 0 && cancelled > 0 ? " • " : ""}
              {cancelled > 0 ? cancelled + (cancelled === 1 ? " cancelado" : " cancelados") : ""}
            </p>}
          </div>

          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-border/70 pt-4">
            <Button
              variant={expanded ? "secondary" : "outline"}
              size="sm"
              onClick={() => toggleHistory(campaign.id)}
            >
              <History size={15} className="mr-2" />
              {expanded ? "Fechar histórico" : "Ver histórico (" + campaignPublications.length + ")"}
              {expanded ? <ChevronUp size={14} className="ml-2" /> : <ChevronDown size={14} className="ml-2" />}
            </Button>
            {canToggle && <Button
              variant="outline"
              size="sm"
              disabled={changingCampaign === campaign.id}
              onClick={() => changeCampaignStatus(campaign)}
            >
              {normalizeStatus(campaign.status) === "ativo"
                ? <Pause className="w-4 h-4 mr-2" />
                : <Play className="w-4 h-4 mr-2" />}
              {normalizeStatus(campaign.status) === "ativo" ? "Pausar" : "Retomar"}
            </Button>}
            <Button
              variant="outline"
              size="sm"
              className="border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={deletingCampaign === campaign.id || changingCampaign === campaign.id}
              onClick={() => setCampaignToDelete(campaign)}
            >
              {deletingCampaign === campaign.id
                ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                : <Trash2 className="w-4 h-4 mr-2" />}
              Excluir
            </Button>
          </div>

          {expanded && <div className="border-t border-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h4 className="font-semibold">Histórico da campanha</h4>
                <p className="text-xs text-muted-foreground">Posts organizados pela data e hora programada.</p>
              </div>
            </div>
            {renderPublicationHistory(campaignPublications)}
          </div>}
        </div>
      </CardContent>
    </Card>;
  };

  return <DashboardLayout>
    <AlertDialog
      open={Boolean(campaignToDelete)}
      onOpenChange={open => {
        if (!open && !deletingCampaign) setCampaignToDelete(null);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir esta campanha?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <span className="block">
              A campanha <strong className="text-foreground">{campaignToDelete?.nome || "sem nome"}</strong> será removida permanentemente.
            </span>
            <span className="block">
              Agendamentos ainda não enviados serão cancelados. Posts já publicados nas redes serão preservados no histórico e não serão apagados das plataformas.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={Boolean(deletingCampaign)}>Manter campanha</AlertDialogCancel>
          <AlertDialogAction
            disabled={Boolean(deletingCampaign)}
            onClick={event => {
              event.preventDefault();
              void deleteCampaign();
            }}
            className="bg-red-600 text-white hover:bg-red-500"
          >
            {deletingCampaign ? "Excluindo..." : "Excluir campanha"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <AlertDialog
      open={showStaleCleanup}
      onOpenChange={open => {
        if (!cleaningStale) setShowStaleCleanup(open);
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Limpar publicações travadas?</AlertDialogTitle>
          <AlertDialogDescription>
            Serão removidos {staleStandalonePublications.length} registros órfãos presos em “Publicando”. Posts concluídos nas redes e seu histórico publicado não serão apagados.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={cleaningStale}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={cleaningStale}
            onClick={event => {
              event.preventDefault();
              void cleanupStalePublications();
            }}
            className="bg-red-600 text-white hover:bg-red-500"
          >
            {cleaningStale ? "Limpando..." : "Limpar travadas"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground font-space mb-2">Publicações</h1>
          <p className="text-muted-foreground">Acompanhe cada campanha sem misturar os históricos.</p>
        </div>
        <Button
          onClick={handleSync}
          disabled={syncing || loading}
          variant="outline"
          className="border-border text-foreground bg-muted/50 hover:bg-white/10"
        >
          <RefreshCw className={"w-4 h-4 mr-2 " + (syncing ? "animate-spin" : "")} />
          Sincronizar status
        </Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="bg-card border-border"><CardContent className="p-4 flex items-center gap-3"><Activity className="text-emerald-400" size={21} /><div><p className="text-2xl font-semibold">{activeCampaigns.length}</p><p className="text-xs text-muted-foreground">Campanhas em andamento</p></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 flex items-center gap-3"><Calendar className="text-blue-400" size={21} /><div><p className="text-2xl font-semibold">{scheduledTotal}</p><p className="text-xs text-muted-foreground">Posts agendados</p></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 flex items-center gap-3"><RefreshCw className="text-amber-400" size={21} /><div><p className="text-2xl font-semibold">{publishingTotal}</p><p className="text-xs text-muted-foreground">Publicando agora</p></div></CardContent></Card>
        <Card className="bg-card border-border"><CardContent className="p-4 flex items-center gap-3"><CheckCircle2 className={problemTotal > 0 ? "text-red-400" : "text-violet-400"} size={21} /><div><p className="text-2xl font-semibold">{publishedTotal}</p><p className="text-xs text-muted-foreground">Posts publicados{problemTotal > 0 ? " • " + problemTotal + " falhas" : ""}</p></div></CardContent></Card>
      </div>

      {loading ? <div className="py-20 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-muted/30">
        <RefreshCw className="w-8 h-8 text-primary animate-spin mb-4" />
        <p className="text-muted-foreground">Carregando campanhas...</p>
      </div> : <>
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Campanhas em andamento</h2>
            <p className="text-sm text-muted-foreground">Ativas e pausadas, ordenadas para acompanhamento diário.</p>
          </div>
          {activeCampaigns.length === 0
            ? <div className="py-12 flex flex-col items-center justify-center border border-dashed border-border rounded-2xl bg-muted/20 text-center">
                <Send className="w-8 h-8 text-muted-foreground mb-3" />
                <h3 className="font-semibold text-foreground">Nenhuma campanha em andamento</h3>
                <Button className="mt-5 bg-[#7C3AED]" onClick={() => window.location.href = "/campanha"}>Criar campanha</Button>
              </div>
            : <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
                {activeCampaigns.map(campaign => renderCampaignCard(campaign))}
              </div>}
        </section>

        {standalonePublications.length > 0 && <section className="space-y-3">
          <Card className="bg-card border-border">
            <CardContent className="p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center justify-between text-left"
                  onClick={() => toggleHistory("__standalone__")}
                >
                  <div>
                    <h2 className="text-lg font-semibold">Publicações avulsas</h2>
                    <p className="text-sm text-muted-foreground">{standalonePublications.length} posts sem campanha vinculada</p>
                  </div>
                  {expandedCampaign === "__standalone__" ? <ChevronUp /> : <ChevronDown />}
                </button>
                {staleStandalonePublications.length > 0 && <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300"
                  onClick={() => setShowStaleCleanup(true)}
                >
                  <Trash2 size={14} className="mr-2" />
                  Limpar travadas ({staleStandalonePublications.length})
                </Button>}
              </div>
              {expandedCampaign === "__standalone__" && <div className="border-t border-border mt-4 pt-4">
                {renderPublicationHistory(standalonePublications)}
              </div>}
            </CardContent>
          </Card>
        </section>}

        {finishedCampaigns.length > 0 && <section className="space-y-4">
          <button
            type="button"
            className="w-full flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setShowFinished(current => !current)}
          >
            <div>
              <h2 className="text-lg font-semibold">Campanhas encerradas</h2>
              <p className="text-sm text-muted-foreground">{finishedCampaigns.length} campanhas arquivadas</p>
            </div>
            {showFinished ? <ChevronUp className="text-muted-foreground" /> : <ChevronDown className="text-muted-foreground" />}
          </button>
          {showFinished && <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
            {finishedCampaigns.map(campaign => renderCampaignCard(campaign, true))}
          </div>}
        </section>}
      </>}
    </div>
  </DashboardLayout>;
}
