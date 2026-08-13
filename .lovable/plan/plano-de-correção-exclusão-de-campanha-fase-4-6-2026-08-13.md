# Plano de Correção — Exclusão de Campanha (Fase 4.6)

Este plano detalha a correção do erro que impede a exclusão de campanhas, garantindo a integridade dos dados e a preservação dos assets da biblioteca.

## Problema Identificado
A exclusão da campanha falha devido a uma **Foreign Key restritiva** na tabela `publications`. Enquanto outras tabelas relacionadas (como `campaign_contents`) já possuem `ON DELETE CASCADE`, a tabela `publications` bloqueia a operação quando existem posts agendados ou históricos vinculados à campanha.

## Detalhes Técnicos (Auditoria)
- **Campaign ID:** `4cf12219-e9a7-45c5-a821-7a0cd61ce334` (Campanha "sourcee")
- **Tabela Bloqueante:** `publications`
- **Constraint:** `publications_campaign_id_fkey`
- **Causa Raiz:** Falta de `ON DELETE CASCADE` na relação entre campanhas e publicações.

## Etapas da Implementação

### 1. Banco de Dados (Migração de Segurança)
- Remover a constraint antiga e adicionar uma nova com `ON DELETE CASCADE` na tabela `publications`.
- Manter `media_renders` intactos (eles não possuem FK direta para campanhas e são reutilizáveis via `render_key`).

### 2. Interface (UI/UX)
- Implementar o botão "Excluir Campanha" no componente `src/routes/campanha.tsx`.
- Adicionar modal de confirmação.
- Implementar a função `handleDelete` que remove a campanha no banco e limpa o estado local (`setCampanhaAtiva(null)`).
- Resetar os estados de seleção de conteúdo e contas após a exclusão.

### 3. Preservação de Assets
- Validar que `artists`, `music_tracks` e `content_library` permanecem intactos após a exclusão da campanha.

## Verificação
- Executar exclusão real da campanha "sourcee".
- Confirmar que a tela de "Criar Nova Campanha" aparece imediatamente.
