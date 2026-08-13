import { useState, useEffect, useMemo, useRef } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Megaphone, Plus, Loader2, Play, Check, X, RefreshCw, Eye, 
  Layers, Calendar, Clock, Zap, ShieldCheck, Video, AlertCircle, AlertTriangle
} from "lucide-react";
import { format, addDays } from "date-fns";
import { artistService } from "@/services/artists";
import { socialService, type SocialAccount } from "@/services/social";
import { storageService } from "@/services/storage";

// ... (Rest of imports and types remain)

export default function CampanhaPage() {
  // ... (State declarations)

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-8 p-4">
        {/* Header */}
        <div className="flex items-center justify-between">
           <h1 className="text-3xl font-bold text-foreground">Preparar Campanha</h1>
           <Badge variant="outline" className="text-[#7C3AED] border-[#7C3AED]/20 uppercase">Fase de Preparação</Badge>
        </div>

        {/* Linha 1: Dados da Campanha */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle>1. Informações da Campanha</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
             {/* ... Inputs de Nome, Artista, Música, Posts/dia, Timezone */}
          </CardContent>
        </Card>

        {/* Linha 2: Configurações de Mídia e Seleção */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle>2. Mídia e Áudio</CardTitle></CardHeader>
          <CardContent>
             {/* Configurações de áudio aqui */}
             {/* Seleção de vídeos: Grid Grande */}
          </CardContent>
        </Card>

        {/* Linha 3: Revisão (Aparece condicionalmente) */}
        {selectedContentIds.length > 0 && (
          <Card className="bg-card border-border">
            <CardHeader><CardTitle>3. Revisão de Processamento</CardTitle></CardHeader>
            <CardContent>
               {/* Grid de Cards 9:16 com status e player */}
            </CardContent>
          </Card>
        )}

        {/* Linha 4: Publicação */}
        <Card className="bg-card border-border">
          <CardHeader><CardTitle>4. Programação e Distribuição</CardTitle></CardHeader>
          <CardContent>
             {/* Configurações de schedule e contas */}
          </CardContent>
        </Card>

        {/* Linha 5: Ativação */}
        <Button className="w-full h-16 text-xl font-bold" onClick={handleIniciar}>INICIAR CAMPANHA</Button>
      </div>
    </DashboardLayout>
  );
}
