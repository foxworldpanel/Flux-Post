import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Check,
  Copy,
  Image as ImageIcon,
  Layers3,
  Library,
  Loader2,
  Mic2,
  Music2,
  Search,
  Sparkles,
  Upload,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

interface MotivationalScript {
  title: string;
  hook: string;
  narration: string;
  closing: string;
  visualKeywords: string[];
  estimatedSeconds: number;
}

const productionSteps = [
  {
    title: "Buscar imagens",
    description: "Selecione cenas verticais no Pexels.",
    icon: Search,
    href: "/garimpo",
  },
  {
    title: "Organizar mídia",
    description: "Revise vídeos disponíveis na Biblioteca.",
    icon: Library,
    href: "/biblioteca",
  },
  {
    title: "Escolher trilha",
    description: "Defina as músicas do Sourcee para a produção.",
    icon: Music2,
    href: "/musicas",
  },
  {
    title: "Montar campanha",
    description: "Aprove, distribua e agende o conteúdo final.",
    icon: Layers3,
    href: "/campanha",
  },
];

export default function StudioIaPage() {
  const navigate = useNavigate();
  const [theme, setTheme] = useState("recomeço, coragem e confiança");
  const [tone, setTone] = useState("emocional e acolhedor");
  const [audience, setAudience] = useState("adultos buscando motivação diária");
  const [duration, setDuration] = useState("30");
  const [quantity, setQuantity] = useState("3");
  const [includeCta, setIncludeCta] = useState(false);
  const [loading, setLoading] = useState(false);
  const [scripts, setScripts] = useState<MotivationalScript[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const totalMinutes = useMemo(
    () => Math.ceil((Number(duration) * Number(quantity)) / 60),
    [duration, quantity],
  );

  const generateScripts = async () => {
    if (!theme.trim()) {
      toast.error("Informe o tema das mensagens.");
      return;
    }

    try {
      setLoading(true);
      setScripts([]);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) throw new Error("Sessão expirada. Entre novamente.");

      const { data, error } = await supabase.functions.invoke(
        "campaign-copy-generator",
        {
          body: {
            action: "motivational_scripts",
            motivational: {
              theme: theme.trim(),
              tone,
              audience: audience.trim(),
              durationSeconds: Number(duration),
              quantity: Number(quantity),
              includeCta,
            },
          },
          headers: { Authorization: `Bearer ${session.access_token}` },
        },
      );

      if (error) throw error;
      if (!data?.success || !Array.isArray(data.scripts)) {
        throw new Error(data?.error || "A IA não retornou roteiros válidos.");
      }

      setScripts(data.scripts);
      toast.success(`${data.scripts.length} roteiros criados para revisão.`);
    } catch (error: any) {
      console.error("[Studio IA] Motivational generation failed", error);
      toast.error(error?.message || "Não foi possível gerar os roteiros.");
    } finally {
      setLoading(false);
    }
  };

  const copyScript = async (script: MotivationalScript, index: number) => {
    await navigator.clipboard.writeText(script.narration);
    setCopiedIndex(index);
    toast.success("Roteiro copiado.");
    window.setTimeout(() => setCopiedIndex(null), 1800);
  };

  return (
    <DashboardLayout>
      <div className="mx-auto w-full max-w-[1440px] space-y-8 px-4 pb-14 pt-6 sm:px-6 sm:pt-8 lg:px-10 xl:px-12">
        <header className="flex flex-col gap-5 border-b border-border/70 pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <p className="eyebrow">Workspace Sourcee</p>
              <Badge className="border-violet-500/20 bg-violet-500/10 text-violet-400">
                Produção inteligente
              </Badge>
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Studio IA
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
              Crie roteiros em lote e organize o caminho completo até a publicação.
              Narração, legendas, artes e geração de vídeo entrarão aqui sem misturar
              o fluxo editorial das campanhas.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button variant="outline" className="gap-2" onClick={() => navigate("/garimpo")}>
              <Search size={16} />
              Pexels
            </Button>
            <Button variant="outline" className="gap-2" onClick={() => navigate("/biblioteca")}>
              <Upload size={16} />
              Biblioteca
            </Button>
          </div>
        </header>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Card className="border-violet-500/25 bg-gradient-to-br from-violet-500/12 via-card to-card">
            <CardContent className="p-5">
              <div className="mb-6 flex items-start justify-between gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-500 text-white shadow-lg shadow-violet-950/20">
                  <Mic2 size={21} />
                </div>
                <Badge className="bg-emerald-500/10 text-emerald-400">Disponível</Badge>
              </div>
              <h2 className="font-display text-lg font-bold">Roteiro motivacional</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Gere mensagens únicas, curtas e preparadas para narração.
              </p>
            </CardContent>
          </Card>

          {[
            {
              title: "Narração e legendas",
              description: "Voz ElevenLabs, timing e legendas sincronizadas.",
              icon: Video,
            },
            {
              title: "Gerador de artes",
              description: "Imagem por IA com texto e identidade aplicados pelo sistema.",
              icon: ImageIcon,
            },
            {
              title: "Produção em massa",
              description: "Combine cenas, roteiros e músicas em vários renders.",
              icon: Sparkles,
            },
          ].map((item) => (
            <Card key={item.title} className="bg-card/80">
              <CardContent className="p-5">
                <div className="mb-6 flex items-start justify-between gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <item.icon size={21} />
                  </div>
                  <Badge variant="outline" className="text-muted-foreground">
                    Próxima etapa
                  </Badge>
                </div>
                <h2 className="font-display text-lg font-bold">{item.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {item.description}
                </p>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card className="overflow-hidden border-border bg-card">
            <div className="border-b border-border bg-muted/20 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-400">
                  <Sparkles size={19} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-bold">Criar lote de roteiros</h2>
                  <p className="text-sm text-muted-foreground">
                    Revise os textos antes de gerar voz ou vídeo.
                  </p>
                </div>
              </div>
            </div>

            <CardContent className="space-y-5 p-5 sm:p-6">
              <div className="space-y-2">
                <Label htmlFor="theme">Tema central</Label>
                <Textarea
                  id="theme"
                  value={theme}
                  onChange={(event) => setTheme(event.target.value)}
                  placeholder="Ex.: superar um momento difícil e voltar a acreditar em si"
                  className="min-h-24 resize-none"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Tom da mensagem</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="emocional e acolhedor">Emocional e acolhedor</SelectItem>
                      <SelectItem value="forte e transformador">Forte e transformador</SelectItem>
                      <SelectItem value="calmo e reflexivo">Calmo e reflexivo</SelectItem>
                      <SelectItem value="direto e energético">Direto e energético</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="audience">Público</Label>
                  <Input
                    id="audience"
                    value={audience}
                    onChange={(event) => setAudience(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Duração por vídeo</Label>
                  <Select value={duration} onValueChange={setDuration}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 segundos</SelectItem>
                      <SelectItem value="30">30 segundos</SelectItem>
                      <SelectItem value="40">40 segundos</SelectItem>
                      <SelectItem value="60">60 segundos</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Select value={quantity} onValueChange={setQuantity}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[1, 3, 5, 8, 10].map((value) => (
                        <SelectItem key={value} value={String(value)}>
                          {value} {value === 1 ? "roteiro" : "roteiros"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center justify-between gap-4 rounded-2xl border border-border bg-muted/25 p-4">
                <div>
                  <p className="text-sm font-semibold">Chamada final</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Inclui um convite natural para acompanhar novos conteúdos.
                  </p>
                </div>
                <Switch checked={includeCta} onCheckedChange={setIncludeCta} />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{quantity} criações independentes</span>
                <span>≈ {totalMinutes} min de conteúdo</span>
              </div>

              <Button
                className="h-12 w-full gap-2 bg-violet-600 text-white hover:bg-violet-500"
                disabled={loading}
                onClick={generateScripts}
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
                {loading ? "Criando roteiros..." : "Gerar roteiros com IA"}
              </Button>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="eyebrow mb-2">Revisão editorial</p>
                <h2 className="font-display text-2xl font-bold">Roteiros gerados</h2>
              </div>
              {scripts.length > 0 && <Badge variant="outline">{scripts.length} prontos</Badge>}
            </div>

            {scripts.length === 0 ? (
              <Card className="border-dashed bg-card/50">
                <CardContent className="flex min-h-[410px] flex-col items-center justify-center p-8 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                    <Mic2 size={26} />
                  </div>
                  <h3 className="mt-5 font-display text-lg font-bold">Nenhum roteiro gerado</h3>
                  <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                    Configure o primeiro lote. Os textos aparecerão aqui para revisão antes das etapas pagas de voz e renderização.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
                {scripts.map((script, index) => (
                  <Card key={`${script.title}-${index}`} className="bg-card">
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-400">
                              {index + 1}
                            </span>
                            <h3 className="truncate font-display font-bold">{script.title}</h3>
                            <Badge variant="outline" className="text-[10px]">
                              ~{script.estimatedSeconds}s
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => copyScript(script, index)}
                          aria-label="Copiar roteiro"
                        >
                          {copiedIndex === index ? <Check size={16} /> : <Copy size={16} />}
                        </Button>
                      </div>

                      <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/90">
                        {script.narration}
                      </p>

                      {script.visualKeywords.length > 0 && (
                        <div className="mt-4 flex flex-wrap gap-1.5 border-t border-border pt-4">
                          {script.visualKeywords.map((keyword) => (
                            <Badge key={keyword} variant="secondary" className="font-normal">
                              {keyword}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </section>

        <section>
          <div className="mb-4">
            <p className="eyebrow mb-2">Fluxo conectado</p>
            <h2 className="font-display text-2xl font-bold">Continue a produção</h2>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {productionSteps.map((step) => (
              <button
                key={step.title}
                type="button"
                onClick={() => navigate(step.href)}
                className="group flex min-h-28 items-center gap-4 rounded-2xl border border-border bg-card p-4 text-left transition hover:-translate-y-0.5 hover:border-violet-500/30 hover:bg-accent"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground transition group-hover:bg-violet-500/15 group-hover:text-violet-400">
                  <step.icon size={20} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-display font-bold">{step.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
                </div>
                <ArrowRight size={16} className="shrink-0 text-muted-foreground transition group-hover:translate-x-1 group-hover:text-violet-400" />
              </button>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
