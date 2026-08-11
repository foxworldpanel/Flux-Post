import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { BarChart3, TrendingUp, Users, MessageSquare, Heart, Share2 } from 'lucide-react'

export default function AnalyticsPage() {
  const mainMetrics = [
    { label: "Visualizações", value: "0", icon: BarChart3 },
    { label: "Likes", value: "0", icon: Heart },
    { label: "Comentários", value: "0", icon: MessageSquare },
    { label: "Compartilhamentos", value: "0", icon: Share2 },
    { label: "Engajamento", value: "0%", icon: TrendingUp },
    { label: "Publicações", value: "0", icon: BarChart3 },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Analytics</h1>

        {/* Global Filters */}
        <div className="bg-card p-4 rounded-xl border border-border grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Período</label>
            <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Últimos 30 dias" /></SelectTrigger><SelectContent><SelectItem value="30d">30 dias</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Artista</label>
            <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Campanha</label>
            <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">Plataforma</label>
            <Select><SelectTrigger className="bg-muted/50 border-border"><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
          </div>
        </div>

        {/* Top Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {mainMetrics.map(metric => (
            <Card key={metric.label} className="bg-white border-slate-200">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between mb-2 text-muted-foreground">
                  <metric.icon size={16} />
                </div>
                <p className="text-2xl font-bold text-[#0A0A0F]">{metric.value}</p>
                <p className="text-xs text-slate-500 font-medium uppercase">{metric.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Charts Placeholders */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card className="bg-card border-border min-h-[300px] flex flex-col items-center justify-center text-slate-500">
            <p className="text-sm">Performance ao longo do tempo</p>
            <p className="text-xs mt-2 italic">Aguardando dados...</p>
          </Card>
          <Card className="bg-card border-border min-h-[300px] flex flex-col items-center justify-center text-slate-500">
            <p className="text-sm">Performance por plataforma</p>
            <p className="text-xs mt-2 italic">Aguardando dados...</p>
          </Card>
        </div>

        {/* Flux Intelligence */}
        <Card className="bg-card border-border overflow-hidden">
          <CardHeader className="bg-primary/5 border-b border-border">
            <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
              <TrendingUp size={20} className="text-primary" />
              Flux Intelligence
            </CardTitle>
          </CardHeader>
          <CardContent className="py-12 flex flex-col items-center justify-center text-muted-foreground italic">
            <p>Aguardando dados suficientes para gerar recomendações.</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
