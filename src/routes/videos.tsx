import { DashboardLayout } from '@/components/DashboardLayout'

export default function VideosPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Biblioteca de Vídeos</h1>
        <p className="text-muted-foreground">Gerencie seus vídeos para postagem aqui.</p>
      </div>
    </DashboardLayout>
  )
}
