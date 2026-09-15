import fs from 'node:fs';

const file = 'src/routes/campanha.tsx';
let source = fs.readFileSync(file, 'utf8');
const startMarker = '      // 1. Ativar o rascunho existente ou criar uma nova campanha';
const endMarker = '      // A campanha foi lançada com sucesso e não é mais um rascunho';
const start = source.indexOf(startMarker);
const end = source.indexOf(endMarker, start);
if (start < 0 || end < 0) throw new Error('Atomic launch patch markers not found; aborting without changes.');

const replacement = `      // A partir daqui não fazemos mais gravações parciais. O plano já foi
      // validado acima e é enviado inteiro para uma única transação no banco.
      const campaignPayload = {
        nome: formData.nome.trim(),
        artist_id: formData.artist_id,
        music_track_id: formData.music_track_id,
        posts_por_dia: formData.posts_por_dia,
        hora_inicio: parseInt(formData.hora_inicio, 10),
        hora_fim: parseInt(formData.hora_fim, 10),
        daily_start_time: formData.hora_inicio,
        daily_end_time: formData.hora_fim,
        schedule_mode: formData.schedule_mode,
        intervalo_min: formData.intervalo_min,
        intervalo_max: formData.intervalo_max,
        data_inicio: formData.data_inicio,
        data_fim: formData.data_fim,
        audio_mode: formData.audio_mode,
        music_volume: formData.music_volume,
        original_audio_volume: formData.original_audio_volume,
        music_start_ms: formData.music_start_ms,
      };

      const atomicContents = selectedVideoIds.map((id, index) => {
        const editorialCopy = getEditorialCopy(id);
        const isApproved = readyRenders.some(r => r.source_content_id === id && r.is_approved);
        return {
          content_id: id,
          position: index + 1,
          caption: editorialCopy.caption.trim() || null,
          hashtags: mergeArtistHashtags(editorialCopy.hashtags) || null,
          editorial_status: isApproved ? 'approved' : editorialCopy.aiStatus,
          approved_at: isApproved ? new Date().toISOString() : null,
        };
      });

      const atomicAccounts = selectedAccountIds.map(id => ({ social_account_id: id }));
      const atomicPublications = resolvedSmartPlan.map(slot => {
        const render = renderByContentId.get(slot.contentId);
        if (!render) throw new Error(\`Render não encontrado para o conteúdo \${slot.contentId}\`);
        const sourceContent = contentById.get(slot.contentId);
        const editorialCopy = getEditorialCopy(slot.contentId);
        return {
          content_id: slot.contentId,
          social_account_id: slot.accountId,
          platform: slot.platform,
          caption: editorialCopy.caption.trim() || null,
          hashtags: hashtagsToArray(mergeArtistHashtags(editorialCopy.hashtags)),
          scheduled_for: slot.scheduledFor,
          media_render_id: render.id,
          timezone: 'America/Sao_Paulo',
          source_provider: sourceContent?.source || null,
          source_external_id: sourceContent?.external_id || null,
          metadata: {
            campaign_name: formData.nome,
            smart_campaign: { version: 'v2', schedule_mode: formData.schedule_mode, day_period: slot.dayPeriod, sequence: slot.sequence, creative_rotation: true, account_stagger_minutes: 7 },
            audio_mode: formData.audio_mode,
            music_start_ms: formData.music_start_ms,
            music_volume: formData.music_volume,
            original_audio_volume: formData.original_audio_volume,
            source: { provider: sourceContent?.source || null, external_id: sourceContent?.external_id || null, title: sourceContent?.title || null, original_url: sourceContent?.original_url || null, thumbnail_url: sourceContent?.thumbnail_url || null, author: sourceContent?.author || null, duration_seconds: sourceContent?.duration_seconds || null },
          },
        };
      });

      const { data: launchResult, error: launchError } = await supabase.rpc('launch_campaign_atomic', {
        p_campaign: campaignPayload,
        p_draft_campaign_id: draftCampaignId,
        p_contents: atomicContents,
        p_accounts: atomicAccounts,
        p_publications: atomicPublications,
      });
      if (launchError) throw launchError;
      if (!launchResult || (launchResult as any).ok !== true) throw new Error('O banco não confirmou o lançamento da campanha');
      const publications = atomicPublications;

`;

source = source.slice(0, start) + replacement + source.slice(end);
fs.writeFileSync(file, source);
console.log('Patched atomic campaign launch in', file);
