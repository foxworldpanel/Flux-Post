import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-render-worker-secret",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders, status: 204 });
  }

  const workerSecret = req.headers.get("x-render-worker-secret");
  const expectedSecret = Deno.env.get("RENDER_WORKER_SECRET");

  if (!workerSecret || workerSecret !== expectedSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { 
      status: 401, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { action, job_id, error_message, file_metadata } = await req.json();

    switch (action) {
      case "claim": {
        const { data: job, error: claimError } = await supabase.rpc('claim_next_render_job', { 
          lease_interval: '5 minutes' 
        });
        
        if (claimError) {
          console.error('[render-bridge] claim_next_render_job RPC error:', claimError);
          throw claimError;
        }

        // RPC returns null if no job found, but we normalize checks for security
        if (!job || Object.keys(job).length === 0) {
          return new Response(JSON.stringify({ job: null }), { 
            headers: { ...corsHeaders, "Content-Type": "application/json" } 
          });
        }

        // Get content & music details
        const { data: content } = await supabase.from('content_library').select('*').eq('id', job.source_content_id).single();
        const { data: music } = await supabase.from('music_tracks').select('*').eq('id', job.music_track_id).single();

        if (!content || !music) throw new Error("Input files not found in library");

        // 1. Verify objects exist physically and generate short-lived signed URLs (1 hour)
        const { data: videoFiles } = await supabase.storage.from('content-library').list(pathDir(content.storage_path), {
          search: pathBase(content.storage_path)
        });

        const { data: musicFiles } = await supabase.storage.from('musicas').list(pathDir(music.storage_path), {
          search: pathBase(music.storage_path)
        });

        const videoExists = videoFiles && videoFiles.length > 0;
        const musicExists = musicFiles && musicFiles.length > 0;

        if (!videoExists || !musicExists) {
          const missing = !videoExists && !musicExists ? "Video and Music" : (!videoExists ? "Video" : "Music");
          const errorMsg = `Physical input files not found in storage: ${missing}`;
          
          await supabase.from('media_renders').update({
            status: 'failed',
            error_message: errorMsg,
            last_heartbeat: null
          }).eq('id', job.id);

          return new Response(JSON.stringify({ 
            job: null,
            error: errorMsg,
            details: { video: videoExists, music: musicExists }
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const { data: videoUrl } = await supabase.storage.from('content-library').createSignedUrl(content.storage_path, 3600);
        const { data: musicUrl } = await supabase.storage.from('musicas').createSignedUrl(music.storage_path, 3600);

        return new Response(JSON.stringify({ 
          job, 
          inputs: {
            video_url: videoUrl?.signedUrl,
            music_url: musicUrl?.signedUrl
          }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "heartbeat": {
        if (!job_id) throw new Error("Missing job_id");
        const { error: hbError } = await supabase.rpc('heartbeat_render_job', { job_id });
        if (hbError) throw hbError;
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "complete": {
        if (!job_id) throw new Error("Missing job_id");
        
        // 1. Verify storage object exists in 'rendered' bucket
        const { data: jobData } = await supabase.from('media_renders').select('storage_path, user_id').eq('id', job_id).single();
        if (!jobData || !jobData.storage_path) throw new Error("Job storage path not defined");

        const { data: fileExists } = await supabase.storage.from('rendered').list(pathDir(jobData.storage_path), {
          search: pathBase(jobData.storage_path)
        });

        if (!fileExists || fileExists.length === 0) {
          throw new Error(`Output file not found in storage: ${jobData.storage_path}`);
        }

        // 2. Update media_renders
        const { error: upError } = await supabase.from('media_renders').update({
          status: 'ready',
          completed_at: new Date().toISOString(),
          ...file_metadata
        }).eq('id', job_id);

        if (upError) throw upError;

        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "fail": {
        if (!job_id) throw new Error("Missing job_id");
        
        const { data: currentJob } = await supabase.from('media_renders').select('attempts, max_attempts').eq('id', job_id).single();
        const nextStatus = (currentJob && currentJob.attempts >= currentJob.max_attempts) ? 'failed' : 'queued';

        const { error: failError } = await supabase.from('media_renders').update({
          status: nextStatus,
          error_message: error_message || 'Unknown worker error',
          last_heartbeat: null
        }).eq('id', job_id);

        if (failError) throw failError;
        return new Response(JSON.stringify({ success: true, next_status: nextStatus }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      case "get_upload_url": {
        // Generate signed upload URL for the worker
        if (!job_id) throw new Error("Missing job_id");
        const { data: jobData } = await supabase.from('media_renders').select('render_key, user_id').eq('id', job_id).single();
        if (!jobData) throw new Error("Job not found");

        const storagePath = `${jobData.user_id}/${jobData.render_key}.mp4`;
        
        // Ensure path is updated in DB first so 'complete' can verify it
        await supabase.from('media_renders').update({ storage_path: storagePath }).eq('id', job_id);

        const { data, error } = await supabase.storage.from('rendered').createSignedUploadUrl(storagePath);
        if (error) throw error;

        return new Response(JSON.stringify({ 
          upload_url: data.signedUrl,
          token: data.token,
          storage_path: storagePath
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  } catch (err: any) {
    console.error(`[render-bridge] Error:`, err.message);
    return new Response(JSON.stringify({ error: err.message }), { 
      status: 500, 
      headers: { ...corsHeaders, "Content-Type": "application/json" } 
    });
  }
});

function pathDir(path: string) {
  const parts = path.split('/');
  return parts.slice(0, -1).join('/');
}

function pathBase(path: string) {
  return path.split('/').pop() || '';
}
