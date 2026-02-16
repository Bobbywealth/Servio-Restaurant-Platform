import { isPlatformAdminOnly, resolveCampaignTransition } from '../../routes/adminCampaignModeration';

describe('resolveCampaignTransition', () => {
  it('allows pending_owner_approval -> scheduled when approving a scheduled campaign', () => {
    expect(
      resolveCampaignTransition({
        action: 'approve',
        currentStatus: 'pending_owner_approval',
        scheduledAt: '2026-02-15T12:00:00Z'
      })
    ).toBe('scheduled');
  });

  it('allows pending_owner_approval -> approved when approving without scheduled_at', () => {
    expect(
      resolveCampaignTransition({
        action: 'approve',
        currentStatus: 'pending_owner_approval',
        scheduledAt: null
      })
    ).toBe('approved');
  });

  it('allows disapprove transition to rejected', () => {
    expect(
      resolveCampaignTransition({
        action: 'disapprove',
        currentStatus: 'pending_owner_approval',
        scheduledAt: null
      })
    ).toBe('rejected');

    expect(
      resolveCampaignTransition({
        action: 'disapprove',
        currentStatus: 'approved',
        scheduledAt: null
      })
    ).toBe('rejected');
  });

  it('blocks invalid transitions', () => {
    expect(
      resolveCampaignTransition({
        action: 'approve',
        currentStatus: 'sent',
        scheduledAt: null
      })
    ).toBeNull();

    expect(
      resolveCampaignTransition({
        action: 'disapprove',
        currentStatus: 'sent',
        scheduledAt: null
      })
    ).toBeNull();
  });
});

describe('isPlatformAdminOnly', () => {
  it('allows platform-admin users only', () => {
    expect(isPlatformAdminOnly(undefined)).toBe(false);
    expect(isPlatformAdminOnly({ role: 'admin' } as any)).toBe(false);
    expect(isPlatformAdminOnly({ role: 'platform-admin' } as any)).toBe(true);
  });
});
