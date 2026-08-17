# Plano de Auditoria e Correção: Pipeline de Renderização

Identificamos que o problema principal é uma falha de autenticação na `render-bridge` e a ausência de um mecanismo de contingência no frontend para quando o Worker falha ou demora.

## Ações Imediatas

1.  **Auditoria de Segurança e Configuração:**
    *   Verificar o valor da variável de ambiente `RENDER_WORKER_SECRET` no backend.
    *   Testar a conectividade da Edge Function `render-bridge` com o segredo correto.
    *   Garantir que o RPC `claim_next_render_job` não esteja bloqueando jobs por causa de leases expirados ou lógica de prioridade.

2.  **Implementação de Fallback Local (FFmpeg.wasm):**
    *   Adicionar um temporizador no frontend (`src/routes/campanha.tsx`).
    *   Se um job permanecer em `queued` por mais de 30 segundos, oferecer ou iniciar automaticamente o processamento local via FFmpeg.wasm.
    *   Reintegrar a lógica de `processVideo` que foi removida anteriormente, mantendo-a como "segurança".

3.  **Melhoria na Visibilidade de Erros:**
    *   Exibir o erro exato retornado pelo Worker ou pela Bridge diretamente no card de processamento da campanha.
    *   Adicionar logs mais detalhados na Edge Function para capturar falhas de upload no bucket `rendered`.

4.  **Correção da Autenticação do Worker:**
    *   Ajustar a `render-bridge` para aceitar a chave de API correta e o segredo do worker sem conflitos de JWT.

## Detalhes Técnicos

*   **Frontend:** Modificar `handleProcessAll` e o polling loop em `campanha.tsx` para detectar timeouts.
*   **Backend:** Atualizar a Edge Function `render-bridge` para v1.2 com logs de auditoria aprimorados.
*   **Banco:** Verificar permissões (GRANTs) na tabela `media_renders` para o `service_role`.
