import { DashboardLayout } from '@/components/DashboardLayout'

export default function GarimpoPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <h1 className="text-3xl font-display font-bold text-[#0A0A0F]">Garimpo</h1>
        <div className="flex flex-col items-center justify-center py-20 bg-[#13131F] border border-white/5 rounded-xl text-white">
          <p className="text-slate-400">Área de Garimpo em construção.</p>
        </div>
      </div>
    </DashboardLayout>
  )
}
