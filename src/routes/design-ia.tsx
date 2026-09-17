import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  Bot,
  Check,
  Download,
  Image as ImageIcon,
  Images,
  Loader2,
  Palette,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  WandSparkles,
} from "lucide-react";
import { toast } from "sonner";

type ProviderMode = "openai" | "claude_openai";
type TextPosition = "top" | "center" | "bottom";

interface VisualStyle {
  id: string;
  name: string;
  notes: string;
  analysis: string;
  analysis_provider: ProviderMode | null;
  created_at: string;
}

interface StyleReference {
  id: string;
  style_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  position: number;
  signedUrl?: string;
}

interface GeneratedAsset {
  id: string;
  style_id: string | null;
  provider_mode: ProviderMode;
  prompt: string;
  storage_path: string;
  width: number;
  height: number;
  format_name: string;
  overlay: Record<string, any>;
  created_at: string;
  signedUrl?: string;
}

const formatOptions = [
  { id: "story", label: "Story", description: "9:16", width: 1080, height: 1920 },
  { id: "feed_portrait", label: "Feed vertical", description: "4:5", width: 1080, height: 1350 },
  { id: "square", label: "Quadrado", description: "1:1", width: 1080, height: 1080 },
  { id: "landscape", label: "Paisagem", description: "16:9", width: 1920, height: 1080 },
  { id: "custom", label: "Personalizado", description: "Livre", width: 1080, height: 1080 },
] as const;

function safeFileName(name: string) {
  const extension = name.split(".").pop()?.toLowerCase() || "png";
  return `${crypto.randomUUID()}.${extension.replace(/[^a-z0-9]/g, "") || "png"}`;
}

function wrapCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (context.measureText(next).width > maxWidth && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

export default function DesignIaPage() {
  const { user } = useAuth();
  const database = supabase as any;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [styles, setStyles] = useState<VisualStyle[]>([]);
  const [references, setReferences] = useState<StyleReference[]>([]);
  const [assets, setAssets] = useState<GeneratedAsset[]>([]);
  const [selectedStyleId, setSelectedStyleId] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingStyle, setSavingStyle] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);

  const [newStyleName, setNewStyleName] = useState("");
  const [newStyleNotes, setNewStyleNotes] = useState("");
  const [providerMode, setProviderMode] = useState<ProviderMode>("openai");
  const [prompt, setPrompt] = useState("");
  const [format, setFormat] = useState("story");
  const [width, setWidth] = useState(1080);
  const [height, setHeight] = useState(1920);
  const [quality, setQuality] = useState("high");
  const [transparent, setTransparent] = useState(false);
  const [withText, setWithText] = useState(true);
  const [headline, setHeadline] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [textPosition, setTextPosition] = useState<TextPosition>("center");
  const [textColor, setTextColor] = useState("#ffffff");
  const [currentAsset, setCurrentAsset] = useState<GeneratedAsset | null>(null);

  const selectedStyle = useMemo(
    () => styles.find(style => style.id === selectedStyleId) || null,
    [styles, selectedStyleId],
  );
  const selectedReferences = useMemo(
    () => references.filter(reference => reference.style_id === selectedStyleId),
    [references, selectedStyleId],
  );

  const signPaths = async <T extends { storage_path: string }>(items: T[]) => {
    return Promise.all(
      items.map(async item => {
        const { data } = await supabase.storage
          .from("design-ai")
          .createSignedUrl(item.storage_path, 3600);
        return { ...item, signedUrl: data?.signedUrl || undefined };
      }),
    );
  };

  const loadData = async () => {
    if (!user) return;
    try {
      setLoading(true);
      const [stylesResult, referencesResult, assetsResult] = await Promise.all([
        database
          .from("design_ai_styles")
          .select("*")
          .order("created_at", { ascending: false }),
        database
          .from("design_ai_style_references")
          .select("*")
          .order("position", { ascending: true }),
        database
          .from("design_ai_assets")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(30),
      ]);

      if (stylesResult.error) throw stylesResult.error;
      if (referencesResult.error) throw referencesResult.error;
      if (assetsResult.error) throw assetsResult.error;

      const loadedStyles = (stylesResult.data || []) as VisualStyle[];
      setStyles(loadedStyles);
      setReferences(await signPaths((referencesResult.data || []) as StyleReference[]));
      const signedAssets = await signPaths((assetsResult.data || []) as GeneratedAsset[]);
      setAssets(signedAssets);
      setCurrentAsset(previous => previous || signedAssets[0] || null);
      setSelectedStyleId(previous => previous || loadedStyles[0]?.id || "");
    } catch (error: any) {
      toast.error("Não foi possível carregar o Design IA: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [user?.id]);

  const createStyle = async () => {
    if (!user || !newStyleName.trim()) {
      toast.error("Informe o nome do novo projeto visual.");
      return;
    }
    try {
      setSavingStyle(true);
      const { data, error } = await database
        .from("design_ai_styles")
        .insert({
          user_id: user.id,
          name: newStyleName.trim(),
          notes: newStyleNotes.trim(),
        })
        .select("*")
        .single();
      if (error) throw error;
      setStyles(previous => [data as VisualStyle, ...previous]);
      setSelectedStyleId(data.id);
      setNewStyleName("");
      setNewStyleNotes("");
      toast.success("Projeto visual criado. Agora envie até 10 referências.");
    } catch (error: any) {
      toast.error("Erro ao criar projeto: " + error.message);
    } finally {
      setSavingStyle(false);
    }
  };

  const uploadReferences = async (files: FileList | null) => {
    if (!user || !selectedStyle || !files?.length) return;
    const available = 10 - selectedReferences.length;
    if (available <= 0) {
      toast.error("Este projeto já possui 10 referências.");
      return;
    }

    const selectedFiles = Array.from(files).slice(0, available);
    const supported = selectedFiles.filter(file =>
      ["image/jpeg", "image/png", "image/webp"].includes(file.type),
    );
    if (supported.length !== selectedFiles.length) {
      toast.error("Use somente arquivos JPG, PNG ou WebP.");
    }

    try {
      setUploading(true);
      for (let index = 0; index < supported.length; index += 1) {
        const file = supported[index];
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} ultrapassa 10 MB.`);
          continue;
        }
        const storagePath = `${user.id}/references/${selectedStyle.id}/${safeFileName(file.name)}`;
        const { error: uploadError } = await supabase.storage
          .from("design-ai")
          .upload(storagePath, file, { contentType: file.type });
        if (uploadError) throw uploadError;

        const { error: insertError } = await database
          .from("design_ai_style_references")
          .insert({
            style_id: selectedStyle.id,
            user_id: user.id,
            storage_path: storagePath,
            file_name: file.name,
            mime_type: file.type,
            position: selectedReferences.length + index,
          });
        if (insertError) {
          await supabase.storage.from("design-ai").remove([storagePath]);
          throw insertError;
        }
      }
      toast.success("Referências adicionadas ao projeto.");
      await loadData();
    } catch (error: any) {
      toast.error("Erro ao enviar referências: " + error.message);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeReference = async (reference: StyleReference) => {
    try {
      const { error } = await database
        .from("design_ai_style_references")
        .delete()
        .eq("id", reference.id);
      if (error) throw error;
      await supabase.storage.from("design-ai").remove([reference.storage_path]);
      setReferences(previous => previous.filter(item => item.id !== reference.id));
      toast.success("Referência removida.");
    } catch (error: any) {
      toast.error("Erro ao remover referência: " + error.message);
    }
  };

  const changeFormat = (formatId: string) => {
    setFormat(formatId);
    const option = formatOptions.find(item => item.id === formatId);
    if (option && option.id !== "custom") {
      setWidth(option.width);
      setHeight(option.height);
    }
  };

  const generate = async () => {
    if (!prompt.trim()) {
      toast.error("Descreva a arte ou imagem que deseja criar.");
      return;
    }
    if (withText && !headline.trim()) {
      toast.error("Informe o título da arte ou desligue a opção de texto.");
      return;
    }

    try {
      setGenerating(true);
      const overlay = withText
        ? { headline, subtitle, position: textPosition, color: textColor }
        : {};
      const { data, error } = await supabase.functions.invoke("design-ai-generate", {
        body: {
          styleId: selectedStyleId || null,
          providerMode,
          prompt: prompt.trim(),
          width,
          height,
          formatName: format,
          quality,
          transparent,
          overlay,
        },
      });
      if (error) {
        let detailedMessage = error.message;
        const context = (error as any)?.context;
        if (context && typeof context.json === "function") {
          try {
            const payload = await context.json();
            detailedMessage = payload?.error || payload?.message || detailedMessage;
          } catch {
            // Keep the SDK message when the response has no JSON body.
          }
        }
        throw new Error(detailedMessage);
      }
      if (data?.error) throw new Error(data.error);
      const asset = data.asset as GeneratedAsset;
      setCurrentAsset(asset);
      setAssets(previous => [asset, ...previous.filter(item => item.id !== asset.id)]);
      if (data.direction && selectedStyleId) {
        setStyles(previous =>
          previous.map(style =>
            style.id === selectedStyleId
              ? { ...style, analysis: data.direction, analysis_provider: providerMode }
              : style,
          ),
        );
      }
      toast.success("Arte criada. Confira o resultado no preview.");
    } catch (error: any) {
      toast.error("Erro ao gerar: " + (error?.message || "falha inesperada"));
    } finally {
      setGenerating(false);
    }
  };

  const downloadArtwork = async () => {
    if (!currentAsset?.signedUrl) return;
    try {
      const response = await fetch(currentAsset.signedUrl);
      const blob = await response.blob();
      const imageUrl = URL.createObjectURL(blob);
      const image = new Image();
      image.src = imageUrl;
      await image.decode();

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas indisponível");

      const scale = Math.max(width / image.width, height / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      context.drawImage(
        image,
        (width - drawWidth) / 2,
        (height - drawHeight) / 2,
        drawWidth,
        drawHeight,
      );

      if (withText && headline.trim()) {
        const positionY = textPosition === "top" ? height * 0.15 : textPosition === "bottom" ? height * 0.72 : height * 0.43;
        const gradient = context.createLinearGradient(0, positionY - height * 0.12, 0, positionY + height * 0.3);
        gradient.addColorStop(0, "rgba(0,0,0,0)");
        gradient.addColorStop(0.45, "rgba(0,0,0,.36)");
        gradient.addColorStop(1, "rgba(0,0,0,.62)");
        context.fillStyle = gradient;
        context.fillRect(0, positionY - height * 0.15, width, height * 0.42);

        const headlineSize = Math.round(width * 0.075);
        context.textAlign = "center";
        context.textBaseline = "top";
        context.fillStyle = textColor;
        context.strokeStyle = "rgba(0,0,0,.45)";
        context.lineWidth = Math.max(3, width * 0.004);
        context.font = `800 ${headlineSize}px Inter, Arial, sans-serif`;
        const lines = wrapCanvasText(context, headline, width * 0.82).slice(0, 4);
        let y = positionY;
        for (const line of lines) {
          context.strokeText(line, width / 2, y);
          context.fillText(line, width / 2, y);
          y += headlineSize * 1.08;
        }

        if (subtitle.trim()) {
          const subtitleSize = Math.round(width * 0.035);
          context.font = `500 ${subtitleSize}px Inter, Arial, sans-serif`;
          const subtitleLines = wrapCanvasText(context, subtitle, width * 0.76).slice(0, 3);
          y += subtitleSize * 0.5;
          for (const line of subtitleLines) {
            context.fillText(line, width / 2, y);
            y += subtitleSize * 1.2;
          }
        }
      }

      canvas.toBlob(output => {
        if (!output) return;
        const link = document.createElement("a");
        link.href = URL.createObjectURL(output);
        link.download = `flux-design-${Date.now()}.png`;
        link.click();
        URL.revokeObjectURL(link.href);
      }, "image/png");
      URL.revokeObjectURL(imageUrl);
    } catch (error: any) {
      toast.error("Não foi possível baixar a arte: " + error.message);
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-7 p-4 sm:p-6 lg:p-8">
        <header className="flex flex-col gap-5 border-b border-border pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="eyebrow">Criação visual profissional</span>
              <Badge variant="outline" className="border-primary/25 bg-primary/10 text-primary">Beta</Badge>
            </div>
            <h1 className="text-3xl font-bold sm:text-4xl">Design IA</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground sm:text-base">
              Crie imagens e artes com texto usando projetos visuais independentes. Cada projeto pode aprender com até 10 referências.
            </p>
          </div>
          <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-[var(--card-shadow)]">
            <Palette className="text-primary" size={22} />
            <div>
              <p className="text-sm font-semibold">{styles.length} projetos visuais</p>
              <p className="text-xs text-muted-foreground">Sem limite de segmento por conta</p>
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex min-h-80 items-center justify-center text-muted-foreground">
            <Loader2 className="mr-2 animate-spin" size={20} /> Carregando Design IA...
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.08fr)_minmax(390px,.92fr)]">
            <div className="space-y-6">
              <Card>
                <CardHeader className="border-b border-border pb-5">
                  <div className="flex items-center gap-3">
                    <div className="rounded-xl bg-primary/10 p-2.5 text-primary"><Images size={20} /></div>
                    <div>
                      <CardTitle>1. Projeto e referências</CardTitle>
                      <p className="mt-1 text-sm text-muted-foreground">Troque o projeto sempre que quiser usar outro padrão visual.</p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-5 pt-6">
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                    <Select value={selectedStyleId} onValueChange={setSelectedStyleId}>
                      <SelectTrigger><SelectValue placeholder="Selecione um projeto visual" /></SelectTrigger>
                      <SelectContent>
                        {styles.map(style => <SelectItem key={style.id} value={style.id}>{style.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => document.getElementById("new-visual-project")?.scrollIntoView({ behavior: "smooth" })}>
                      <Plus size={16} /> Novo projeto
                    </Button>
                  </div>

                  {selectedStyle ? (
                    <div className="rounded-2xl border border-border bg-muted/30 p-4">
                      <div className="mb-4 flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold">{selectedStyle.name}</p>
                          <p className="mt-1 text-sm text-muted-foreground">{selectedStyle.notes || "Sem instruções adicionais."}</p>
                        </div>
                        <Badge variant="secondary">{selectedReferences.length}/10</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
                        {selectedReferences.map(reference => (
                          <div key={reference.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card">
                            {reference.signedUrl && <img src={reference.signedUrl} alt={reference.file_name} className="h-full w-full object-cover" />}
                            <button
                              type="button"
                              onClick={() => removeReference(reference)}
                              className="absolute right-1.5 top-1.5 rounded-full bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
                              aria-label="Remover referência"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                        {selectedReferences.length < 10 && (
                          <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="flex aspect-square flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-primary/35 bg-primary/5 text-xs font-medium text-primary transition hover:bg-primary/10"
                          >
                            {uploading ? <Loader2 className="animate-spin" size={20} /> : <Upload size={20} />}
                            Adicionar
                          </button>
                        )}
                      </div>
                      <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={event => uploadReferences(event.target.files)} />
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                      Crie um projeto visual para adicionar referências. Você também pode gerar sem referências.
                    </div>
                  )}

                  <div id="new-visual-project" className="grid gap-3 rounded-2xl border border-border bg-background/40 p-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Nome do novo projeto</Label>
                      <Input value={newStyleName} onChange={event => setNewStyleName(event.target.value)} placeholder="Ex.: Promoções da pizzaria" maxLength={120} />
                    </div>
                    <div className="space-y-2">
                      <Label>Direção adicional</Label>
                      <Input value={newStyleNotes} onChange={event => setNewStyleNotes(event.target.value)} placeholder="Ex.: moderno, premium e acolhedor" />
                    </div>
                    <Button onClick={createStyle} disabled={savingStyle || !newStyleName.trim()} className="sm:col-span-2 sm:justify-self-start">
                      {savingStyle ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />} Criar projeto visual
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border pb-5">
                  <CardTitle>2. Diretor criativo</CardTitle>
                  <p className="text-sm text-muted-foreground">Compare duas formas de interpretar exatamente as mesmas referências.</p>
                </CardHeader>
                <CardContent className="grid gap-3 pt-6 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setProviderMode("openai")}
                    className={cn("rounded-2xl border p-4 text-left transition", providerMode === "openai" ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border bg-muted/20 hover:bg-muted/40")}
                  >
                    <div className="flex items-center justify-between"><Bot className="text-primary" size={22} />{providerMode === "openai" && <Check className="text-primary" size={18} />}</div>
                    <p className="mt-4 font-semibold">OpenAI</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">A OpenAI interpreta as referências e renderiza a imagem.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setProviderMode("claude_openai")}
                    className={cn("rounded-2xl border p-4 text-left transition", providerMode === "claude_openai" ? "border-primary bg-primary/10 ring-1 ring-primary/20" : "border-border bg-muted/20 hover:bg-muted/40")}
                  >
                    <div className="flex items-center justify-between"><WandSparkles className="text-amber-500" size={22} />{providerMode === "claude_openai" && <Check className="text-primary" size={18} />}</div>
                    <p className="mt-4 font-semibold">Claude + OpenAI</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">Claude dirige o estilo; OpenAI faz a renderização final.</p>
                  </button>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border pb-5"><CardTitle>3. Conteúdo e formato</CardTitle></CardHeader>
                <CardContent className="space-y-6 pt-6">
                  <div className="space-y-2">
                    <Label>O que você deseja criar?</Label>
                    <Textarea value={prompt} onChange={event => setPrompt(event.target.value)} placeholder="Ex.: uma pizza meia muçarela e meia calabresa, fotografia publicitária premium, fundo escuro e iluminação quente..." className="min-h-28 resize-y" />
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                    {formatOptions.map(option => (
                      <button key={option.id} type="button" onClick={() => changeFormat(option.id)} className={cn("rounded-xl border px-3 py-3 text-left transition", format === option.id ? "border-primary bg-primary/10 text-primary" : "border-border bg-muted/20 hover:bg-muted/40")}>
                        <span className="block text-sm font-semibold">{option.label}</span>
                        <span className="text-xs text-muted-foreground">{option.description}</span>
                      </button>
                    ))}
                  </div>
                  {format === "custom" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-2"><Label>Largura</Label><Input type="number" min={256} max={3840} value={width} onChange={event => setWidth(Number(event.target.value))} /></div>
                      <div className="space-y-2"><Label>Altura</Label><Input type="number" min={256} max={3840} value={height} onChange={event => setHeight(Number(event.target.value))} /></div>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Qualidade</Label>
                      <Select value={quality} onValueChange={setQuality}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="medium">Rascunho</SelectItem><SelectItem value="high">Alta</SelectItem><SelectItem value="xhigh">Muito alta</SelectItem><SelectItem value="max">Máxima</SelectItem></SelectContent></Select>
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-4 py-3">
                      <div><p className="text-sm font-medium">Fundo transparente</p><p className="text-xs text-muted-foreground">Ideal para produtos e recortes</p></div>
                      <Switch checked={transparent} onCheckedChange={setTransparent} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="border-b border-border pb-5">
                  <div className="flex items-center justify-between gap-4"><div><CardTitle>4. Texto profissional</CardTitle><p className="mt-1 text-sm text-muted-foreground">O Flux Post aplica o texto sem erros por cima da imagem.</p></div><Switch checked={withText} onCheckedChange={setWithText} /></div>
                </CardHeader>
                {withText && (
                  <CardContent className="grid gap-4 pt-6 sm:grid-cols-2">
                    <div className="space-y-2 sm:col-span-2"><Label>Título principal</Label><Input value={headline} onChange={event => setHeadline(event.target.value)} placeholder="PIZZA EM DOBRO" /></div>
                    <div className="space-y-2 sm:col-span-2"><Label>Texto complementar</Label><Textarea value={subtitle} onChange={event => setSubtitle(event.target.value)} placeholder="Meia muçarela, meia calabresa • R$ 29,90" className="min-h-20" /></div>
                    <div className="space-y-2"><Label>Posição</Label><Select value={textPosition} onValueChange={value => setTextPosition(value as TextPosition)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="top">Topo</SelectItem><SelectItem value="center">Centro</SelectItem><SelectItem value="bottom">Rodapé</SelectItem></SelectContent></Select></div>
                    <div className="space-y-2"><Label>Cor do texto</Label><div className="flex h-10 items-center gap-3 rounded-md border border-input bg-card px-3"><input type="color" value={textColor} onChange={event => setTextColor(event.target.value)} className="h-7 w-10 cursor-pointer border-0 bg-transparent" /><span className="text-sm text-muted-foreground">{textColor}</span></div></div>
                  </CardContent>
                )}
              </Card>

              <Button onClick={generate} disabled={generating} className="h-14 w-full rounded-2xl text-base font-semibold shadow-lg shadow-primary/20">
                {generating ? <><Loader2 className="animate-spin" size={20} /> Criando arte profissional...</> : <><Sparkles size={20} /> Gerar com {providerMode === "openai" ? "OpenAI" : "Claude + OpenAI"}</>}
              </Button>
            </div>

            <div className="space-y-6 xl:sticky xl:top-6 xl:self-start">
              <Card className="overflow-hidden border-primary/20">
                <CardHeader className="border-b border-border pb-5">
                  <div className="flex items-center justify-between"><div><CardTitle>Preview da arte</CardTitle><p className="mt-1 text-sm text-muted-foreground">Exatamente como o arquivo será baixado.</p></div>{currentAsset && <Badge variant="secondary">{width} × {height}</Badge>}</div>
                </CardHeader>
                <CardContent className="p-4 sm:p-6">
                  <div className="mx-auto flex max-h-[680px] min-h-96 max-w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-[linear-gradient(45deg,var(--muted)_25%,transparent_25%),linear-gradient(-45deg,var(--muted)_25%,transparent_25%),linear-gradient(45deg,transparent_75%,var(--muted)_75%),linear-gradient(-45deg,transparent_75%,var(--muted)_75%)] bg-[length:24px_24px] bg-[position:0_0,0_12px,12px_-12px,-12px_0] p-3">
                    {generating ? (
                      <div className="text-center"><Loader2 className="mx-auto animate-spin text-primary" size={36} /><p className="mt-4 font-medium">Criando sua imagem...</p><p className="mt-1 text-sm text-muted-foreground">Imagens de alta qualidade podem levar alguns minutos.</p></div>
                    ) : currentAsset?.signedUrl ? (
                      <div className="relative max-h-[640px] max-w-full overflow-hidden rounded-xl shadow-2xl" style={{ aspectRatio: `${width}/${height}` }}>
                        <img src={currentAsset.signedUrl} alt={currentAsset.prompt} className="h-full w-full object-cover" />
                        {withText && headline.trim() && (
                          <div className={cn("absolute inset-x-0 flex flex-col items-center bg-gradient-to-b from-transparent via-black/35 to-black/65 px-[8%] py-[8%] text-center", textPosition === "top" ? "top-0 justify-start" : textPosition === "bottom" ? "bottom-0 justify-end" : "top-1/2 -translate-y-1/2 justify-center")} style={{ color: textColor }}>
                            <p className="max-w-full font-display text-[clamp(18px,4vw,46px)] font-black leading-[1.02] drop-shadow-[0_2px_3px_rgba(0,0,0,.8)]">{headline}</p>
                            {subtitle && <p className="mt-3 max-w-full text-[clamp(10px,1.6vw,18px)] font-medium leading-tight drop-shadow-[0_1px_2px_rgba(0,0,0,.9)]">{subtitle}</p>}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="max-w-xs text-center text-muted-foreground"><ImageIcon className="mx-auto opacity-50" size={42} /><p className="mt-4 font-medium text-foreground">Seu preview aparecerá aqui</p><p className="mt-2 text-sm leading-6">Escolha um projeto, configure a arte e clique em gerar.</p></div>
                    )}
                  </div>
                  <Button onClick={downloadArtwork} disabled={!currentAsset?.signedUrl || generating} variant="outline" className="mt-4 h-11 w-full"><Download size={17} /> Baixar arte final em PNG</Button>
                </CardContent>
              </Card>

              {selectedStyle?.analysis && (
                <Card>
                  <CardHeader className="pb-3"><CardTitle className="text-base">Direção visual aprendida</CardTitle></CardHeader>
                  <CardContent><p className="line-clamp-6 text-sm leading-6 text-muted-foreground">{selectedStyle.analysis}</p></CardContent>
                </Card>
              )}

              <Card>
                <CardHeader className="border-b border-border pb-4"><div className="flex items-center justify-between"><CardTitle className="text-base">Criações recentes</CardTitle><Badge variant="outline">{assets.length}</Badge></div></CardHeader>
                <CardContent className="pt-5">
                  {assets.length ? (
                    <div className="grid grid-cols-3 gap-3">
                      {assets.slice(0, 9).map(asset => (
                        <button key={asset.id} type="button" onClick={() => { setCurrentAsset(asset); setWidth(asset.width); setHeight(asset.height); setFormat(asset.format_name); }} className={cn("relative aspect-square overflow-hidden rounded-xl border bg-muted", currentAsset?.id === asset.id ? "border-primary ring-2 ring-primary/25" : "border-border")}>
                          {asset.signedUrl && <img src={asset.signedUrl} alt={asset.prompt} className="h-full w-full object-cover" />}
                          <span className="absolute bottom-1.5 left-1.5 rounded bg-black/65 px-1.5 py-0.5 text-[9px] font-medium text-white">{asset.provider_mode === "openai" ? "OpenAI" : "Claude+"}</span>
                        </button>
                      ))}
                    </div>
                  ) : <p className="py-8 text-center text-sm text-muted-foreground">Nenhuma imagem gerada ainda.</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
