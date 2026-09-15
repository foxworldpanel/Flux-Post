import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  Layers3,
  Megaphone,
  PlayCircle,
  Radio,
  Send,
  Sparkles,
  Users,
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

const quickActions = [
  {
    title: "Criar campanha",
    description: "Selecione vídeos, música, contas e horários.",
    href: "/campanha",
    icon: Sparkles,
  },
  {
    title: "Acompanhar publicações",
    description: "Veja campanhas ativas, agenda e histórico.",
    href: "/publicacoes",
    icon: Send,
  },
  {
    title: "Analisar resultados",
    description: "Compare visualizações e engajamento.",
    href: "/analytics",
    icon: BarChart3,
  },
];

export default function Index() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [campaigns, publications, accounts, renders] = await Promise.all([
        supabase.from("campanhas").select("id", { count: "exact", head: true }),
        supabase.from("publications").select("id", { count: "exact", head: true }),
        supabase
          .from("social_accounts")
          .select("id", { count: "exact", head: true })
          .eq("connection_status", "conectada")
          .or("status.is.null,status.neq.archived"),
        supabase.from("media_renders").select("id", { count: "exact", head: true }),
      ]);

      return {
        campaigns: campaigns.count || 0,
        publications: publications.count || 0,
        accounts: accounts.count || 0,
        renders: renders.count || 0,
      };
    },
  });

  const metrics = [
    {
      label: "Campanhas",
      value: stats?.campaigns || 0,
      icon: Megaphone,
      accent: "bg-violet-500/12 text-violet-400",
    },
    {
      label: "Publicações",
      value: stats?.publications || 0,
      icon: CheckCircle2,
      accent: "bg-emerald-500/12 text-emerald-400",
    },
    {
      label: "Contas conectadas",
      value: stats?.accounts || 0,
      icon: Users,
      accent: "bg-sky-500/12 text-sky-400",
    },
    {
      label: "Vídeos processados",
      value: stats?.renders || 0,
      icon: PlayCircle,
      accent: "bg-amber-500/12 text-amber-400",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8 px-5 py-7 pb-14 lg:px-9 lg:py-9">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow mb-2">Visão geral</p>
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Seu estúdio de conteúdo
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground sm:text-base">
              Crie, distribua e acompanhe suas campanhas em um só lugar.
            </p>
          </div>
          <Button asChild className="w-fit gap-2">
            <Link to="/campanha">
              <Sparkles size={16} />
              Nova campanha
            </Link>
          </Button>
        </div>

        <Card className="relative overflow-hidden border-primary/15 bg-gradient-to-br from-violet-500/10 via-card to-card">
          <div className="pointer-events-none absolute -right-20 -top-28 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
          <CardContent className="relative flex flex-col gap-6 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
                <Radio size={22} />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold">Operação ativa</h2>
                  <span className="rounded-full bg-emerald-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    Online
                  </span>
                </div>
                <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
                  O Flux Post está monitorando a agenda, protegendo contra duplicidades e
                  distribuindo o conteúdo aprovado.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" className="shrink-0 gap-2">
              <Link to="/publicacoes">
                Ver operação
                <ArrowRight size={15} />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric) => (
            <Card
              key={metric.label}
              className="group transition-transform duration-200 hover:-translate-y-0.5"
            >
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl ${metric.accent}`}
                  >
                    <metric.icon size={18} />
                  </div>
                  {isLoading && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-primary" />
                  )}
                </div>
                <p className="mt-6 text-3xl font-bold tracking-tight">
                  {metric.value.toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.45fr_1fr]">
          <Card>
            <CardHeader>
              <div>
                <p className="eyebrow mb-2">Atalhos</p>
                <CardTitle className="text-xl">Continue seu trabalho</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {quickActions.map((action) => (
                <Link
                  key={action.href}
                  to={action.href}
                  className="group rounded-2xl border border-border/70 bg-muted/35 p-4 transition-all hover:border-primary/25 hover:bg-accent/70"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-card text-primary">
                    <action.icon size={17} />
                  </div>
                  <h3 className="mt-5 text-sm font-semibold">{action.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                    {action.description}
                  </p>
                  <ArrowRight
                    size={15}
                    className="mt-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary"
                  />
                </Link>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <p className="eyebrow mb-2">Serviços</p>
              <CardTitle className="text-xl">Status do sistema</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {[
                { label: "Agendamento de campanhas", icon: CalendarClock },
                { label: "Worker de processamento", icon: Layers3 },
                { label: "Publicação social", icon: Activity },
              ].map((service) => (
                <div
                  key={service.label}
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-4 py-3.5"
                >
                  <div className="flex items-center gap-3">
                    <service.icon size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{service.label}</span>
                  </div>
                  <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                    Operacional
                  </span>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
