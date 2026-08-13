# Deploy Contabo - Flux Post Render Worker

Este guia descreve como realizar o deploy do Render Worker em uma VPS Linux (Contabo) usando Docker Compose.

## Pré-requisitos
- Uma VPS Contabo com Ubuntu ou Debian.
- Acesso SSH à máquina.
- As credenciais da sua instância do Lovable Cloud (Supabase URL e Worker Secret).

## Passo a Passo

1. **Clonar/Copiar os Arquivos**:
   Transfira o diretório `workers/render-worker/` para a sua VPS.

2. **Tornar Scripts Executáveis**:
   ```bash
   chmod +x *.sh
   ```

3. **Instalação e Build**:
   Execute o script de instalação. Ele instalará o Docker/Compose se necessário e prepará o ambiente.
   ```bash
   ./install.sh
   ```

4. **Configurar Variáveis de Ambiente**:
   O script criará um arquivo `.env`. Edite-o com suas chaves reais:
   ```bash
   nano .env
   ```
   Campos obrigatórios:
   - `SUPABASE_URL`
   - `RENDER_WORKER_SECRET`

5. **Configurar o Segredo no Lovable Cloud**:
   No painel do Lovable Cloud, adicione o segredo `RENDER_WORKER_SECRET` com o mesmo valor definido na VPS.

6. **Iniciar o Worker**:
   ```bash
   ./start.sh
   ```

## Gerenciamento

- **Ver Logs**: `./logs.sh`
- **Parar o Worker**: `./stop.sh`
- **Reiniciar**: `./start.sh` (ele fará o down/up automaticamente se necessário)

## Observações de Segurança
- O worker realiza apenas **conexões de saída** para o Supabase (Edge Functions). Nenhuma porta de entrada é aberta no Docker.
- **Segurança v4**: A `SUPABASE_SERVICE_ROLE_KEY` nunca sai do ambiente do Lovable. A VPS usa um segredo exclusivo para se comunicar com o "Bridge" (Edge Function).
- O acesso aos buckets privados é feito via **Signed URLs** de curta duração, garantindo que a VPS não tenha permissões administrativas permanentes sobre o Storage.

## Troubleshooting
Se o worker não iniciar, verifique se o `RENDER_WORKER_SECRET` é idêntico na VPS e no Lovable Cloud.
Use `docker-compose ps` para verificar o status do container.
