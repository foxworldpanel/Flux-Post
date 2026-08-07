import { DashboardLayout } from '@/components/DashboardLayout'

export default function PublicacoesPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Publicações</h1>
        <div className="flex flex-col items-center justify-center py-20 bg-white border border-slate-200 rounded-xl text-slate-900">
          <p className="text-slate-500">Histórico de publicações em breve.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
