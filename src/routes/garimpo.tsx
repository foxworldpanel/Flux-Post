import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Play, Check, X } from 'lucide-react'

export default function GarimpoPage() {
  const categories = ["Receitas", "Natureza", "Satisfying", "Animais", "Lifestyle", "Viagens", "Humor/Memes", "Carros", "Fitness", "Curiosidades", "Relaxante", "Outros"]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Garimpo</h1>
        
        {/* Filtros */}
        <div className="bg-[#13131F] p-4 rounded-xl border border-white/5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 items-end">
          <div className="lg:col-span-2 space-y-2">
            <label className="text-sm text-slate-400">Busca</label>
            <Input placeholder="Buscar conteúdos..." className="bg-white/5 border-white/10" />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Fonte</label>
            <Select>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Fonte" /></SelectTrigger>
              <SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Categoria</label>
            <Select>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Categoria" /></SelectTrigger>
              <SelectContent>{categories.map(c => <SelectItem key={c} value={c.toLowerCase()}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-slate-400">Duração</label>
            <Select>
              <SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Duração" /></SelectTrigger>
              <SelectContent><SelectItem value="short">Curto</SelectItem></SelectContent>
            </Select>
          </div>
          <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] h-9 w-full">Buscar</Button>
        </div>

        {/* Resultados (Empty State) */}
        <div className="min-h-[300px] flex flex-col items-center justify-center border-2 border-dashed border-white/10 rounded-xl text-slate-400">
          <p>Nenhuma fonte conectada. Configure uma fonte para começar o garimpo.</p>
        </div>

        {/* Garimpo Automático */}
        <Card className="bg-[#13131F] border-white/5 text-white">
          <CardHeader><CardTitle>Garimpo Automático</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-slate-400">Status</p>
              <p className="font-semibold text-[#10B981]">Desativado</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-slate-400">Estoque atual</p>
              <p className="font-semibold">0 vídeos</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-slate-400">Última execução</p>
              <p className="font-semibold">-</p>
            </div>
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-sm text-slate-400">Próxima execução</p>
              <p className="font-semibold">-</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  )
}
