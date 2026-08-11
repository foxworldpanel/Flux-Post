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
URGENTE — PREVIEW DO LOVABLE PAROU DE ABRIR

Após as alterações recentes da Fase 3.9/V5/V6, o Preview do projeto não está mais abrindo.

NÃO FAÇA REFATORAÇÃO.
NÃO ALTERE O SCHEDULER.
NÃO ALTERE PG_CRON.
NÃO ALTERE RLS/GRANTS.
NÃO ALTERE CAMPAIGN-DISPATCHER FUNCIONAL.
NÃO ALTERE POSTPEER.
NÃO ALTERE RENDER WORKER.

O scheduler V6 já foi validado e NÃO deve ser tocado.

Quero primeiro DIAGNÓSTICO da causa do Preview.

 Execute o build real do frontend e informe:

npm run build

Resultado completo de sucesso/falha e primeiro erro relevante.

 Execute a checagem TypeScript disponível no projeto.

Mostrar erros reais, se houver.

 Verifique os logs do Preview/runtime do Lovable.

Procurar especificamente:

 JavaScript exception

 failed import

 undefined environment variable

 Supabase initialization failure

 React render error

 route error

 module not found

 syntax error

 failed network request que impeça bootstrap

 Auditar as últimas alterações feitas depois que o Preview funcionava.

Identificar arquivos FRONTEND modificados nas fases:

3.9
3.9.1
3.9.2
V4
V5
V6

Não considerar migrations/Edge Functions como causa direta sem evidência.

 Verificar especialmente:

src/main.*
src/App.*
Supabase client
providers
auth
routes
Dashboard
componente Real-Time Monitor criado recentemente

O Real-Time Monitor foi uma alteração recente de frontend e deve ser auditado como possível regressão.

 Verificar se o frontend está tentando consultar diretamente:

cron.job
cron.job_run_details
net._http_response

Se estiver:

identificar se isso está causando exception/permissão durante a inicialização.

O Preview NÃO pode depender dessas tabelas internas para conseguir renderizar.

 Verificar variáveis:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Informar apenas:

EXISTS: YES/NO

NÃO mostrar valores.

IMPORTANTE: a anon key comprometida AINDA NÃO FOI ROTACIONADA. Portanto NÃO substituir, apagar ou modificar VITE_SUPABASE_ANON_KEY nesta tarefa.

 Abrir a rota raiz e identificar o PRIMEIRO erro real que impede o Preview.

Quero:

BUILD: PASS/FAIL

TYPESCRIPT: PASS/FAIL

VITE_SUPABASE_URL EXISTS: YES/NO

VITE_SUPABASE_ANON_KEY EXISTS: YES/NO

PREVIEW HTTP STATUS:

FIRST BROWSER/RUNTIME ERROR:

FILE:

LINE:

LAST CHANGE THAT INTRODUCED THE REGRESSION:

ROOT CAUSE:

NÃO CORRIJA AINDA.

Primeiro apresente o diagnóstico.

Se descobrir a causa, PARE.

Não fazer rollback geral.
Não resetar banco.
Não mexer no scheduler.

PARE.
        </div>
      </div>
    </DashboardLayout>
  );
}
