import type { DbClient } from '../../services/DatabaseService';

export function createMockDatabaseService(db: DbClient): {
  getDatabase: () => DbClient;
  logAudit: (
    restaurantId: string,
    userId: string | null,
    action: string,
    entityType: string,
    entityId: string | null,
    details?: any
  ) => Promise<void>;
} {
  return {
    getDatabase: () => db,
    logAudit: async () => {
      // no-op by default; tests can wrap/spy if needed
    }
  };
}

