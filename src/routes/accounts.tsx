import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/DashboardLayout'

export const Route = createFileRoute('/accounts')({
  component: AccountsPage,
})

function AccountsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Contas TikTok</h1>
        <p className="text-muted-foreground">Gerencie suas contas conectadas aqui.</p>
      </div>
    </DashboardLayout>
  )
}
