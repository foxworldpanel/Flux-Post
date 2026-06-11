import { DashboardLayout } from '@/components/DashboardLayout'

export default function MusicsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Biblioteca de Músicas</h1>
        <p className="text-muted-foreground">Gerencie suas trilhas sonoras aqui.</p>
      </div>
    </DashboardLayout>
  )
}
