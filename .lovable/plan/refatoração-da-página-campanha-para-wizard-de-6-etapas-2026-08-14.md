# Refatoração da Página /campanha para Wizard de 6 Etapas

Refatorar a rota `/campanha` para transformar o fluxo de criação de campanhas em um wizard linear e intuitivo de 6 etapas, mantendo a consistência visual dark do Flux Post.

## Etapas do Wizard

1.  **Etapa 1 — Configurar**: Dados básicos da campanha (nome, período, posts por dia, janela de horário, intervalos).
2.  **Etapa 2 — Escolher Música**: Seleção de uma track da tabela `music_tracks`.
3.  **Etapa 3 — Escolher Vídeos**: Seleção múltipla de vídeos da biblioteca.
4.  **Etapa 4 — Processar**: Execução do processamento de áudio/vídeo (FFmpeg worker) e acompanhamento do status.
5.  **Etapa 5 — Aprovar**: Revisão visual (player) e aprovação individual dos vídeos renderizados.
6.  **Etapa 6 — Publicar**: Seleção de contas sociais, visualização do cronograma e ativação final.

## Regras de Interface e UX

- Barra de progresso persistente no topo indicando as 6 etapas.
- Navegação linear com botões "Voltar" e "Continuar/Avançar".
- Validação rigorosa: avanço bloqueado se a etapa atual não estiver completa.
- Manutenção do suporte a campanhas ativas (visualização operacional) após a ativação.
- Integração com o `campaign-dispatcher` e o motor de renderização existente.

## Detalhes Técnicos

- **Estado do Wizard**: Controle via `useState` (`step` de 1 a 6).
- **Validação de Etapa**:
    - Step 1: Nome e datas preenchidos.
    - Step 2: Música selecionada.
    - Step 3: Pelo menos 1 vídeo selecionado.
    - Step 4: Todos os selecionados processados com sucesso (`status === 'ready'`).
    - Step 5: Pelo menos 1 vídeo aprovado (`is_approved === true`).
    - Step 6: Pelo menos 1 conta selecionada.
- **Componentização**: Modularizar as etapas dentro do arquivo `src/routes/campanha.tsx` para manter a legibilidade, ou separar em sub-componentes se necessário.
- **Persistência**: Os dados do formulário permanecem em memória até a ativação final na Etapa 6.
