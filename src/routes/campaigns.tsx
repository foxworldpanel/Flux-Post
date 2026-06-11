import { DashboardLayout } from '@/components/DashboardLayout'

export default function CampaignsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Campanhas</h1>
        <p className="text-muted-foreground">Configure suas automações de postagem aqui.</p>
      </div>
    </DashboardLayout>
  )
}
