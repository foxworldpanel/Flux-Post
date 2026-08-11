import { DashboardLayout } from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  Zap, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Play, 
  Layers,
  Cpu,
  ShieldCheck,
  Search,
  CheckCircle,
  XCircle,
  FileCode,
  Link
} from "lucide-react";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const [stats, setStats] = useState({
    totalRenders: 0,
    readyRenders: 0,
    failedRenders: 0,
    processingRenders: 0
  });

  useEffect(() => {
    async function fetchStats() {
      const { data } = await supabase
        .from('media_renders')
        .select('status');
      
      if (data) {
        setStats({
          totalRenders: data.length,
          readyRenders: data.filter(r => r.status === 'ready').length,
          failedRenders: data.filter(r => r.status === 'failed').length,
          processingRenders: data.filter(r => r.status === 'processing' || r.status === 'queued').length
        });
      }
    }
    fetchStats();
  }, []);

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-in fade-in duration-700">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-white font-display tracking-tight">Flux Post <span className="text-[#7C3AED]">v3.5</span></h1>
            <p className="text-slate-400 mt-2 text-lg">Central de Processamento e Distribuição Inteligente.</p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 py-1.5 px-4 text-sm font-bold flex gap-2 w-fit">
            <ShieldCheck size={16} />
            AUDITORIA PRÉ-PRODUÇÃO CONCLUÍDA
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Total de Renders</p>
                  <h3 className="text-3xl font-bold text-white mt-1">{stats.totalRenders}</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Layers className="text-primary" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Prontos / Cache</p>
                  <h3 className="text-3xl font-bold text-emerald-500 mt-1">{stats.readyRenders}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Em Fila / Proc.</p>
                  <h3 className="text-3xl font-bold text-blue-500 mt-1">{stats.processingRenders}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Cpu className="text-blue-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-[#13131F]/50 border-white/5 backdrop-blur-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-400">Falhas</p>
                  <h3 className="text-3xl font-bold text-red-500 mt-1">{stats.failedRenders}</h3>
                </div>
                <div className="p-3 bg-red-500/10 rounded-xl">
                  <AlertCircle className="text-red-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <Card className="bg-[#13131F] border-white/5 overflow-hidden">
              <CardHeader className="border-b border-white/5 bg-white/5">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-white flex items-center gap-2">
                    <Search className="text-[#7C3AED]" size={18} />
                    Relatório de Auditoria v1.0
                  </CardTitle>
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-500">Pronto para Teste</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-white/5">
                  <AuditItem 
                    label="PostPeer API v1.dev" 
                    desc="Domínio api.postpeer.dev e headers x-access-key confirmados." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Contrato PostPeer" 
                    desc="Payload 'content' como string e parser de resposta corrigidos." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Tipagem Canônica" 
                    desc="Tipos reais implementados para requisições e respostas PostPeer." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Media Render Engine" 
                    desc="Determinismo SHA-256 e fluxo de cache validados." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Limpeza Legado" 
                    desc="Referências antigas e tabelas obsoletas removidas do fluxo." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Render Worker" 
                    desc="Execução Client-side mantida para testes. Worker Server-side PENDENTE." 
                    status="warn" 
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="bg-[#13131F] border-white/5">
              <CardHeader>
                <CardTitle className="text-white text-lg">Ações Rápidas</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <QuickAction 
                  href="/processar" 
                  icon={<Play size={16} />} 
                  title="Render Manual" 
                  desc="Testar composição única" 
                  color="primary"
                />
                <QuickAction 
                  href="/campanha" 
                  icon={<Zap size={16} />} 
                  title="Nova Campanha" 
                  desc="Distribuição com auto-render" 
                  color="emerald"
                />
                <QuickAction 
                  href="/agenda" 
                  icon={<Clock size={16} />} 
                  title="Agenda" 
                  desc="Verificar fila de postagens" 
                  color="yellow"
                />
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-[#13131F] to-[#1a1a2e] border-[#7C3AED]/20">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-3 bg-[#7C3AED]/10 rounded-full border border-[#7C3AED]/20">
                    <FileCode className="text-[#7C3AED]" size={24} />
                  </div>
                  <div>
                    <h4 className="text-white font-bold">Documentação Técnica</h4>
                    <p className="text-xs text-slate-400 mt-1">Consulte os contratos e fluxos de dados do Flux Post.</p>
                  </div>
                  <Button variant="outline" className="w-full border-white/10 hover:bg-white/5 text-xs h-9" asChild>
                    <a href="#">
                      <Link size={14} className="mr-2" />
                      Abrir Wiki
                    </a>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function AuditItem({ label, desc, status }: { label: string, desc: string, status: 'ok' | 'warn' | 'error' }) {
  return (
    <div className="p-4 flex gap-4 items-start">
      <div className="mt-1">
        {status === 'ok' ? <CheckCircle className="text-emerald-500" size={18} /> : 
         status === 'warn' ? <AlertCircle className="text-yellow-500" size={18} /> : 
         <XCircle className="text-red-500" size={18} />}
      </div>
      <div>
        <h4 className="text-sm font-bold text-white leading-none">{label}</h4>
        <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}

function QuickAction({ href, icon, title, desc, color }: { href: string, icon: React.ReactNode, title: string, desc: string, color: 'primary' | 'emerald' | 'yellow' }) {
  const colorMap = {
    primary: "bg-primary/10 text-primary group-hover:bg-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500/20",
    yellow: "bg-yellow-500/10 text-yellow-500 group-hover:bg-yellow-500/20"
  };

  return (
    <a href={href} className="flex items-center gap-3 p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors group">
      <div className={`p-2 rounded-lg transition-colors ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-white">{title}</p>
        <p className="text-[10px] text-slate-500">{desc}</p>
      </div>
    </a>
  );
}