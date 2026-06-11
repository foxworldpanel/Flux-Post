import { DashboardLayout } from '@/components/DashboardLayout'

export default function SchedulePage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Agendamentos</h1>
        <p className="text-muted-foreground">Visualize o histórico e posts agendados aqui.</p>
      </div>
    </DashboardLayout>
  )
}
