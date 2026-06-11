import { createFileRoute, Navigate } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'

export const Route = createFileRoute('/')({
  component: DashboardPage,
})

function DashboardPage() {
  // Login bypass requested by user
  const { loading } = useAuth()
  if (loading) return null

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold">Dashboard</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { title: "Contas Ativas", value: "0" },
            { title: "Posts Hoje", value: "0" },
            { title: "Na Fila", value: "0" },
            { title: "Total do Mês", value: "0" },
          ].map((card) => (
            <Card key={card.title} className="bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}

