import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { socialService } from "@/services/social";
import {
  Activity,
  ArrowUpRight,
  BarChart3,
  Clock3,
  Eye,
  Filter,
  Gauge,
  Heart,
  Layers3,
  Loader2,
  MessageSquare,
  RefreshCw,
  RotateCcw,
  Search,
  Share2,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

type Metric = {
  id: string;
  publication_id: string | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagement_rate: number | null;
  collected_at: string | null;
};

type SocialAccount = {
  id: string;
  account_name: string | null;
  username: string | null;
  platform: string;
};

type Campaign = {
  id: string;
  nome: string;
  artist_id: string | null;
  status: string | null;
};

type Content = {
  id: string;
  title: string;
  thumbnail_url: string | null;
};

type Publication = {
  id: string;
  provider_post_id: string | null;
  post_url: string | null;
  status: string | null;
  published_at: string | null;
  created_at: string | null;
  caption: string | null;
  platform: string;
  campaign_id: string | null;
  social_account_id: string | null;
  content_id: string | null;
  social_account: SocialAccount | null;
  campaign: Campaign | null;
  content: Content | null;
};

type AnalyticsSyncResult = {
  collected?: number;
  success?: boolean;
};

const errorMessage = (error: unknown) => (error instanceof Error ? error.message : String(error));

const compactNumber = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullNumber = new Intl.NumberFormat("pt-BR");

const platformLabel = (platform?: string | null) => {
  const value = (platform || "").toLowerCase();
  if (value === "tiktok") return "TikTok";
  if (value === "instagram") return "Instagram";
  if (value === "youtube") return "YouTube";
  if (value === "facebook") return "Facebook";
  return platform || "Rede social";
};

const accountLabel = (account: SocialAccount | null | undefined) => {
  if (!account) return "Conta";
  const username = account.username
    ? account.username.startsWith("@")
      ? account.username
      : `@${account.username}`
    : "";
  return [account.account_name || "Conta", username].filter(Boolean).join(" • ");
};

const publicationTitle = (publication: Publication) =>
  publication.content?.title ||
  publication.caption?.replace(/\s+/g, " ").trim() ||
  "Publicação sem título";

const periodCutoff = (period: string) => {
  if (period === "all") return null;
  const days = Number(period.replace("d", ""));
  if (!Number.isFinite(days)) return null;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
};

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [publications, setPublications] = useState<Publication[]>([]);
  const [metrics, setMetrics] = useState<Metric[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [period, setPeriod] = useState("30d");
  const [platform, setPlatform] = useState("all");
  const [campaign, setCampaign] = useState("all");
  const [account, setAccount] = useState("all");
  const [chartMetric, setChartMetric] = useState<"views" | "interactions">("views");
  const [postSearch, setPostSearch] = useState("");

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Sessão não encontrada");

      const [publicationResult, metricResult, campaignResult, accountResult, contentResult] =
        await Promise.all([
          supabase
            .from("publications")
            .select(
              "id,provider_post_id,post_url,status,published_at,created_at,caption,platform,campaign_id,social_account_id,content_id",
            )
            .eq("user_id", user.id)
            .not("provider_post_id", "is", null)
            .order("published_at", { ascending: false, nullsFirst: false }),
          supabase
            .from("publication_metrics")
            .select("id,publication_id,views,likes,comments,shares,engagement_rate,collected_at")
            .order("collected_at", { ascending: true })
            .limit(10000),
          supabase.from("campanhas").select("id,nome,artist_id,status").eq("user_id", user.id),
          supabase
            .from("social_accounts")
            .select("id,account_name,username,platform")
            .eq("user_id", user.id),
          supabase.from("content_library").select("id,title,thumbnail_url").eq("user_id", user.id),
        ]);

      if (publicationResult.error) throw publicationResult.error;
      if (metricResult.error) throw metricResult.error;
      if (campaignResult.error) throw campaignResult.error;
      if (accountResult.error) throw accountResult.error;
      if (contentResult.error) throw contentResult.error;

      const accountMap = new Map((accountResult.data || []).map((item) => [item.id, item]));
      const campaignMap = new Map((campaignResult.data || []).map((item) => [item.id, item]));
      const contentMap = new Map((contentResult.data || []).map((item) => [item.id, item]));

      setPublications(
        (publicationResult.data || []).map((item) => ({
          ...item,
          social_account: accountMap.get(item.social_account_id) || null,
          campaign: campaignMap.get(item.campaign_id) || null,
          content: contentMap.get(item.content_id) || null,
        })) as Publication[],
      );
      setMetrics((metricResult.data || []) as Metric[]);
      setCampaigns(campaignResult.data || []);
      setAccounts(accountResult.data || []);
    } catch (error: unknown) {
      toast.error("Erro ao carregar Analytics: " + errorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, []);

  const filteredPublications = useMemo(() => {
    const cutoff = periodCutoff(period);
    return publications.filter((publication) => {
      const publicationDate = publication.published_at || publication.created_at;
      return (
        (!cutoff || (publicationDate && new Date(publicationDate) >= cutoff)) &&
        (platform === "all" || publication.platform === platform) &&
        (campaign === "all" || publication.campaign_id === campaign) &&
        (account === "all" || publication.social_account_id === account)
      );
    });
  }, [publications, period, platform, campaign, account]);

  const analytics = useMemo(() => {
    const publicationIds = new Set(filteredPublications.map((item) => item.id));
    const metricRows = metrics.filter(
      (metric) => metric.publication_id && publicationIds.has(metric.publication_id),
    );
    const latestByPublication = new Map<string, Metric>();
    const earliestByPublication = new Map<string, Metric>();
    const cutoff = periodCutoff(period);

    for (const metric of metricRows) {
      if (!metric.publication_id) continue;
      const previous = latestByPublication.get(metric.publication_id);
      if (!previous || String(metric.collected_at) > String(previous.collected_at)) {
        latestByPublication.set(metric.publication_id, metric);
      }
      if (metric.collected_at && (!cutoff || new Date(metric.collected_at) >= cutoff)) {
        const earliest = earliestByPublication.get(metric.publication_id);
        if (!earliest || String(metric.collected_at) < String(earliest.collected_at)) {
          earliestByPublication.set(metric.publication_id, metric);
        }
      }
    }

    const latest = Array.from(latestByPublication.values());
    const totals = latest.reduce(
      (result, metric) => ({
        views: result.views + (metric.views || 0),
        likes: result.likes + (metric.likes || 0),
        comments: result.comments + (metric.comments || 0),
        shares: result.shares + (metric.shares || 0),
      }),
      { views: 0, likes: 0, comments: 0, shares: 0 },
    );
    const interactions = totals.likes + totals.comments + totals.shares;
    const engagement = totals.views > 0 ? (interactions / totals.views) * 100 : 0;
    const baseline = Array.from(earliestByPublication.values()).reduce(
      (result, metric) => ({
        views: result.views + (metric.views || 0),
        likes: result.likes + (metric.likes || 0),
        comments: result.comments + (metric.comments || 0),
        shares: result.shares + (metric.shares || 0),
      }),
      { views: 0, likes: 0, comments: 0, shares: 0 },
    );
    const percentageChange = (current: number, previous: number) =>
      previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? null : 0;
    const growth = {
      views: percentageChange(totals.views, baseline.views),
      likes: percentageChange(totals.likes, baseline.likes),
      comments: percentageChange(totals.comments, baseline.comments),
      shares: percentageChange(totals.shares, baseline.shares),
    };

    const dailyPublicationMetric = new Map<string, Metric>();
    for (const metric of metricRows) {
      if (!metric.publication_id || !metric.collected_at) continue;
      const collectedAt = new Date(metric.collected_at);
      if (cutoff && collectedAt < cutoff) continue;
      const day = collectedAt.toISOString().slice(0, 10);
      const key = `${day}:${metric.publication_id}`;
      const previous = dailyPublicationMetric.get(key);
      if (!previous || String(metric.collected_at) > String(previous.collected_at)) {
        dailyPublicationMetric.set(key, metric);
      }
    }

    const daily = new Map<string, { date: string; views: number; interactions: number }>();
    for (const metric of dailyPublicationMetric.values()) {
      const day = metric.collected_at!.slice(0, 10);
      const current = daily.get(day) || { date: day, views: 0, interactions: 0 };
      current.views += metric.views || 0;
      current.interactions += (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0);
      daily.set(day, current);
    }

    const chartData = Array.from(daily.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map((item) => ({
        ...item,
        label: new Date(item.date + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "short",
        }),
      }));

    const publicationsById = new Map(filteredPublications.map((item) => [item.id, item]));
    const topPosts = latest
      .map((metric) => ({ metric, publication: publicationsById.get(metric.publication_id!) }))
      .filter((item): item is { metric: Metric; publication: Publication } =>
        Boolean(item.publication),
      )
      .sort((a, b) => (b.metric.views || 0) - (a.metric.views || 0));

    const accountTotals = new Map<
      string,
      { account: SocialAccount | null; views: number; interactions: number; posts: number }
    >();
    for (const metric of latest) {
      const publication = publicationsById.get(metric.publication_id!);
      if (!publication) continue;
      const key = publication.social_account_id || "unknown";
      const current = accountTotals.get(key) || {
        account: publication.social_account,
        views: 0,
        interactions: 0,
        posts: 0,
      };
      current.views += metric.views || 0;
      current.interactions += (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0);
      current.posts += 1;
      accountTotals.set(key, current);
    }

    const lastUpdated = metricRows.reduce<string | null>((latestDate, metric) => {
      if (!metric.collected_at) return latestDate;
      return !latestDate || metric.collected_at > latestDate ? metric.collected_at : latestDate;
    }, null);

    return {
      totals,
      growth,
      interactions,
      engagement,
      measuredPosts: latest.length,
      averageViews: latest.length ? totals.views / latest.length : 0,
      chartData,
      topPosts,
      accountTotals: Array.from(accountTotals.values()).sort((a, b) => b.views - a.views),
      lastUpdated,
    };
  }, [filteredPublications, metrics, period]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await socialService.syncPostStatuses({ forceAnalytics: true });
      await loadAnalytics();
      const syncResults: AnalyticsSyncResult[] = Array.isArray(result?.analytics)
        ? result.analytics
        : [];
      const collected = syncResults.reduce((total, item) => total + (item.collected || 0), 0);
      const failed = syncResults.filter((item) => item.success === false).length;
      if (failed) {
        toast.warning(`Sincronização concluída com falha em ${failed} conta(s)`);
      } else if (collected > 0) {
        toast.success(`Analytics atualizado: ${collected} publicação(ões)`);
      } else {
        toast.success("Analytics verificado. Nenhuma métrica nova disponível.");
      }
    } catch (error: unknown) {
      toast.error("Erro ao atualizar Analytics: " + errorMessage(error));
    } finally {
      setSyncing(false);
    }
  };

  const platforms = Array.from(
    new Set(publications.map((item) => item.platform).filter(Boolean)),
  ).sort();
  const visibleCampaigns = campaigns.filter((item) =>
    publications.some((publication) => publication.campaign_id === item.id),
  );
  const visibleAccounts = accounts.filter((item) =>
    publications.some((publication) => publication.social_account_id === item.id),
  );

  const activeFilters = [period !== "30d", platform !== "all", campaign !== "all", account !== "all"].filter(Boolean).length;
  const resetFilters = () => {
    setPeriod("30d");
    setPlatform("all");
    setCampaign("all");
    setAccount("all");
  };
  const normalizedPostSearch = postSearch.trim().toLowerCase();
  const visibleTopPosts = analytics.topPosts
    .filter(({ publication }) => {
      if (!normalizedPostSearch) return true;
      return [
        publicationTitle(publication),
        accountLabel(publication.social_account),
        platformLabel(publication.platform),
        publication.campaign?.nome,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedPostSearch);
    })
    .slice(0, 12);
  const maxAccountViews = Math.max(1, ...analytics.accountTotals.map((item) => item.views));

  const cards = [
    {
      label: "Visualizações",
      value: compactNumber.format(analytics.totals.views),
      note: `${compactNumber.format(analytics.averageViews)} por post`,
      icon: Eye,
      color: "text-violet-400",
      trend: analytics.growth.views,
      featured: true,
    },
    {
      label: "Curtidas",
      value: compactNumber.format(analytics.totals.likes),
      note: "Reações recebidas",
      icon: Heart,
      color: "text-rose-400",
      trend: analytics.growth.likes,
    },
    {
      label: "Comentários",
      value: compactNumber.format(analytics.totals.comments),
      note: "Conversas geradas",
      icon: MessageSquare,
      color: "text-sky-400",
      trend: analytics.growth.comments,
    },
    {
      label: "Compartilhamentos",
      value: compactNumber.format(analytics.totals.shares),
      note: "Distribuição orgânica",
      icon: Share2,
      color: "text-emerald-400",
      trend: analytics.growth.shares,
    },
    {
      label: "Engajamento",
      value: `${analytics.engagement.toFixed(2)}%`,
      note: `${compactNumber.format(analytics.interactions)} interações`,
      icon: Gauge,
      color: "text-amber-400",
    },
    {
      label: "Posts medidos",
      value: fullNumber.format(analytics.measuredPosts),
      note: `${analytics.accountTotals.length} conta(s)`,
      icon: Layers3,
      color: "text-purple-400",
    },
  ];

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1600px] space-y-7 px-4 pb-14 pt-6 sm:px-6 sm:pt-8 lg:px-10 xl:px-12">
        <div className="flex flex-col gap-5 border-b border-border/70 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-2 flex items-center gap-2">
              <span className="eyebrow">Inteligência de conteúdo</span>
              <Badge variant="secondary" className="h-5 rounded-full px-2 text-[9px] uppercase tracking-wider">
                Atualização 12h
              </Badge>
            </div>
            <h1 className="font-space text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Analytics</h1>
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Acompanhe alcance, engajamento e os conteúdos que mais crescem em cada rede.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 text-xs text-muted-foreground sm:mr-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-500">
                <Clock3 size={13} />
              </span>
              <span>
                {analytics.lastUpdated
                  ? `Atualizado ${new Date(analytics.lastUpdated).toLocaleString("pt-BR")}`
                  : "Aguardando a primeira coleta"}
              </span>
            </div>
            <Button onClick={handleSync} disabled={syncing} className="h-10 gap-2 rounded-full px-5">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              {syncing ? "Atualizando" : "Atualizar agora"}
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden border-border/70 bg-card/70 shadow-[var(--card-shadow)]">
          <div className="flex items-center justify-between border-b border-border/60 px-5 py-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Filter size={15} className="text-primary" /> Filtros
              {activeFilters > 0 && <Badge className="h-5 rounded-full px-2 text-[9px]">{activeFilters} ativos</Badge>}
            </div>
            <Button variant="ghost" size="sm" onClick={resetFilters} disabled={activeFilters === 0} className="h-8 gap-1.5 text-xs text-muted-foreground">
              <RotateCcw size={13} /> Limpar
            </Button>
          </div>
          <CardContent className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger className="h-10 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7d">Últimos 7 dias</SelectItem>
                  <SelectItem value="30d">Últimos 30 dias</SelectItem>
                  <SelectItem value="90d">Últimos 90 dias</SelectItem>
                  <SelectItem value="all">Todo o período</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger className="h-10 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as plataformas</SelectItem>
                  {platforms.map((item) => (
                    <SelectItem key={item} value={item}>
                      {platformLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Select value={campaign} onValueChange={setCampaign}>
                <SelectTrigger className="h-10 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as campanhas</SelectItem>
                  {visibleCampaigns.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger className="h-10 bg-muted/30">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as contas</SelectItem>
                  {visibleAccounts.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {accountLabel(item)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-foreground">Visão geral</h2>
              <p className="text-xs text-muted-foreground">Resultados consolidados dos filtros selecionados</p>
            </div>
            {loading && <Loader2 size={16} className="animate-spin text-muted-foreground" />}
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
          {cards.map((card) => (
            <Card key={card.label} className={`overflow-hidden border-border/70 bg-card transition-colors hover:border-primary/25 ${card.featured ? "ring-1 ring-primary/25" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-muted/60 ${card.color}`}>
                    <card.icon size={17} />
                  </span>
                  {card.trend !== undefined && (
                    <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${card.trend === null || card.trend >= 0 ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"}`}>
                      {card.trend === null ? "Novo" : `${card.trend >= 0 ? "+" : ""}${card.trend.toFixed(1)}%`}
                    </span>
                  )}
                </div>
                <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{card.label}</p>
                <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">{card.value}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">{card.note}</p>
              </CardContent>
            </Card>
          ))}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.75fr)]">
          <Card className="overflow-hidden border-border/70 bg-card shadow-[var(--card-shadow)]">
            <CardHeader className="flex flex-col gap-4 border-b border-border/60 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-base">Evolução de desempenho</CardTitle>
                <p className="mt-1 text-xs text-muted-foreground">Histórico das coletas realizadas no período</p>
              </div>
              <div className="flex rounded-full bg-muted/60 p-1">
                <Button variant="ghost" size="sm" onClick={() => setChartMetric("views")} className={`h-7 rounded-full px-3 text-[11px] ${chartMetric === "views" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  Visualizações
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setChartMetric("interactions")} className={`h-7 rounded-full px-3 text-[11px] ${chartMetric === "interactions" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  Interações
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              {analytics.chartData.length ? (
                <div className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analytics.chartData} barCategoryGap="28%">
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={12} />
                      <YAxis
                        tickFormatter={(value) => compactNumber.format(value)}
                        tickLine={false}
                        axisLine={false}
                        fontSize={12}
                      />
                      <Tooltip
                        formatter={(value) => [
                          fullNumber.format(Number(value || 0)),
                          chartMetric === "views" ? "Visualizações" : "Interações",
                        ]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                        }}
                        cursor={{ fill: "hsl(var(--muted))", opacity: 0.22 }}
                      />
                      <Bar
                        dataKey={chartMetric}
                        fill={chartMetric === "views" ? "#8b5cf6" : "#22c55e"}
                        radius={[8, 8, 2, 2]}
                        maxBarSize={72}
                        minPointSize={5}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[340px] flex-col items-center justify-center text-center text-muted-foreground">
                  <BarChart3 size={32} className="mb-3 opacity-40" />
                  <p className="font-medium">Aguardando dados de desempenho</p>
                  <p className="mt-1 text-xs">
                    A primeira coleta será feita automaticamente ou pelo botão acima.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-hidden border-border/70 bg-card shadow-[var(--card-shadow)]">
            <CardHeader className="border-b border-border/60 pb-4">
              <CardTitle className="flex items-center gap-2 text-base"><Trophy size={16} className="text-amber-400" /> Ranking de contas</CardTitle>
              <p className="text-xs text-muted-foreground">Quem está gerando mais alcance</p>
            </CardHeader>
            <CardContent className="space-y-2 p-4">
              {analytics.accountTotals.length ? (
                analytics.accountTotals.slice(0, 8).map((item, index) => (
                  <div
                    key={item.account?.id || index}
                    className="rounded-xl border border-transparent p-3 transition-colors hover:border-border hover:bg-muted/30"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${index === 0 ? "bg-amber-500/15 text-amber-500" : "bg-muted text-muted-foreground"}`}>{index + 1}</span>
                        <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{accountLabel(item.account)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {platformLabel(item.account?.platform)} • {item.posts} posts
                        </p>
                        </div>
                      </div>
                      <span className="shrink-0 text-sm font-semibold">{compactNumber.format(item.views)}</span>
                    </div>
                    <div className="ml-11 mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-400" style={{ width: `${Math.max(3, (item.views / maxAccountViews) * 100)}%` }} />
                    </div>
                    <div className="ml-11 mt-1.5 flex justify-between text-[10px] text-muted-foreground"><span>{fullNumber.format(item.interactions)} interações</span><span>{item.views ? ((item.interactions / item.views) * 100).toFixed(1) : "0.0"}% eng.</span></div>
                  </div>
                ))
              ) : (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma conta com métricas ainda.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="min-w-0 max-w-full overflow-hidden border-border/70 bg-card shadow-[var(--card-shadow)]">
          <CardHeader className="gap-4 border-b border-border/60 pb-4 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-base">
                <Sparkles size={17} className="text-primary" /> Desempenho dos conteúdos
              </CardTitle>
              <p className="mt-1 text-xs text-muted-foreground">Ranking dos vídeos pelos resultados mais recentes</p>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={postSearch} onChange={(event) => setPostSearch(event.target.value)} placeholder="Buscar vídeo, conta ou campanha" className="h-9 bg-muted/30 pl-9 text-xs" />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {visibleTopPosts.length ? (
              <div className="max-w-full overflow-x-auto">
                <table className="w-full min-w-[800px] table-fixed border-collapse text-left">
                  <colgroup>
                    <col className="w-14" />
                    <col className="w-[26%]" />
                    <col className="w-[19%]" />
                    <col className="w-[9%]" />
                    <col className="w-[8%]" />
                    <col className="w-[9%]" />
                    <col className="w-[10%]" />
                    <col className="w-14" />
                  </colgroup>
                  <thead>
                    <tr className="border-b border-border/60 bg-muted/20 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      <th className="px-4 py-3">#</th>
                      <th className="px-3 py-3">Conteúdo</th>
                      <th className="px-3 py-3">Rede / conta</th>
                      <th className="px-3 py-3 text-right">Views</th>
                      <th className="px-3 py-3 text-right">Curtidas</th>
                      <th className="px-3 py-3 text-right">Interações</th>
                      <th className="px-3 py-3 text-right">Engajamento</th>
                      <th className="px-3 py-3 text-center">Post</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTopPosts.map(({ metric, publication }, index) => {
                      const interactions = (metric.likes || 0) + (metric.comments || 0) + (metric.shares || 0);
                      const engagement = metric.views ? (interactions / metric.views) * 100 : 0;
                      return (
                        <tr key={publication.id} className="border-b border-border/50 transition-colors last:border-0 hover:bg-muted/25">
                          <td className="px-4 py-3"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${index < 3 ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>{index + 1}</span></td>
                          <td className="min-w-0 px-3 py-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted/60 text-muted-foreground">
                                {publication.content?.thumbnail_url ? <img src={publication.content.thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Video size={17} />}
                              </div>
                              <div className="min-w-0"><p className="truncate text-sm font-medium text-foreground">{publicationTitle(publication)}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{publication.campaign?.nome || "Sem campanha"}</p></div>
                            </div>
                          </td>
                          <td className="min-w-0 px-3 py-3"><Badge variant="outline" className="mb-1 h-5 max-w-full text-[9px] uppercase">{platformLabel(publication.platform)}</Badge><p className="truncate text-xs text-muted-foreground">{accountLabel(publication.social_account)}</p></td>
                          <td className="px-3 py-3 text-right text-sm font-semibold">{fullNumber.format(metric.views || 0)}</td>
                          <td className="px-3 py-3 text-right text-sm">{fullNumber.format(metric.likes || 0)}</td>
                          <td className="px-3 py-3 text-right text-sm">{fullNumber.format(interactions)}</td>
                          <td className="px-3 py-3 text-right"><span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-medium text-emerald-500">{engagement.toFixed(2)}%</span></td>
                          <td className="px-3 py-3 text-center">{publication.post_url ? <Button variant="ghost" size="icon" asChild className="mx-auto h-8 w-8 rounded-full"><a href={publication.post_url} target="_blank" rel="noreferrer" aria-label="Abrir publicação"><ArrowUpRight size={15} /></a></Button> : <span className="text-xs text-muted-foreground">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                {postSearch ? "Nenhum conteúdo corresponde à busca." : "Os melhores vídeos aparecerão após a primeira coleta."}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col items-center justify-between gap-2 border-t border-border/60 pt-5 text-xs text-muted-foreground sm:flex-row">
          <span>Coleta automática a cada 12 horas pelo PostPeer.</span>
          <span className="flex items-center gap-1.5"><Activity size={12} className="text-emerald-500" /> O Analytics não interfere nas publicações.</span>
        </div>
      </div>
    </DashboardLayout>
  );
}
