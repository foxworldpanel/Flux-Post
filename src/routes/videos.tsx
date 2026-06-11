import { createFileRoute } from '@tanstack/react-router'
import { DashboardLayout } from '@/components/DashboardLayout'

export const Route = createFileRoute('/videos')({
  component: VideosPage,
})

function VideosPage() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Biblioteca de Vídeos</h1>
        <p className="text-muted-foreground">Gerencie seus vídeos para postagem aqui.</p>
      </div>
    </DashboardLayout>
  )
}
