export type ServiceState = 'operational' | 'degraded' | 'down';

export interface HealthServiceProbe {
  name: string;
  url: string;
  status: ServiceState;
  latency: number;
  lastChecked: string;
  error: string | null;
  optional: boolean;
}

export interface HealthErrorEvent {
  action: string;
  entity_type?: string;
  entity_id?: string;
  restaurant_id?: string;
  created_at: string;
}

export interface SystemHealthPayload {
  status: ServiceState;
  failedJobs: number;
  recentErrors: HealthErrorEvent[];
  storageErrors: HealthErrorEvent[];
  services: HealthServiceProbe[];
  timestamp: string;
}

interface SystemHealthDb {
  get: (query: string, params?: any[]) => Promise<any>;
  all: (query: string, params?: any[]) => Promise<any[]>;
}

interface BuildSystemHealthArgs {
  db: SystemHealthDb;
  requestProtocol: string;
  requestHost?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  now?: () => Date;
}

interface ProbeTarget {
  name: string;
  url: string;
  optional?: boolean;
}

const DEFAULT_TIMEOUT_MS = 2500;

const normalizeBaseUrl = (rawUrl: string): string => rawUrl.replace(/\/$/, '');

const parseOptionalTargets = (): ProbeTarget[] => {
  const configured = process.env.HEALTHCHECK_OPTIONAL_URLS;
  if (!configured) {
    return [];
  }

  return configured
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry, index) => {
      const [namePart, urlPart] = entry.includes('|')
        ? entry.split('|').map((segment) => segment.trim())
        : [`Optional dependency ${index + 1}`, entry];

      return {
        name: namePart || `Optional dependency ${index + 1}`,
        url: urlPart,
        optional: true
      };
    })
    .filter((target) => Boolean(target.url));
};

const buildProbeTargets = (requestProtocol: string, requestHost?: string): ProbeTarget[] => {
  const frontendUrl = process.env.FRONTEND_URL || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  const apiBaseUrl = process.env.BACKEND_URL || (requestHost ? `${requestProtocol}://${requestHost}` : 'http://localhost:3002');

  return [
    {
      name: 'Frontend',
      url: normalizeBaseUrl(frontendUrl)
    },
    {
      name: 'API health',
      url: `${normalizeBaseUrl(apiBaseUrl)}/health`
    },
    ...parseOptionalTargets()
  ];
};

const probeService = async (
  target: ProbeTarget,
  fetchImpl: typeof fetch,
  timeoutMs: number,
  now: () => Date
): Promise<HealthServiceProbe> => {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(target.url, {
      method: 'GET',
      signal: controller.signal
    });

    const latency = Date.now() - startedAt;
    const status: ServiceState = response.ok
      ? 'operational'
      : target.optional
        ? 'degraded'
        : 'down';

    return {
      name: target.name,
      url: target.url,
      status,
      latency,
      lastChecked: now().toISOString(),
      error: response.ok ? null : `HTTP ${response.status}`,
      optional: Boolean(target.optional)
    };
  } catch (error) {
    const latency = Date.now() - startedAt;
    const errorName = typeof error === 'object' && error !== null && 'name' in error
      ? String((error as { name?: unknown }).name)
      : '';
    const errorMessage = error instanceof Error
      ? error.message
      : typeof error === 'object' && error !== null && 'message' in error
        ? String((error as { message?: unknown }).message)
        : 'Probe failed';
    const isTimeout = errorName === 'AbortError';

    return {
      name: target.name,
      url: target.url,
      status: target.optional ? 'degraded' : 'down',
      latency,
      lastChecked: now().toISOString(),
      error: isTimeout ? `Probe timed out after ${timeoutMs}ms` : errorMessage,
      optional: Boolean(target.optional)
    };
  } finally {
    clearTimeout(timeout);
  }
};

const deriveOverallStatus = (
  services: HealthServiceProbe[],
  failedJobs: number,
  recentErrorCount: number
): ServiceState => {
  const hasCriticalDown = services.some((service) => !service.optional && service.status === 'down');
  if (hasCriticalDown) {
    return 'down';
  }

  const hasServiceIssue = services.some((service) => service.status !== 'operational');
  if (hasServiceIssue || failedJobs > 0 || recentErrorCount > 0) {
    return 'degraded';
  }

  return 'operational';
};

export const buildSystemHealthPayload = async ({
  db,
  requestProtocol,
  requestHost,
  fetchImpl = fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  now = () => new Date()
}: BuildSystemHealthArgs): Promise<SystemHealthPayload> => {
  const [failedJobsResult, recentErrors, storageErrors, services] = await Promise.all([
    db.get(`SELECT COUNT(*) as count FROM sync_jobs WHERE status = 'failed'`),
    db.all(`
      SELECT action, entity_type, entity_id, restaurant_id, created_at
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND (
          LOWER(action) LIKE '%error%'
          OR LOWER(action) LIKE '%fail%'
          OR LOWER(action) LIKE '%exception%'
        )
      ORDER BY created_at DESC
      LIMIT 50
    `),
    db.all(`
      SELECT action, entity_type, entity_id, restaurant_id, created_at
      FROM audit_logs
      WHERE created_at >= NOW() - INTERVAL '24 hours'
        AND (
          LOWER(entity_type) LIKE '%storage%'
          OR LOWER(action) LIKE '%storage%'
          OR LOWER(action) LIKE '%upload%'
        )
      ORDER BY created_at DESC
      LIMIT 20
    `),
    Promise.all(
      buildProbeTargets(requestProtocol, requestHost).map((target) =>
        probeService(target, fetchImpl, timeoutMs, now)
      )
    )
  ]);

  const failedJobs = Number(failedJobsResult?.count || 0);

  return {
    status: deriveOverallStatus(services, failedJobs, recentErrors.length),
    failedJobs,
    recentErrors: recentErrors as HealthErrorEvent[],
    storageErrors: storageErrors as HealthErrorEvent[],
    services,
    timestamp: now().toISOString()
  };
};
