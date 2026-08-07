import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import '@/styles.css'

export default function DashboardPage() {
  // Login bypass requested by user
  const { loading } = useAuth()
  if (loading) return <div className="flex h-screen items-center justify-center bg-background text-primary">Carregando...</div>

  return (
    <div id="dashboard-page">
      <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Contas Ativas", value: "0" },
            { title: "Posts Hoje", value: "0" },
            { title: "Na Fila", value: "0" },
            { title: "Total do Mês", value: "0" },
          ].map((card) => (
            <Card key={card.title} className="bg-[#13131F] border-white/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-400">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
      </DashboardLayout>
    </div>
  )
}


