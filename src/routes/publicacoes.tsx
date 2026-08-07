import { DashboardLayout } from '@/components/DashboardLayout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'

export default function PublicacoesPage() {
  const statusCards = [
    { label: "Planejadas", value: "0", color: "text-slate-400" },
    { label: "Processando", value: "0", color: "text-blue-400" },
    { label: "Agendadas", value: "0", color: "text-amber-400" },
    { label: "Publicadas", value: "0", color: "text-emerald-400" },
    { label: "Falhas", value: "0", color: "text-rose-400" },
  ]

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Publicações</h1>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {statusCards.map(stat => (
            <Card key={stat.label} className="bg-[#13131F] border-white/5">
              <CardContent className="pt-6">
                <p className="text-sm text-slate-400">{stat.label}</p>
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-[#13131F] p-4 rounded-xl border border-white/5 flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px] space-y-2">
            <label className="text-sm text-slate-400">Campanha</label>
            <Select><SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Filtrar Campanha" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem></SelectContent></Select>
          </div>
          <div className="w-40 space-y-2">
            <label className="text-sm text-slate-400">Plataforma</label>
            <Select><SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Plataforma" /></SelectTrigger><SelectContent><SelectItem value="tiktok">TikTok</SelectItem></SelectContent></Select>
          </div>
          <div className="w-40 space-y-2">
            <label className="text-sm text-slate-400">Status</label>
            <Select><SelectTrigger className="bg-white/5 border-white/10"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem></SelectContent></Select>
          </div>
        </div>

        {/* Table / List Area */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden min-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Conteúdo</TableHead>
                <TableHead>Campanha</TableHead>
                <TableHead>Música</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead>Conta</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Views</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow>
                <TableCell colSpan={7} className="h-64 text-center text-slate-400">
                  Nenhuma publicação encontrada.
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </div>
    </DashboardLayout>
  )
}
