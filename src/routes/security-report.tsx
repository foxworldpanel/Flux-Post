import { DashboardLayout } from "@/components/DashboardLayout";
import { AlertCircle, ShieldCheck, Database, Key, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SecurityReport() {
  return (
    <DashboardLayout>
      <div className="space-y-8 p-4 md:p-8 animate-in fade-in duration-500 max-w-5xl mx-auto">
        <div className="flex items-center gap-4 border-b border-border pb-8">
          <div className="bg-purple-500/20 p-3 rounded-2xl">
            <ShieldCheck className="text-purple-500 w-8 h-8" />
          </div>
          <div>
            <h1 className="text-4xl font-space font-bold tracking-tight text-foreground mb-2">Relatório de Segurança</h1>
            <p className="text-muted-foreground text-lg">Auditoria e Consolidação — Fase 1.2</p>
          </div>
        </div>

        <section className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Key className="w-5 h-5 text-purple-500" />
                  Privilégios Anon
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Todos os privilégios <code className="bg-muted/50 px-2 py-0.5 rounded text-rose-400">SELECT, INSERT, UPDATE, DELETE</code> foram revogados para o papel <code className="bg-muted/50 px-2 py-0.5 rounded">anon</code> nas tabelas:
                </p>
                <ul className="mt-4 space-y-2 text-slate-300 text-sm">
                  <li>• artists</li>
                  <li>• content_library</li>
                  <li>• social_accounts</li>
                  <li>• publications</li>
                  <li>• publication_metrics</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle className="text-foreground flex items-center gap-2">
                  <Database className="w-5 h-5 text-purple-500" />
                  Políticas RLS
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground text-sm">
                  Políticas permissivas <code className="bg-muted/50 px-2 py-0.5 rounded italic text-rose-400">"Allow all access for now"</code> removidas. Implementadas políticas granulares baseadas em <code className="bg-muted/50 px-2 py-0.5 rounded">auth.uid()</code>.
                </p>
                <div className="mt-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                  <p className="text-emerald-400 text-xs font-medium">
                    RLS Ativo e Validado para todas as tabelas da Fase 1.2.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert className="bg-amber-500/10 border-amber-500/20 text-amber-500">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Registro Sourcee</AlertTitle>
            <AlertDescription className="text-slate-300">
              O registro "Sourcee" na tabela <code className="bg-muted/50 px-1 rounded">artists</code> permanece com <code className="bg-muted/50 px-1 rounded">user_id: NULL</code>. Por segurança, ele não foi atribuído automaticamente. Deve ser associado ao usuário correto via interface administrativa ou script controlado.
            </AlertDescription>
          </Alert>

          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground flex items-center gap-2">
                <Info className="w-5 h-5 text-blue-500" />
                Resumo da Migration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <h4 className="text-slate-200 text-sm font-bold">Policies Criadas:</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div className="p-2 bg-muted/50 rounded">Users can manage their own artists</div>
                  <div className="p-2 bg-muted/50 rounded">Users can manage their own content_library</div>
                  <div className="p-2 bg-muted/50 rounded">Users can manage their own social_accounts</div>
                  <div className="p-2 bg-muted/50 rounded">Users can manage their own publications</div>
                  <div className="p-2 bg-muted/50 rounded">Users can view metrics of their publications (EXISTS)</div>
                </div>
              </div>
              
              <div className="space-y-2">
                <h4 className="text-slate-200 text-sm font-bold">Índices de Performance:</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs text-muted-foreground">
                  <div className="p-2 bg-muted/50 rounded">idx_music_tracks_artist_id</div>
                  <div className="p-2 bg-muted/50 rounded">idx_campanhas_artist_id</div>
                  <div className="p-2 bg-muted/50 rounded">idx_content_library_artist_id</div>
                  <div className="p-2 bg-muted/50 rounded">idx_publications_campaign_id</div>
                  <div className="p-2 bg-muted/50 rounded">idx_publication_metrics_pub_id</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </section>

        <div className="pt-8 border-t border-border text-center">
          <p className="text-muted-foreground text-sm italic">
            "Segurança é um processo, não um produto. A Fase 1.2 está agora consolidada."
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
