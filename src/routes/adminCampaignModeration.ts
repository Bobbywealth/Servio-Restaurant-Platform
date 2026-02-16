import { AuthUser } from '../types/auth';

export type CampaignModerationAction = 'approve' | 'disapprove';

type CampaignTransitionRequest = {
  action: CampaignModerationAction;
  currentStatus: string;
  scheduledAt: string | null;
};

export const isPlatformAdminOnly = (user?: AuthUser): boolean => user?.role === 'platform-admin';

export const resolveCampaignTransition = ({
  action,
  currentStatus,
  scheduledAt
}: CampaignTransitionRequest): string | null => {
  if (action === 'approve') {
    if (currentStatus !== 'pending_owner_approval') return null;
    return scheduledAt ? 'scheduled' : 'approved';
  }

  if (action === 'disapprove') {
    if (currentStatus !== 'pending_owner_approval' && currentStatus !== 'approved') return null;
    return 'rejected';
  }

  return null;
};
