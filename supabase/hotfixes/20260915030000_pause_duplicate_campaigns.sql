-- Emergency remediation for active campaigns that can repeat content.
-- Preserves every historical publication. Only unsent work is paused.
-- Covers both duplicates inside the active campaign and unsent rows that match
-- content already sent/publishing in any campaign for the same destination.
-- Run after 20260915022000_campaign_pause_and_atomic_launch.sql.

WITH unsafe_campaigns AS (
  SELECT DISTINCT p.campaign_id
  FROM public.publications p
  JOIN public.campanhas c ON c.id = p.campaign_id
  WHERE p.campaign_id IS NOT NULL
    AND c.status = 'ativo'
    AND p.provider_post_id IS NULL
    AND COALESCE(p.status,'') IN ('agendado','pending','scheduled','waiting_render','ready_to_post','queued')
    AND (
      -- Repetition already scheduled inside the same campaign/account.
      EXISTS (
        SELECT 1
        FROM public.publications x
        WHERE x.campaign_id = p.campaign_id
          AND x.id <> p.id
          AND x.social_account_id = p.social_account_id
          AND (
            (p.content_id IS NOT NULL AND x.content_id = p.content_id)
            OR (
              p.source_external_id IS NOT NULL
              AND x.source_external_id = p.source_external_id
              AND COALESCE(x.source_provider,'') = COALESCE(p.source_provider,'')
            )
          )
      )
      OR
      -- Content scheduled now but already handed to the provider, publishing or
      -- published historically for this same social account, even in another campaign.
      EXISTS (
        SELECT 1
        FROM public.publications x
        WHERE x.id <> p.id
          AND x.social_account_id = p.social_account_id
          AND (
            (p.content_id IS NOT NULL AND x.content_id = p.content_id)
            OR (
              p.source_external_id IS NOT NULL
              AND x.source_external_id = p.source_external_id
              AND COALESCE(x.source_provider,'') = COALESCE(p.source_provider,'')
            )
          )
          AND (
            x.provider_post_id IS NOT NULL
            OR COALESCE(x.status,'') IN ('publishing','processing','published')
          )
      )
    )
), paused_campaigns AS (
  UPDATE public.campanhas c
  SET status='pausado', paused_at=COALESCE(c.paused_at, now())
  WHERE c.id IN (SELECT campaign_id FROM unsafe_campaigns)
  RETURNING c.id
)
UPDATE public.publications p
SET metadata = COALESCE(p.metadata,'{}'::jsonb) || jsonb_build_object(
      'paused_from_status', p.status,
      'safety_hotfix', 'duplicate_or_historical_content'
    ),
    status='paused',
    last_error=COALESCE(p.last_error || ' | ','') || 'Paused by duplicate-content safety hotfix',
    updated_at=now()
WHERE p.campaign_id IN (SELECT id FROM paused_campaigns)
  AND p.provider_post_id IS NULL
  AND p.status IN ('agendado','pending','scheduled','waiting_render','ready_to_post','queued');

-- Operator report: only campaigns paused by this hotfix.
SELECT c.id AS campaign_id,
       c.nome,
       c.status,
       COUNT(*) FILTER (WHERE p.status='paused' AND p.metadata->>'safety_hotfix'='duplicate_or_historical_content') AS paused_publications,
       COUNT(*) FILTER (WHERE p.provider_post_id IS NOT NULL) AS already_sent
FROM public.campanhas c
JOIN public.publications p ON p.campaign_id=c.id
WHERE c.id IN (
  SELECT DISTINCT campaign_id
  FROM public.publications
  WHERE metadata->>'safety_hotfix'='duplicate_or_historical_content'
)
GROUP BY c.id,c.nome,c.status
ORDER BY c.nome;
