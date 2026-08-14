LEGIT MODE — HOTFIX P0

HOTFIX P0 — uploadInfo UNDEFINED

Bug REAL confirmado na VPS.

workers/render-worker/index.js

processJob() recebe:

const { job, inputs } = claimResult;

Depois do FFmpeg o código tenta:

axios.put(uploadInfo.upload_url, ...)

Authorization: Bearer ${uploadInfo.token}

porém uploadInfo NUNCA é declarado.

O worker também NÃO chama atualmente:

action: "get_upload_url"

CORRIGIR CIRURGICAMENTE.

Depois do FFmpeg terminar e ANTES de ler/enviar output.mp4:

const uploadResponse = await client.post('', {

  action: 'get_upload_url',

  job_id: job.id

});

Validar a estrutura REAL retornada pelo render-bridge atual.

Extrair dela:

upload_url

token

storage_path

NÃO assumir cegamente o formato.

Auditar supabase/functions/render-bridge/index.ts e usar exatamente

o contrato retornado por action === "get_upload_url".

Criar uploadInfo a partir dessa resposta.

Depois executar o upload usando o contrato correto.

IMPORTANTE:

NÃO alterar FFmpeg.

NÃO alterar claim.

NÃO alterar heartbeat.

NÃO alterar frontend.

NÃO alterar Supabase schema.

NÃO criar domínio.

NÃO criar API HTTP.

NÃO alterar arquitetura.

Fluxo obrigatório:

claim

→ download

→ ffprobe

→ FFmpeg

→ get_upload_url

→ upload output.mp4

→ complete

→ ready

Adicionar logs seguros:

Requesting signed upload URL...

Uploading result...

Upload completed.

Completing job...

Success.

Nunca imprimir:

token

signed URL completa

RENDER_WORKER_SECRET

IMPORTANTE:

O worker da VPS está PARADO propositalmente.

Não considerar teste real executado apenas pelo build.

Validar também que uploadInfo não é referenciado em nenhum ponto

antes de sua declaração.

RELATÓRIO:

UPLOADINFO DECLARED: YES

GET_UPLOAD_URL IMPLEMENTED: YES

BRIDGE RESPONSE CONTRACT: { upload_url, token, storage_path }

UPLOAD METHOD: PUT

TOKEN USED: YES (Authorization: Bearer)

COMPLETE AFTER UPLOAD ONLY: YES

UNDEFINED REFERENCES: 0

BUILD: PASS

FILES CHANGED: workers/render-worker/index.js, src/routes/index.tsx

PARE.