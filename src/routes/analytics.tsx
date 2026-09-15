import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  BarChart3,
  Clock3,
  ExternalLink,
  Eye,
  Heart,
  Loader2,
  MessageSquare,
  RefreshCw,
  Share2,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
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

    for (const metric of metricRows) {
      if (!metric.publication_id) continue;
      const previous = latestByPublication.get(metric.publication_id);
      if (!previous || String(metric.collected_at) > String(previous.collected_at)) {
        latestByPublication.set(metric.publication_id, metric);
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

    const cutoff = periodCutoff(period);
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
      .sort((a, b) => (b.metric.views || 0) - (a.metric.views || 0))
      .slice(0, 6);

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
      engagement,
      measuredPosts: latest.length,
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

  const cards = [
    { label: "Visualizações", value: analytics.totals.views, icon: Eye, color: "text-violet-400" },
    { label: "Curtidas", value: analytics.totals.likes, icon: Heart, color: "text-rose-400" },
    {
      label: "Comentários",
      value: analytics.totals.comments,
      icon: MessageSquare,
      color: "text-sky-400",
    },
    {
      label: "Compartilhamentos",
      value: analytics.totals.shares,
      icon: Share2,
      color: "text-emerald-400",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6 px-5 py-7 pb-14 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Resultado real das publicações em todas as contas.
            </p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <Button onClick={handleSync} disabled={syncing} className="gap-2">
              {syncing ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
              Atualizar agora
            </Button>
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 size={13} />
              {analytics.lastUpdated
                ? `Atualizado em ${new Date(analytics.lastUpdated).toLocaleString("pt-BR")}`
                : "Aguardando a primeira coleta"}
            </span>
          </div>
        </div>

        <Card className="border-border/70">
          <CardContent className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Período
              </span>
              <Select value={period} onValueChange={setPeriod}>
                <SelectTrigger>
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
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Plataforma
              </span>
              <Select value={platform} onValueChange={setPlatform}>
                <SelectTrigger>
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
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Campanha
              </span>
              <Select value={campaign} onValueChange={setCampaign}>
                <SelectTrigger>
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
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Conta
              </span>
              <Select value={account} onValueChange={setAccount}>
                <SelectTrigger>
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

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {cards.map((card) => (
            <Card key={card.label} className="border-border/70 xl:col-span-1">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <card.icon size={18} className={card.color} />
                  {loading && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                </div>
                <p className="mt-4 text-2xl font-bold">{compactNumber.format(card.value)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{card.label}</p>
              </CardContent>
            </Card>
          ))}
          <Card className="border-border/70 xl:col-span-1">
            <CardContent className="p-5">
              <Activity size={18} className="text-amber-400" />
              <p className="mt-4 text-2xl font-bold">{analytics.engagement.toFixed(2)}%</p>
              <p className="mt-1 text-xs text-muted-foreground">Engajamento</p>
            </CardContent>
          </Card>
          <Card className="border-border/70 xl:col-span-1">
            <CardContent className="p-5">
              <BarChart3 size={18} className="text-purple-400" />
              <p className="mt-4 text-2xl font-bold">
                {fullNumber.format(analytics.measuredPosts)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">Posts medidos</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-lg">Evolução das visualizações</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics.chartData.length ? (
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analytics.chartData}>
                      <defs>
                        <linearGradient id="viewsGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
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
                          "Visualizações",
                        ]}
                        contentStyle={{
                          background: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "10px",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="views"
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        fill="url(#viewsGradient)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-[320px] flex-col items-center justify-center text-center text-muted-foreground">
                  <BarChart3 size={32} className="mb-3 opacity-40" />
                  <p className="font-medium">Aguardando dados de desempenho</p>
                  <p className="mt-1 text-xs">
                    A primeira coleta será feita automaticamente ou pelo botão acima.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="text-lg">Desempenho por conta</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {analytics.accountTotals.length ? (
                analytics.accountTotals.map((item, index) => (
                  <div
                    key={item.account?.id || index}
                    className="rounded-xl border border-border/70 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-medium">{accountLabel(item.account)}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {platformLabel(item.account?.platform)} • {item.posts} posts medidos
                        </p>
                      </div>
                      <Badge variant="secondary">{compactNumber.format(item.views)} views</Badge>
                    </div>
                    <p className="mt-3 text-xs text-muted-foreground">
                      {fullNumber.format(item.interactions)} interações
                    </p>
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

        <Card className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy size={19} className="text-amber-400" />
              Vídeos com melhor desempenho
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.topPosts.length ? (
              <div className="grid gap-3 md:grid-cols-2">
                {analytics.topPosts.map(({ metric, publication }, index) => (
                  <div
                    key={publication.id}
                    className="flex gap-3 rounded-xl border border-border/70 p-4"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-purple-500/10 font-bold text-purple-400">
                      {index + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{publicationTitle(publication)}</p>
                          <p className="mt-1 truncate text-xs text-muted-foreground">
                            {accountLabel(publication.social_account)}
                          </p>
                        </div>
                        {publication.post_url && (
                          <Button variant="ghost" size="icon" asChild className="h-8 w-8 shrink-0">
                            <a
                              href={publication.post_url}
                              target="_blank"
                              rel="noreferrer"
                              aria-label="Abrir publicação"
                            >
                              <ExternalLink size={15} />
                            </a>
                          </Button>
                        )}
                      </div>
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Eye size={13} /> {fullNumber.format(metric.views || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Heart size={13} /> {fullNumber.format(metric.likes || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare size={13} /> {fullNumber.format(metric.comments || 0)}
                        </span>
                        <span className="flex items-center gap-1">
                          <Share2 size={13} /> {fullNumber.format(metric.shares || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="py-12 text-center text-sm text-muted-foreground">
                Os melhores vídeos aparecerão após a primeira coleta.
              </p>
            )}
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground">
          Coleta automática a cada 12 horas. O Analytics não interfere no envio das publicações.
        </p>
      </div>
    </DashboardLayout>
  );
}
