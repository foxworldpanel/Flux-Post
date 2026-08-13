# Plano de Auditoria e Correção P0 - Flux Post

Este plano visa resolver os problemas críticos (P0 e P1) identificados na auditoria pós-implementação da fase de pré-renderização de campanhas.

## Problemas a Resolver

1.  **Bloqueio de Ativação (P0):** Impedir `handleIniciar()` se nem todos os vídeos selecionados tiverem um `media_render` pronto (`status = 'ready'`).
2.  **Render Key Canônica (P0):** Implementar uma função determinística de geração de `render_key` incluindo todos os parâmetros de áudio.
3.  **Idempotência no Processamento (P0):** Ajustar `handleProcessBatch()` para não resetar renders `ready` ou `processing` ao reenviar o lote.
4.  **Vínculo Inequívoco de Publications (P0):** Garantir que as publicações sejam criadas apontando para o `media_render_id` correto.
5.  **Dispatcher com Arquivo Renderizado (P0):** Validar que o `campaign-dispatcher` utiliza o bucket `rendered` e o ID do render.
6.  **Realtime na Preparação (P1):** Corrigir a inscrição de realtime para monitorar renders sem depender de uma campanha ativa.
7.  **Filtro de Campanha Ativa (P1):** Corrigir `fetchData()` para selecionar apenas campanhas com `status = 'ativo'`.
8.  **Invalidação por Troca de Configuração (P1):** Invalidar renders visualmente se as configurações de áudio/música mudarem.

## Detalhes Técnicos

### 1. Render Key Canônica
A função `generateRenderKey` será centralizada e incluirá:
- `source_content_id`
- `music_track_id`
- `music_start_ms`
- `music_volume`
- `original_audio_volume`
- `audio_mode`
- `render_pipeline_version` (fixo em `v1`)

### 2. handleProcessBatch
- Utilizará a nova `render_key`.
- Antes de fazer o `upsert`, verificará os renders existentes para evitar sobrescrever estados `ready` ou `processing` com `queued`.

### 3. handleIniciar
- Adicionará uma validação: `selectedContentIds.every(id => getRenderForContent(id)?.status === 'ready')`.
- Vinculará `media_render_id` na tabela `publications` no momento da criação.

### 4. campaign-dispatcher (Edge Function)
- O dispatcher v9 já tenta vincular o render, mas reforçaremos a lógica para garantir que a publicação use o `media_render_id` e o status `ready_to_publish` só ocorra se o render estiver pronto.

### 5. Inscrição Realtime
- A inscrição passará a escutar todos os renders do `user_id` atual, permitindo atualizações na UI durante a fase de preparação.

## Verificação
- Teste E2E via Playwright simulando o fluxo completo.
- Verificação via `psql` das chaves e estados no banco de dados.
