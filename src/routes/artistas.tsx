import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, User } from 'lucide-react'

export default function ArtistasPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Artistas</h1>
            <p className="text-slate-500 mt-1">Gerencie os artistas do label</p>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            <Plus className="mr-2 h-4 w-4" /> Novo Artista
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <Card className="bg-[#13131F] border-white/5 text-white overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] flex items-center justify-center">
              <User size={64} className="text-white/20" />
            </div>
            <CardHeader>
              <CardTitle>Sourcee</CardTitle>
              <div className="px-2 py-0.5 bg-[#10B981]/20 text-[#10B981] rounded text-xs inline-block w-fit">
                Ativo
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm text-slate-400">
                <p><span className="text-slate-300">Gênero:</span> Eletrônico / Progressive</p>
                <p><span className="text-slate-300">Hashtags:</span> #Sourcee #MelodicTechno</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
