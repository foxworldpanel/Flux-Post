import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import '@/styles.css'

export default function DashboardPage() {
  const { loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center bg-background text-primary">Carregando...</div>

  const metrics = [
    { title: "Contas Ativas", value: "0" },
    { title: "Posts Hoje", value: "0" },
    { title: "Na Fila", value: "0" },
    { title: "Total do Mês", value: "0" },
  ]

  const performance = [
    { title: "Visualizações", value: "0" },
    { title: "Likes", value: "0" },
    { title: "Comentários", value: "0" },
    { title: "Compartilhamentos", value: "0" },
  ]

  return (
    <div id="dashboard-page">
      <DashboardLayout>
        <div className="space-y-8">
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Dashboard</h1>
            <div className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-medium">
              Operação Interna
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {metrics.map((card) => (
              <Card key={card.title} className="bg-[#13131F] border-white/5 hover:border-primary/20 transition-colors">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-400">{card.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-white">{card.value}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="lg:col-span-2 bg-white border-slate-200">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Campanha Ativa</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col items-center justify-center py-12 text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
                  <p>Nenhuma campanha ativa no momento</p>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-[#13131F] border-white/5">
              <CardHeader>
                <CardTitle className="text-lg font-bold text-white">Flux Intelligence</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <p className="text-sm text-slate-400 leading-relaxed">
                      Aguardando dados de performance para gerar recomendações inteligentes.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#0A0A0F]">Performance Global</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {performance.map((card) => (
                <Card key={card.title} className="bg-white border-slate-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-500">{card.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold text-[#0A0A0F]">{card.value}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </DashboardLayout>
    </div>
  )
}
