# Deploy Contabo - Flux Post Render Worker

Este guia descreve como realizar o deploy do Render Worker em uma VPS Linux (Contabo) usando Docker Compose.

## Pré-requisitos
- Uma VPS Contabo com Ubuntu ou Debian.
- Acesso SSH à máquina.
- As credenciais da sua instância do Lovable Cloud (Supabase URL e Service Role Key).

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
   - `SUPABASE_SERVICE_ROLE_KEY`

5. **Iniciar o Worker**:
   ```bash
   ./start.sh
   ```

## Gerenciamento

- **Ver Logs**: `./logs.sh`
- **Parar o Worker**: `./stop.sh`
- **Reiniciar**: `./start.sh` (ele fará o down/up automaticamente se necessário)

## Observações de Segurança
- O worker realiza apenas **conexões de saída** para o Supabase e Storage. Nenhuma porta de entrada (80, 443, etc) é aberta no Docker.
- A autenticação é feita via `service_role` para permitir downloads do bucket privado e execução de RPCs de claim.
- Arquivos temporários são armazenados em `/tmp` dentro e fora do container, sendo limpos automaticamente após cada job.

## Troubleshooting
Se o worker não iniciar, verifique se as credenciais no `.env` estão corretas e se a VPS tem acesso à internet.
Use `docker-compose ps` para verificar o status do container.
