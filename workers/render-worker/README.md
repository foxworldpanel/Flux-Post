# Render Worker FFmpeg

Worker autônomo para processamento de áudio/vídeo do Flux Post.

## Fluxo de Operação

1. **Poll**: O worker chama `claim_next_render_job(worker_id)` via RPC.
2. **Setup**: Obtém URLs assinadas dos assets (vídeo e música).
3. **Process**: Executa o FFmpeg localmente para mesclar áudio.
4. **Upload**: Envia o resultado para o bucket `renders`.
5. **Callback**: Chama `render-worker-complete` para atualizar o status.

## Requisitos de Deploy

Este worker deve ser executado em um ambiente com suporte a Docker e FFmpeg.

### Variáveis de Ambiente Necessárias

- `SUPABASE_URL`: URL do seu projeto Supabase.
- `SUPABASE_SERVICE_ROLE_KEY`: Chave administrativa para autenticação service-to-service.
- `WORKER_ID`: Identificador único desta instância.

## Comandos para Deploy

```bash
docker build -t flux-render-worker .
docker run -e SUPABASE_URL=... -e SUPABASE_SERVICE_ROLE_KEY=... flux-render-worker
```

**Status atual da infraestrutura:** AGUARDANDO DEPLOY EXTERNO.
