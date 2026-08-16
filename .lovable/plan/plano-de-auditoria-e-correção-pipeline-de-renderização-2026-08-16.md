# Plano de Auditoria e Correção: Pipeline de Renderização

Este plano visa auditar e corrigir o pipeline de renderização de vídeos, desde a interface de campanha até o processamento no Render Worker da VPS, garantindo estabilidade, visibilidade de erros e conformidade com a arquitetura server-side.

## Análise Técnica
O pipeline atual apresenta gargalos de comunicação (HTTP 400 no frontend), problemas de polling no worker e possível dessincronização entre o banco de dados e o armazenamento físico. A arquitetura deve ser 100% server-side via VPS Worker, sem fallback para FFmpeg.wasm no navegador.

## Etapas de Implementação

### 1. Auditoria e Correção do Frontend (`src/routes/campanha.tsx`)
- **Remover Fallbacks:** Desativar qualquer lógica residual de renderização client-side.
- **Enfileiramento Robusto:** Garantir que `handleProcessAll` crie registros em `media_renders` com status `queued` e `render_key` determinística.
- **Tratamento de Erros:** Melhorar a captura de erros HTTP (400/500) para exibir a causa real no console e via toasts.
- **Monitoramento Realtime:** Otimizar a subscrição Supabase Realtime para refletir mudanças de status instantaneamente.

### 2. Auditoria da Edge Function (`supabase/functions/render-bridge/index.ts`)
- **Ação `claim`:** Refinar a lógica de seleção de jobs para evitar deadlocks e garantir que apenas jobs `queued` sejam entregues.
- **Verificação Física:** Fortalecer a ação `complete` para verificar a existência física do arquivo no bucket `rendered` antes de marcar como `ready`.
- **Geração de URLs:** Garantir que as Signed URLs para inputs (vídeo/música) tenham tempo de vida suficiente para o processamento.

### 3. Auditoria do Render Worker (`workers/render-worker/index.js`)
- **Loop de Polling:** Ajustar o intervalo e a resiliência do polling para evitar que o worker fique "preso" ou falhe silenciosamente.
- **Fluxo de Upload:** Validar o uso de `uploadToSignedUrl` com o token fornecido pela bridge, garantindo que o bucket de destino receba o arquivo MP4 corretamente.
- **Logs e Diagnóstico:** Adicionar logs detalhados de cada etapa do FFmpeg e do processo de upload para facilitar a auditoria na VPS.

### 4. Sincronização de Banco de Dados
- **Schema `media_renders`:** Verificar colunas críticas como `attempts`, `max_attempts`, `last_heartbeat` e `storage_path`.
- **RPCs:** Garantir que `claim_next_render_job` e `heartbeat_render_job` estejam otimizadas e seguras.

## Detalhes Técnicos
- **Arquitetura:** Híbrida (Dispatcher no Supabase, Worker na VPS).
- **Segurança:** Autenticação via `x-render-worker-secret` e RLS restrito.
- **Storage:** Uso de caminhos físicos determinísticos `{user_id}/{media_render_id}.mp4`.

## Verificação
- Teste ponta a ponta: Criação de campanha -> Processar -> Claim no Worker -> Upload -> Conclusão -> Preview no Frontend.
- Monitoramento de logs do Edge Function e do Worker.
