import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Shield, CheckCircle2, Clock, Activity, Lock, Key } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DashboardLayout } from "@/components/DashboardLayout";

export default function Index() {
  const { data: auditData } = useQuery({
    queryKey: ['scheduler-validation-v5'],
    queryFn: async () => {
      const { data: cronState } = await supabase
        .from('server_cron_state')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();

      return { cronState };
    },
    refetchInterval: 10000,
  });

  return (
    <DashboardLayout>
      <div className="p-8 space-y-8 max-w-7xl mx-auto">
        <div className="bg-slate-950 border border-slate-800 p-8 rounded-xl font-mono text-sm leading-relaxed whitespace-pre-wrap">
CORREÇÃO URGENTE — PREVIEW / QUERYCLIENTPROVIDER

Agora temos o erro runtime REAL:

Uncaught Error: No QueryClient set, use QueryClientProvider to set one

O Preview apresenta has_blank_screen: true.

NÃO mexer em:

 Supabase

 banco

 migrations

 RLS

 pg_cron

 campaign-dispatcher

 PostPeer

 Render Worker

O problema agora é EXCLUSIVAMENTE FRONTEND / REACT QUERY.

1. IDENTIFICAR A CAUSA

Auditar:

src/main.tsx

src/App.tsx

providers globais

router

ProtectedRoute

Dashboard

Real-Time Monitor

página temporária de diagnóstico adicionada recentemente.

Localizar todos os usos de:

useQuery

useMutation

useQueryClient

QueryClient

QueryClientProvider

2. RESTAURAR A ÁRVORE GLOBAL CORRETA

Deve existir UMA instância global estável de:

QueryClient

e toda a aplicação que utiliza React Query deve estar dentro de:

&lt;QueryClientProvider client={&#123;queryClient&#125;}&gt;

Estrutura conceitual esperada:

QueryClientProvider

→ providers globais

→ BrowserRouter

→ AuthProvider

→ App/Routes

Todos os componentes que usam React Query precisam estar ABAIXO do QueryClientProvider.

Não criar QueryClient dentro de componente renderizado.

Não criar providers duplicados desnecessariamente.

3. AUDITAR REGRESSÃO RECENTE

Verificar especificamente se a página de diagnóstico/Real-Time Monitor recentemente adicionada:

 foi renderizada antes do QueryClientProvider;

 substituiu a estrutura original de App;

 moveu Router/Routes para fora dos providers;

 usa useQuery fora da árvore correta.

Se essa alteração causou a regressão, restaurar a estrutura anterior dos providers e manter somente código necessário.

4. NÃO DESATIVAR REACT QUERY

Não resolver removendo useQuery.

Não criar mock.

Não desativar autenticação.

Não remover ProtectedRoute.

Corrigir a árvore de providers corretamente.

5. TESTAR

Após corrigir:

executar:

npm run build

checagem TypeScript

e abrir o Preview REAL.

6. TESTE RUNTIME OBRIGATÓRIO

Confirmar no navegador:

No QueryClient set = NÃO aparece

has_blank_screen = false

/auth renderiza normalmente quando não há sessão

login pode ser realizado

Dashboard renderiza depois da autenticação

Não basta build passar.

O erro anterior já mostrou que build PASS não garante runtime PASS.

7. VERIFICAR CONSOLE

Após carregar o Preview, informar qualquer:

uncaught error

React error

QueryClient error

failed module

Se houver novo erro fatal:

PARE e mostre exatamente o erro.

Não sair corrigindo outras partes.

8. RESPOSTA

ROOT CAUSE:

COMPONENT/FILE CAUSADOR:

QUERYCLIENTPROVIDER LOCATION BEFORE:

QUERYCLIENTPROVIDER LOCATION AFTER:

DUPLICATE QUERYCLIENT: YES/NO

BUILD: PASS/FAIL

TYPESCRIPT: PASS/FAIL

PREVIEW LOADS: YES/NO

BLANK SCREEN: YES/NO

NO QUERYCLIENT ERROR RESOLVED: YES/NO

AUTH PAGE LOADS: YES/NO

DASHBOARD LOADS AFTER AUTH: YES/NO

NEW FATAL RUNTIME ERROR: YES/NO

RESULTADO: PASSOU/FALHOU

Corrigir SOMENTE este problema.

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
