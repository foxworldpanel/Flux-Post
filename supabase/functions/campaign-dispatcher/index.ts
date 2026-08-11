
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    console.log("[campaign-dispatcher] Iniciando ciclo de despacho...");

    // 1. Buscar publicações vencidas (scheduled_for <= NOW) que ainda não foram enviadas
    // Status canônicos: 'agendado', 'pending', 'scheduled'
    const { data: publications, error: fetchError } = await supabaseAdmin
      .from("publications")
      .select("id, campaign_id, user_id, status, scheduled_for")
      .in("status", ["agendado", "pending", "scheduled"])
      .lte("scheduled_for", new Date().toISOString())
      .limit(10); // Lote pequeno para evitar timeouts

    if (fetchError) throw fetchError;

    if (!publications || publications.length === 0) {
      console.log("[campaign-dispatcher] Nenhuma publicação pendente encontrada.");
      return new Response(JSON.stringify({ message: "No publications to dispatch" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    console.log(`[campaign-dispatcher] Encontradas ${publications.length} publicações para processar.`);

    const results = [];

    for (const pub of publications) {
      try {
        console.log(`[campaign-dispatcher] Processando pub ${pub.id}...`);

        // Marcar como 'publishing' para evitar concorrência (lock básico via status)
        const { error: lockError } = await supabaseAdmin
          .from("publications")
          .update({ status: 'publishing', updated_at: new Date().toISOString() })
          .eq("id", pub.id)
          .in("status", ["agendado", "pending", "scheduled"]);

        if (lockError) {
          console.warn(`[campaign-dispatcher] Falha ao adquirir lock para ${pub.id}:`, lockError.message);
          continue;
        }

        // 2. Chamar a Edge Function de criação de post no PostPeer
        // Como estamos em ambiente server-side com service_role, precisamos simular o header ou usar uma key
        // A edge function postpeer-post-create espera um Bearer token do usuário para o .auth.getUser()
        // ALTERNATIVA: Ajustar a postpeer-post-create para aceitar service_role ou passar o user_id.
        // Por agora, vamos tentar invocar passando o ID.
        
        const { data: invokeData, error: invokeError } = await supabaseAdmin.functions.invoke("postpeer-post-create", {
          body: { publicationId: pub.id },
          headers: {
            // Passamos um token administrativo se possível, ou a function precisará ser ajustada
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`
          }
        });

        if (invokeError) {
          console.error(`[campaign-dispatcher] Erro ao invocar postpeer-post-create para ${pub.id}:`, invokeError.message);
          
          await supabaseAdmin.from("publications").update({
            status: 'failed',
            last_error: `Dispatcher Invoke Error: ${invokeError.message}`,
            updated_at: new Date().toISOString()
          }).eq("id", pub.id);
          
          results.push({ id: pub.id, success: false, error: invokeError.message });
        } else {
          console.log(`[campaign-dispatcher] Pub ${pub.id} despachada com sucesso.`);
          results.push({ id: pub.id, success: true, data: invokeData });
        }

      } catch (pubErr: any) {
        console.error(`[campaign-dispatcher] Erro crítico na pub ${pub.id}:`, pubErr.message);
        results.push({ id: pub.id, success: false, error: pubErr.message });
      }
    }

    // 3. Verificar campanhas concluídas
    // (Opcional: Mudar status da campanha se não houver mais publicações pendentes)

    return new Response(JSON.stringify({ processed: publications.length, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (err: any) {
    console.error("[campaign-dispatcher] Fatal Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
