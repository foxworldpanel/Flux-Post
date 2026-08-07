import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Plus, User, Globe, MessageSquare, Tag, Music2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

export default function ArtistasPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Artistas</h1>
            <p className="text-slate-500 mt-1">Gerencie os artistas e suas identidades</p>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9]">
            <Plus className="mr-2 h-4 w-4" /> Novo Artista
          </Button>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
          {/* Card do Artista Principal */}
          <Card className="bg-[#13131F] border-white/5 text-white overflow-hidden">
            <div className="h-48 bg-gradient-to-br from-[#7C3AED] to-[#4C1D95] flex items-center justify-center relative">
              <User size={80} className="text-white/20" />
              <div className="absolute bottom-4 left-6 flex items-center gap-4">
                <div className="w-20 h-20 rounded-full border-4 border-[#13131F] bg-[#1E1E2E] flex items-center justify-center overflow-hidden">
                   <User size={40} className="text-slate-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">Sourcee</h2>
                  <Badge className="bg-[#10B981]/20 text-[#10B981] border-none">Ativo</Badge>
                </div>
              </div>
            </div>
            
            <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Music2 size={12} /> Gênero
                  </label>
                  <p className="text-slate-300">Eletrônico / Progressive House</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Globe size={12} /> Mercados Prioritários
                  </label>
                  <p className="text-slate-300">Brasil, Europa, EUA</p>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <Tag size={12} /> Hashtags
                  </label>
                  <div className="flex flex-wrap gap-2 mt-1">
                    <Badge variant="outline" className="border-white/10 text-slate-400">#Sourcee</Badge>
                    <Badge variant="outline" className="border-white/10 text-slate-400">#MelodicTechno</Badge>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-2 mb-1">
                    <MessageSquare size={12} /> Identidade de Comunicação
                  </label>
                  <p className="text-sm text-slate-400 leading-relaxed italic">
                    "Foco em visuais imersivos, natureza e tecnologia. Comunicação minimalista e profunda."
                  </p>
                </div>
                <div>
                   <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 text-slate-300">
                     Editar Perfil Completo
                   </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Grid de Outros Artistas Placeholder */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="bg-[#13131F] border-white/5 border-dashed flex flex-col items-center justify-center p-8 text-slate-500 opacity-50">
               <Plus size={32} className="mb-2" />
               <p className="text-sm">Vaga disponível</p>
            </Card>
          </div>
        </div>

        {/* Briefing da IA Section Placeholder */}
        <Card className="bg-[#13131F] border-white/5">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
              <MessageSquare size={18} className="text-primary" />
              Briefing para IA (Criação de Legendas)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-white/5 rounded-lg border border-white/10 text-slate-400 text-sm italic">
              "Gere legendas curtas, preferencialmente em inglês, com tom misterioso e focado na vibe da música. Use no máximo 3 emojis relacionados a espaço ou tecnologia."
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
