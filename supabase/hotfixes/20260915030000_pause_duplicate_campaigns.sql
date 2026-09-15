-- Emergency remediation for campaigns that already contain repeated content.
-- Preserves every historical publication. Only unsent work is paused.
-- Run after 20260915022000_campaign_pause_and_atomic_launch.sql.

WITH duplicate_campaigns AS (
  SELECT DISTINCT p.campaign_id
  FROM public.publications p
  JOIN public.campanhas c ON c.id = p.campaign_id
  WHERE p.campaign_id IS NOT NULL
    AND c.status = 'ativo'
    AND (
      EXISTS (
        SELECT 1
        FROM public.publications x
        WHERE x.campaign_id = p.campaign_id
          AND x.id <> p.id
          AND x.social_account_id = p.social_account_id
          AND p.content_id IS NOT NULL
          AND x.content_id = p.content_id
      )
      OR EXISTS (
        SELECT 1
        FROM public.publications x
        WHERE x.campaign_id = p.campaign_id
          AND x.id <> p.id
          AND x.social_account_id = p.social_account_id
          AND p.source_external_id IS NOT NULL
          AND x.source_external_id = p.source_external_id
          AND COALESCE(x.source_provider,'') = COALESCE(p.source_provider,'')
      )
    )
), paused_campaigns AS (
  UPDATE public.campanhas c
  SET status='pausado', paused_at=COALESCE(c.paused_at, now())
  WHERE c.id IN (SELECT campaign_id FROM duplicate_campaigns)
  RETURNING c.id
)
UPDATE public.publications p
SET metadata = COALESCE(p.metadata,'{}'::jsonb) || jsonb_build_object('paused_from_status', p.status, 'safety_hotfix', 'duplicate_campaign'),
    status='paused',
    last_error=COALESCE(p.last_error || ' | ','') || 'Paused by duplicate-content safety hotfix',
    updated_at=now()
WHERE p.campaign_id IN (SELECT id FROM paused_campaigns)
  AND p.provider_post_id IS NULL
  AND p.status IN ('agendado','pending','scheduled','waiting_render','ready_to_post','queued');

-- Report what remains for operator visibility.
SELECT c.id AS campaign_id, c.nome, c.status,
       COUNT(*) FILTER (WHERE p.status='paused') AS paused_publications,
       COUNT(*) FILTER (WHERE p.provider_post_id IS NOT NULL) AS already_sent
FROM public.campanhas c
JOIN public.publications p ON p.campaign_id=c.id
WHERE c.status='pausado'
  AND EXISTS (
    SELECT 1 FROM public.publications a
    JOIN public.publications b ON b.campaign_id=a.campaign_id AND b.id<>a.id
    WHERE a.campaign_id=c.id AND a.social_account_id=b.social_account_id
      AND ((a.content_id IS NOT NULL AND a.content_id=b.content_id)
        OR (a.source_external_id IS NOT NULL AND a.source_external_id=b.source_external_id AND COALESCE(a.source_provider,'')=COALESCE(b.source_provider,'')))
  )
GROUP BY c.id,c.nome,c.status
ORDER BY c.nome;
