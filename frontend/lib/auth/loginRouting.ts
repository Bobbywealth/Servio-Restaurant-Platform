export const ADMIN_LANDING_ROUTE = '/admin';
export const DEFAULT_USER_LANDING_ROUTE = '/dashboard';
export const ONBOARDING_ROUTE = '/dashboard/onboarding';

const ADMIN_ROLES = new Set(['admin', 'platform-admin']);

export const isAdminRole = (role?: string | null): boolean => {
  if (!role) return false;
  return ADMIN_ROLES.has(role);
};

export interface OnboardingStatusResponse {
  data?: {
    data?: {
      onboardingCompleted?: boolean;
    };
  };
}

export const getPostLoginRoute = async (
  role: string | null | undefined,
  fetchOnboardingStatus: () => Promise<OnboardingStatusResponse>
): Promise<string> => {
  if (isAdminRole(role)) {
    return ADMIN_LANDING_ROUTE;
  }

  try {
    const statusRes = await fetchOnboardingStatus();
    if (statusRes.data?.data?.onboardingCompleted === false) {
      return ONBOARDING_ROUTE;
    }
  } catch {
    // If onboarding check fails, fall through to normal redirect.
  }

  return DEFAULT_USER_LANDING_ROUTE;
};
