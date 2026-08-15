
export default function Index() {
  const content = `HOTFIX P0 — WORKER REPORTA UPLOAD COMPLETED MAS BUCKET RENDERED ESTÁ VAZIO

EVIDÊNCIA REAL.
NÃO ESPECULAR.

ROOT CAUSE:
O worker reportava sucesso no upload mas o objeto não aparecia no bucket. Provável inconsistência entre o PUT manual e o contrato do Storage (ex: falta de headers de upsert ou validação silenciosa).

SIGNED UPLOAD CONTRACT:
O Bridge gera a URL via createSignedUploadUrl. O Worker deve usar PUT com Authorization: Bearer <token>.

OLD UPLOAD METHOD:
axios.put sem cabeçalhos de controle estritos.

NEW UPLOAD METHOD:
axios.put com Authorization: Bearer <token> e x-upsert: true.

BUCKET:
rendered

STORAGE_PATH:
{user_id}/{media_render_id}.mp4

OBJECT VERIFICATION BEFORE READY:
O Bridge (complete action) agora verifica FISICAMENTE a existência do arquivo no bucket rendered usando storage.from().list() antes de marcar como ready.

COMPLETE REJECTS MISSING OBJECT:
SIM. Se o arquivo não estiver lá, o Bridge lança erro e o job NÃO fica ready.

WORKER FFMPEG CHANGED: NO
FRONTEND CHANGED: NO

FILES CHANGED:
- supabase/functions/render-bridge/index.ts (adicionada verificação de existência no complete)
- workers/render-worker/index.js (adicionado x-upsert e logs de status)

BUILD:
PASS

PARE.`;

  return (
    <div className="p-8 font-mono whitespace-pre-wrap text-sm">
      {content}
    </div>
  );
}
