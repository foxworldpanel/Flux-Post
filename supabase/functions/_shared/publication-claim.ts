import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type PublicationClaimResult = {
  allowed: boolean;
  reason?: string;
  publication_id?: string;
};

/**
 * Final safety gate before a publication is sent to a social provider.
 * The database function serializes claims by social account + content,
 * refuses paused/closed campaigns and prevents a creative from being
 * sent twice to the same social destination.
 */
export async function claimPublicationForPosting(
  supabaseAdmin: SupabaseClient,
  publicationId: string,
): Promise<PublicationClaimResult> {
  const { data, error } = await supabaseAdmin.rpc(
    "claim_publication_for_posting",
    { p_publication_id: publicationId },
  );

  if (error) {
    throw new Error(`Publication safety claim failed: ${error.message}`);
  }

  const claim = (data || {}) as PublicationClaimResult;

  if (!claim.allowed) {
    return {
      allowed: false,
      reason: claim.reason || "publication_blocked",
      publication_id: publicationId,
    };
  }

  return {
    ...claim,
    allowed: true,
    publication_id: publicationId,
  };
}
