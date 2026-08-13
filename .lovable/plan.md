# Plano de Implementação — FASE 4.6

O objetivo é transformar a criação de campanhas em um fluxo de etapas (Stepper) onde o processamento e a aprovação dos vídeos ocorrem **antes** da campanha ser ativada para distribuição.

## Alterações Sugeridas no Banco de Dados

1.  **Aprovação**: Adicionar `status_aprovacao` na tabela `campaign_contents` ou `is_approved` em `media_renders`.
    *   *Decisão*: Usaremos `status` em `media_renders` (já existe `ready`) e um novo campo `is_approved` boolean em `media_renders` para controle do usuário.

## Etapas de Implementação

### 1. Reestruturar a UI de `src/routes/campanha.tsx`
*   Implementar um `Stepper` (Etapas 1 a 5).
*   **Etapa 1 (Configurações)**: Nome, Artista, Música, Volume.
*   **Etapa 2 (Seleção)**: Grid da biblioteca com seleção múltipla.
*   **Etapa 3 (Processamento)**:
    *   Botão "PROCESSAR X VÍDEOS".
    *   Criação em lote de registros em `media_renders`.
    *   Painel de acompanhamento com badges de status (Fila, Processando, Pronto).
    *   Preview real do vídeo renderizado (via Signed URL do bucket `rendered`).
    *   Botões "APROVAR" e "REFAZER".
*   **Etapa 4 (Distribuição)**: Configuração de contas, horários, timezone.
*   **Etapa 5 (Ativação)**: Resumo final e botão "ATIVAR CAMPANHA".

### 2. Lógica de Negócio (Idempotência e Segurança)
*   Verificar `render_key` antes de inserir novos `media_renders`.
*   Garantir que a campanha permaneça em status `draft` ou `pendente` durante o processo.
*   A ativação final deve disparar a geração de `publications` apenas para os conteúdos aprovados.

### 3. Preservação da Infraestrutura
*   Manter `render-bridge`, `Render Worker VPS` e `campaign-dispatcher` intactos.
*   O fluxo apenas muda a ordem das ações na interface.

## Critérios de Sucesso
*   Usuário seleciona múltiplos vídeos.
*   Renders são criados imediatamente.
*   UI mostra progresso em tempo real.
*   Preview usa o arquivo renderizado final.
*   Campanha só começa a postar após o botão "ATIVAR".
