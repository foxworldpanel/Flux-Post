# Plano de Refatoração: Flux Post - Fase 4.6 (Consolidação de Fluxo)

Este plano visa reorganizar a página `/campanha` para seguir o fluxo linear de preparação antes da ativação, eliminando o wizard e consolidando todos os componentes em uma única tela contínua.

## Objetivos
- Unificar a interface de "Preparar Campanha" em uma única página vertical.
- Mover a biblioteca de vídeos para logo após a seleção da música.
- Permitir processamento (renderização) e visualização do resultado final *antes* de ativar a campanha.
- Garantir que uma campanha ativa não tenha conteúdo pendente de processamento inicial.
- Manter as funcionalidades de agendamento e seleção de contas abaixo da seção de vídeos.

## Etapas de Implementação

### 1. Reorganização do Layout Vertical (`src/routes/campanha.tsx`)
- Remover o componente de Stepper visual e lógico.
- Reordenar o JSX para seguir a sequência:
    1. **Dados da Campanha**: Nome, Artista, Música e Configurações de Áudio.
    2. **Escolher e Processar Vídeos**: Mover a `Biblioteca de Conteúdos` para esta posição.
    3. **Programação e Publicação**: Posts/dia, Timezone, Modo de Distribuição, etc.
    4. **Contas de Publicação**: Seleção de destinos sociais.
    5. **Resumo e Start**: Botão "Iniciar Campanha".

### 2. Lógica de Seleção e Processamento
- Atualizar `selectedContentIds` para funcionar em conjunto com a renderização em lote.
- Implementar a exibição do status de renderização (`NA FILA`, `RENDERIZANDO`, `PRONTO`) diretamente nos cards da biblioteca durante a fase de preparação.
- Adicionar o botão `[ PROCESSAR X VÍDEOS ]` logo abaixo do grid de seleção.
- Integrar o preview do vídeo renderizado (bucket `rendered`) no próprio card do vídeo após a conclusão.

### 3. Divisor de Ativação (O Botão "Iniciar Campanha")
- Garantir que o clique em "Iniciar Campanha" seja o único ponto onde o `status` da campanha muda para `ativo` e as publicações são geradas/disparadas.
- Impedir que campanhas ativas exibam o fluxo de processamento de biblioteca (os vídeos já devem vir prontos).

### 4. Limpeza e Auditoria
- Remover seções duplicadas (biblioteca no final da página).
- Remover o botão "Processar" da visão de "Campanha Ativa".
- Garantir que o `handleDeleteCampaign` resete corretamente o estado para a nova interface.

## Detalhes Técnicos
- **Idempotência**: Manter a lógica de `render_key` para evitar re-renderizações desnecessárias de conteúdos idênticos.
- **Realtime**: Manter as inscrições do Supabase Realtime para atualizar o status dos vídeos na tela de preparação.
- **Navegação**: Após a ativação bem-sucedida, a interface deve mudar para o modo "Campanha Ativa" (exibindo progresso e métricas).
