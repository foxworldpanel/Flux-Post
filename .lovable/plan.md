# Plano de Refatoração UX /campanha - Flux Post

Refatoração completa da rota `/campanha` para um fluxo linear, profissional e operacional, focada em visualização desktop-first e integridade de dados.

## 1. Estrutura da Página (Layout Linear)

A página será organizada em 5 blocos verticais claros:

### BLOCO 1 — CAMPANHA (Dados Básicos)
- Nome da Campanha
- Seleção de Artista (Select)
- Seleção de Música (Select dependente + botão "+" para nova música)
- Configuração de Posts por dia (Select)
- Timezone (Select)

### BLOCO 2 — MÍDIA E ÁUDIO (Configurações + Seleção)
- **Configurações de Áudio:** Início da música (input), Volume música (slider), Volume original (slider), Modo de áudio (mix, only music, only original).
- **Galeria de Seleção de Vídeos:**
    - Galeria responsiva grande (grid de cards 9:16).
    - Cada card com: thumbnail, duração, checkbox de seleção, badge de resolução (se disponível).
    - Botão de preview do vídeo original.
- **Contador e Ação:** "X vídeos selecionados" + Botão principal "PROCESSAR X VÍDEOS".

### BLOCO 3 — PROCESSAMENTO E REVISÃO (Pós-seleção)
- Visível imediatamente após o processamento iniciar/existir.
- **Grid de Cards de Revisão (9:16):**
    - Player HTML5 usando **Signed URL do bucket `rendered`** (se `status='ready'`).
    - Thumbnail/Poster do render.
    - Status visual: AGUARDANDO / NA FILA / RENDERIZANDO / PRONTO / FALHOU.
    - Ações por card: Play (abre modal ou inline), Aprovar (toggle `is_approved`), Reprocessar (reset status), Remover (desseleciona).
- **Sumário de Progresso:** "X/Y processados", "A/Y aprovados" + Botão "APROVAR TODOS OS PRONTOS".
- **Integração Realtime:** Atualização automática dos cards via assinatura do canal `media_renders`.

### BLOCO 4 — PUBLICAÇÃO (Configuração de Destinos)
- Visível após seleção de vídeos.
- Modo de Agendamento: Programar período vs Começar agora.
- Seleção de Contas (Grid de logos/nomes).
- Configurações de Distribuição: Intervalo entre destinos, Anti-repetição.
- Programação sugerida (oculta ou compacta se vazia).

### BLOCO 5 — RESUMO E ATIVAÇÃO (Gate Final)
- Resumo executivo: Música, vídeos (selecionados, renderizados, aprovados), contas, posts previstos.
- **Botão "INICIAR CAMPANHA":** 
    - Habilitado apenas se: >=1 vídeo selecionado, **todos** ready, **todos** aprovados, >=1 conta selecionada, programação válida.

## 2. Detalhes Técnicos e Segurança

- **Idempotência de Renderização:** O `generateRenderKey` será atualizado para incluir todos os parâmetros de áudio e versão da pipeline.
- **Segurança de Acesso:** Uso obrigatório de `supabase.storage.createSignedUrl` para os buckets `content-library` (original) e `rendered` (final).
- **Integridade de Publicação:** Ao iniciar a campanha, cada registro em `publications` será vinculado ao `media_render_id` específico aprovado.
- **Invalidação:** Alterar qualquer parâmetro de áudio (Volume, Início, Modo) irá regenerar a `render_key`, invalidando visualmente o render anterior (não aparecerá como 'ready' para a nova configuração).

## 3. Validação OBRIGATÓRIA (Pós-Implementação)
- Verificar se o `<video>` aponta para o bucket `rendered`.
- Confirmar áudio mixado no player.
- Testar bloqueio do botão "Iniciar" por falta de aprovação.
- Confirmar que o dispatcher consome o arquivo correto do bucket `rendered`.
