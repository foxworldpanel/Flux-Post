export const STUDIO_CAMPAIGN_HANDOFF_KEY = "flux-studio-campaign-handoff";

export type StudioCampaignHandoffItem = {
  scriptId: string;
  title: string;
  renderId: string;
  contentId: string;
  musicTrackId: string;
  caption?: string;
  hashtags?: string;
};

export type StudioCampaignHandoff = {
  version: 1;
  projectId: string;
  projectName: string;
  createdAt: string;
  postsPerDay?: number;
  items: StudioCampaignHandoffItem[];
};

export const readStudioCampaignHandoff = (): StudioCampaignHandoff | null => {
  try {
    const raw = window.sessionStorage.getItem(STUDIO_CAMPAIGN_HANDOFF_KEY);
    if (!raw) return null;

    const value = JSON.parse(raw) as StudioCampaignHandoff;
    if (value?.version !== 1 || !Array.isArray(value.items) || !value.items.length) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
};
