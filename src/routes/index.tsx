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
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-6 gap-4">
          <div>
            <h1 className="text-4xl font-bold text-foreground font-display tracking-tight">Flux Post <span className="text-[#7C3AED]">v3.5</span></h1>
            <p className="text-muted-foreground mt-2 text-lg">Central de Processamento e Distribuição Inteligente.</p>
          </div>
          <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 py-1.5 px-4 text-sm font-bold flex gap-2 w-fit">
            <ShieldCheck size={16} />
            AUDITORIA PRÉ-PRODUÇÃO CONCLUÍDA
          </Badge>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-card border-border backdrop-blur-sm shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total de Renders</p>
                  <h3 className="text-3xl font-bold text-foreground mt-1">{stats.totalRenders}</h3>
                </div>
                <div className="p-3 bg-primary/10 rounded-xl">
                  <Layers className="text-primary" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-sm shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Prontos / Cache</p>
                  <h3 className="text-3xl font-bold text-emerald-500 mt-1">{stats.readyRenders}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 className="text-emerald-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-sm shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Em Fila / Proc.</p>
                  <h3 className="text-3xl font-bold text-blue-500 mt-1">{stats.processingRenders}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 rounded-xl">
                  <Cpu className="text-blue-500" size={24} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border backdrop-blur-sm shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Falhas</p>
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
            <Card className="bg-card border-border overflow-hidden shadow-md">
              <CardHeader className="border-b border-border bg-muted/50">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-bold text-foreground flex items-center gap-2">
                    <Search className="text-[#7C3AED]" size={18} />
                    Histórico Global & Garimpo Inteligente
                  </CardTitle>
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-500 flex gap-2">
                    <ShieldCheck size={12} />
                    Sincronizado
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-border">
                  <AuditItem 
                    label="Identidade Canônica" 
                    desc="Deduplicação baseada estritamente no Pexels ID (external_id)." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Ocultar Utilizados" 
                    desc="Conteúdo publicado ou descartado é filtrado por padrão no Garimpo." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Paginação Backend" 
                    desc="Busca páginas adicionais automaticamente para completar o lote de vídeos novos." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Garimpo Automático" 
                    desc="Crawler avança progressivamente pelas páginas do catálogo Pexels." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Detecção de Biblioteca" 
                    desc="Vídeos já presentes no estoque são identificados e bloqueados para re-importação." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Contador de Repetidos" 
                    desc="Exibição em tempo real de quantos resultados foram ignorados por duplicidade." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Anti-Repetição p/ Conta" 
                    desc="Trava definitiva: social_account_id + content_id (Identity canonical)." 
                    status="ok" 
                  />
                   <AuditItem 
                    label="Reconciliação de Schema" 
                    desc="Alinhamento completo entre código, banco remoto e PostgREST." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Publicações: scheduled_for" 
                    desc="Unificação do campo canônico de agendamento TIMESTAMPTZ (Database & API)." 
                    status="ok" 
                  />
                  <AuditItem 
                    label="Começar Agora" 
                    desc="Cálculo dinâmico de horários imediatos com intervalos entre destinos." 
                    status="ok" 
                  />
                </div>
              </CardContent>
            </Card>
          </div>


          <div className="space-y-6">
            <Card className="bg-card border-border shadow-md">
              <CardHeader>
                <CardTitle className="text-foreground text-lg">Ações Rápidas</CardTitle>
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

            <Card className="bg-gradient-to-br from-card to-muted border-primary/20 shadow-md">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="p-3 bg-[#7C3AED]/10 rounded-full border border-[#7C3AED]/20">
                    <FileCode className="text-[#7C3AED]" size={24} />
                  </div>
                  <div>
                    <h4 className="text-foreground font-bold">Documentação Técnica</h4>
                    <p className="text-xs text-muted-foreground mt-1">Consulte os contratos e fluxos de dados do Flux Post.</p>
                  </div>
                  <Button variant="outline" className="w-full border-border hover:bg-muted text-xs h-9" asChild>
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
        <h4 className="text-sm font-bold text-foreground leading-none">{label}</h4>
        <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{desc}</p>
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
    <a href={href} className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors group border border-border/50">
      <div className={`p-2 rounded-lg transition-colors ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <p className="text-sm font-bold text-foreground">{title}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </a>
  );
}