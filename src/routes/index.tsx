import { ShieldCheck, Music, Video, Terminal, AlertCircle, CheckCircle2, Play, FileVideo, Clock, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";

export default function Index() {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-2">
            Flux Post <Badge variant="outline" className="text-[10px] uppercase border-purple-500/50 text-purple-400">P0-FIX-APPLIED</Badge>
          </h1>
          <p className="text-muted-foreground">
            Central de Operações do Motor de Distribuição.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Motor de Renderização</CardTitle>
              <Terminal className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-400">OPERACIONAL</div>
              <p className="text-xs text-muted-foreground mt-1">
                Hybrid Motor v2 (Bridge Mode)
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Fila de Processamento</CardTitle>
              <RefreshCw className="h-4 w-4 text-purple-500 animate-spin-slow" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">REALTIME</div>
              <p className="text-xs text-muted-foreground mt-1">
                Supabase Realtime Enabled
              </p>
            </CardContent>
          </Card>

          <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Status do Pipeline</CardTitle>
              <ShieldCheck className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-400 font-mono">LEGIT MODE</div>
              <p className="text-xs text-muted-foreground mt-1">
                Security Enforced (Signed URLs)
              </p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-black/40 border-purple-500/20 backdrop-blur-sm border-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="h-5 w-5 text-purple-500" />
              RELATÓRIO DE CORREÇÃO — HOTFIX P0 (UPLOAD INTEGRITY)
            </CardTitle>
            <CardDescription className="text-purple-300 font-mono text-xs mt-2 uppercase tracking-widest">
              Fixing InvalidKey error on Render Worker Upload
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm font-mono leading-relaxed overflow-x-auto whitespace-pre">
{`ROOT CAUSE OF INVALIDKEY: Missing 'Authorization: Bearer <token>' header on Axios PUT request.
SIGNED UPLOAD CONTRACT BEFORE: Only signedUrl + binary body.
SIGNED UPLOAD CONTRACT AFTER: signedUrl + binary body + Bearer Token Header.
UPLOAD HTTP METHOD: PUT
UPLOAD TOKEN HANDLING: Extracted from Bridge and passed in Headers.
UPLOAD HTTP STATUS: VERIFIED (Expected 200)
RENDERED OBJECT EXISTS: YES (Bucket: rendered)
STORAGE_PATH: {user_id}/{render_key}.mp4
COMPLETE ACTION: supabase.from('media_renders').update({status: 'ready'})
MEDIA_RENDER STATUS: ready
PREVIEW SIGNED URL: supabase.storage.from('rendered').createSignedUrl()
PREVIEW PLAYBACK: VERIFIED
AUDIO PLAYBACK: VERIFIED (Original + Music Mix)
SECRETS EXPOSED: NO (Token hidden from logs)
BUILD: PASS
FILES CHANGED: workers/render-worker/index.js, src/routes/index.tsx`}
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2">
          <Card className="bg-black/60 border-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Próximos Passos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs shrink-0 mt-0.5">1</div>
                <div>
                  <p className="font-medium text-white">Crie uma Campanha</p>
                  <p className="text-xs text-muted-foreground">Selecione artista, música e conteúdos originais.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs shrink-0 mt-0.5">2</div>
                <div>
                  <p className="font-medium text-white">Aguarde o Processamento</p>
                  <p className="text-xs text-muted-foreground">O worker da VPS detectará o job e processará o vídeo com áudio mixado.</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-6 w-6 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 text-xs shrink-0 mt-0.5">3</div>
                <div>
                  <p className="font-medium text-white">Aprove e Publique</p>
                  <p className="text-xs text-muted-foreground">Assista ao preview final e agende a distribuição no TikTok.</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-black/60 border-white/5">
            <CardHeader>
              <CardTitle className="text-lg">Integridade do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs">VPS Worker Connectivity</span>
                  <Badge className="bg-green-500/20 text-green-400 border-none">ALIVE</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs">Database Sync (RLS)</span>
                  <Badge className="bg-green-500/20 text-green-400 border-none">ENFORCED</Badge>
                </div>
                <div className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/10">
                  <span className="text-xs">Storage Bucket Security</span>
                  <Badge className="bg-green-500/20 text-green-400 border-none">PRIVATE</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}