/**
 * DIAGNÓSTICO POSTPEER REAL
 */
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Music, 
  Video, 
  TrendingUp, 
  ShieldCheck, 
  Globe,
  Share2,
  AlertCircle,
  Terminal,
  CheckCircle2,
  XCircle,
  Bug,
  Activity
} from "lucide-react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Link } from "react-router-dom";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function DashboardPage() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<any>(null);

  const runDiagnostic = async () => {
    setLoading(true);
    setReport(null);
    try {
      // 1. Auditoria no Banco para encontrar TikTok Conta 02
      const { data: accounts } = await supabase
        .from('social_accounts')
        .select('*')
        .ilike('account_name', '%TikTok Conta 02%');
      
      const targetAccount = accounts?.[0];
      
      // 2. Tentar Reparo/Recuperação Real
      let repairResult = null;
      if (targetAccount) {
        const { data } = await supabase.functions.invoke('postpeer-repair', {
          body: { social_account_id: targetAccount.id }
        });
        repairResult = data;
      }

      // 3. Rodar diagnóstico de API padrão
      const { data: diagData } = await supabase.functions.invoke('postpeer-connect', {
        body: { diagnostic: true }
      });
      
      // 4. Verificar se a conta agora está sincronizada via postpeer-sync (para validar)
      let finalSync = null;
      if (targetAccount) {
        const { data } = await supabase.functions.invoke('postpeer-sync', {
          body: { social_account_id: targetAccount.id }
        });
        finalSync = data;
      }

      // Recarregar a conta para ver o estado final do banco
      const { data: updatedAccount } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('id', targetAccount?.id)
        .single();

      setReport({
        ...diagData,
        recovery: {
          account_found: !!targetAccount,
          provider_profile_id: updatedAccount?.provider_profile_id || 'N/A',
          provider_connection_id: updatedAccount?.provider_connection_id || 'N/A',
          repair_success: repairResult?.success,
          sync_success: finalSync?.success,
          status_atual: updatedAccount?.connection_status
        }
      });
    } catch (err: any) {
      setReport({ error: true, message: err.message });
    } finally {
      setLoading(false);
    }
  };


  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 animate-in fade-in duration-500">
        
        <Card className="bg-[#0A0A0F] border-[#7C3AED]/30 p-8 space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10">
            <Bug size={120} className="text-[#7C3AED]" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-white font-space flex items-center gap-3">
              <ShieldCheck className="text-[#7C3AED]" /> Diagnóstico & Recuperação PostPeer
            </h2>
            <p className="text-slate-400 text-sm">Auditoria real e sincronização forçada de contas TikTok conectadas.</p>
          </div>

          <div className="bg-[#13131F] border border-[#7C3AED]/20 p-4 rounded-lg space-y-3">
             <div className="flex items-center gap-3">
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">TikTok Conta 02</Badge>
                <span className="text-xs text-slate-500">Integration status no PostPeer: <b className="text-white">VALID = YES</b></span>
             </div>
             <p className="text-[10px] text-slate-400 leading-relaxed uppercase font-bold tracking-tighter">
                A integração existe no PostPeer mas o Flux não vinculou. O botão abaixo tentará localizar a integração pelo Profile ID e sincronizar automaticamente.
             </p>
          </div>


          {!report && !loading && (
            <div className="py-8 text-center">
              <Button onClick={runDiagnostic} className="bg-[#7C3AED] hover:bg-[#6D28D9] gap-2 px-8 py-6 text-lg h-auto">
                <Activity className="w-5 h-5" /> Iniciar Auditoria & Recuperação
              </Button>

              <p className="text-slate-500 text-xs mt-4">Isso executará chamadas health, profile e connect contra api.postpeer.dev</p>
            </div>
          )}

          {loading && (
            <div className="py-12 flex flex-col items-center justify-center space-y-4">
              <div className="w-12 h-12 border-4 border-[#7C3AED]/20 border-t-[#7C3AED] rounded-full animate-spin" />
              <p className="text-[#7C3AED] font-bold animate-pulse">EXECUTANDO STAGES DIAGNÓSTICOS...</p>
            </div>
          )}

          {report && (
            <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ResultItem 
                  label="A. health/auth Status" 
                  value={report.error?.endpoint === '/health/auth' ? report.error.status : (report.health ? '200 OK' : 'Pendente')} 
                  success={!!report.health} 
                />
                <ResultItem 
                  label="B. health/auth OK?" 
                  value={report.health?.ok ? 'SIM' : 'NÃO'} 
                  success={report.health?.ok === true} 
                />
                <ResultItem 
                  label="C. create profile Status" 
                  value={report.error?.endpoint === '/profiles' ? report.error.status : (report.profile ? '200/201' : 'Pendente')} 
                  success={!!report.profile} 
                />
                <ResultItem 
                  label="D. profile.id retornado?" 
                  value={report.profile?.id || report.profile?.data?.id || 'NÃO'} 
                  success={!!(report.profile?.id || report.profile?.data?.id)} 
                />
                <ResultItem 
                  label="E. connect/tiktok Status" 
                  value={report.error?.endpoint?.includes('/connect/tiktok') ? report.error.status : (report.connect_no_redirect ? '200 OK' : 'Pendente')} 
                  success={!!report.connect_no_redirect} 
                />
                <ResultItem 
                  label="F. connect/tiktok retornou URL?" 
                  value={report.connect_no_redirect?.url ? 'SIM' : 'NÃO'} 
                  success={!!report.connect_no_redirect?.url} 
                />
                <ResultItem 
                  label="G. Funciona sem redirectUri?" 
                  value={report.connect_no_redirect ? 'SIM' : 'NÃO'} 
                  success={!!report.connect_no_redirect} 
                />
                <ResultItem 
                  label="H. Funciona com redirectUri?" 
                  value={report.connect_with_redirect ? 'SIM' : 'NÃO'} 
                  success={!!report.connect_with_redirect} 
                />
                <ResultItem 
                  label="I. social_account Localizada?" 
                  value={report.recovery?.account_found ? 'SIM' : 'NÃO'} 
                  success={report.recovery?.account_found} 
                />
                <ResultItem 
                  label="J. Profile ID Persistido?" 
                  value={report.recovery?.provider_profile_id || 'N/A'} 
                  success={report.recovery?.provider_profile_id !== 'N/A'} 
                />
                <ResultItem 
                  label="K. Recuperação Real Sucesso?" 
                  value={report.recovery?.sync_success ? 'SIM' : 'FALHA'} 
                  success={report.recovery?.sync_success} 
                />
                <ResultItem 
                  label="L. provider_connection_id?" 
                  value={report.recovery?.provider_connection_id || 'N/A'} 
                  success={report.recovery?.provider_connection_id !== 'N/A'} 
                />
                <ResultItem 
                  label="M. Status Final da Conta" 
                  value={report.recovery?.status_atual || 'Pendente'} 
                  success={report.recovery?.status_atual === 'conectada'} 
                />
              </div>

              <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
                {report.recovery?.recovered && (
                  <div className="bg-emerald-500/10 border border-emerald-500/30 p-4 rounded-lg mb-4">
                    <p className="text-emerald-400 text-sm font-bold flex items-center gap-2">
                       <CheckCircle2 size={16} /> CONTA RECUPERADA COM SUCESSO!
                    </p>
                    <p className="text-emerald-400/70 text-[11px] mt-1">
                      A integração existente no PostPeer foi vinculada à conta local. O Dashboard agora deve mostrar 1 conta conectada.
                    </p>
                  </div>
                )}

                <div>
                  <h4 className="text-[#7C3AED] font-bold text-sm uppercase tracking-wider mb-1">I. Body/Mensagem do Erro Real</h4>
                  <pre className="text-amber-400 text-xs bg-black/40 p-3 rounded-lg overflow-x-auto whitespace-pre-wrap">
                    {report.error ? JSON.stringify(report.error.full_data || report.error.message || report.details, null, 2) : "Nenhum erro detectado."}
                  </pre>
                </div>
                <div>
                  <h4 className="text-[#7C3AED] font-bold text-sm uppercase tracking-wider mb-1">J. Etapa Exata que Falhou</h4>
                  <p className="text-white text-sm font-mono">
                    {report.stages?.[report.stages.length - 1] || "START"} 
                    {report.error ? ` -> FAILED AT ${report.error.endpoint}` : " -> ALL STAGES OK"}
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="text-[#7C3AED] font-bold text-sm uppercase tracking-wider mb-1">K. Causa Identificada</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {report.error ? "A API PostPeer retornou um erro estruturado. Verifique se as credenciais de plataforma estão configuradas no dashboard da PostPeer ou se o payload JSON mudou na v1." : "Infraestrutura e comunicação com PostPeer v1 (.dev) totalmente operacionais."}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-[#7C3AED] font-bold text-sm uppercase tracking-wider mb-1">L. Correção Necessária</h4>
                    <p className="text-slate-300 text-sm leading-relaxed">
                      {report.error ? "Ajustar o mapeamento de campos (ex: .id vs .data.id) ou atualizar a secret POSTPEER_API_KEY se o status for 401/403." : "Nenhuma correção necessária. O sistema está pronto para produção."}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-between items-center">
                <Button variant="ghost" onClick={() => setReport(null)} className="text-slate-500 hover:text-white">Limpar Relatório</Button>
                <Link to="/accounts">
                  <Button className="bg-[#7C3AED] hover:bg-[#6D28D9] gap-2">
                    Ir para Central de Contas <Share2 size={16} />
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard title="Artistas" value="0" icon={<Users className="w-5 h-5" />} />
          <MetricCard title="Músicas" value="0" icon={<Music className="w-5 h-5" />} />
          <MetricCard title="Vídeos" value="0" icon={<Video className="w-5 h-5" />} />
          <MetricCard title="Contas Sociais" value="0" icon={<Globe className="w-5 h-5" />} />
        </div>
      </div>
    </DashboardLayout>
  );
}

function ResultItem({ label, value, success }: { label: string; value: string; success: boolean }) {
  return (
    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/5">
      <span className="text-xs text-slate-400">{label}</span>
      <div className="flex items-center gap-2 max-w-[60%] overflow-hidden">
        <span className={`text-[10px] font-bold truncate ${success ? 'text-emerald-400' : 'text-amber-400'}`}>{value}</span>
        {success ? <CheckCircle2 size={14} className="text-emerald-500 shrink-0" /> : <XCircle size={14} className="text-amber-500 shrink-0" />}
      </div>
    </div>
  );
}

function MetricCard({ title, value, icon }: { title: string; value: string; icon: React.ReactNode }) {
  return (
    <Card className="bg-[#13131F] border-white/5 p-6 hover:border-[#7C3AED]/30 transition-all group">
      <div className="flex justify-between items-start mb-4">
        <div className="p-2 bg-white/5 rounded-lg border border-white/10 group-hover:border-[#7C3AED]/50 transition-colors">
          {icon}
        </div>
      </div>
      <p className="text-sm text-slate-500 uppercase font-bold tracking-wider">{title}</p>
      <h3 className="text-3xl font-bold text-white mt-1 font-space">{value}</h3>
    </Card>
  );
}
