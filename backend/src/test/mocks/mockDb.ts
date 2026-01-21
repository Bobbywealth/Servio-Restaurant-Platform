import type { DbClient, RunResult } from '../../services/DatabaseService';

export type MockDbHandlers = Partial<{
  all: (sql: string, params?: any[]) => any[] | Promise<any[]>;
  get: (sql: string, params?: any[]) => any | undefined | Promise<any | undefined>;
  run: (sql: string, params?: any[]) => RunResult | Promise<RunResult>;
  exec: (sql: string) => void | Promise<void>;
}>;

export function createMockDb(handlers: MockDbHandlers = {}): DbClient {
  return {
    dialect: 'sqlite',
    all: async (sql: string, params: any[] = []) => {
      if (!handlers.all) throw new Error(`MockDb missing handler for all(): ${sql}`);
      return await handlers.all(sql, params);
    },
    get: async (sql: string, params: any[] = []) => {
      if (!handlers.get) throw new Error(`MockDb missing handler for get(): ${sql}`);
      return await handlers.get(sql, params);
    },
    run: async (sql: string, params: any[] = []) => {
      if (!handlers.run) throw new Error(`MockDb missing handler for run(): ${sql}`);
      return await handlers.run(sql, params);
    },
    exec: async (sql: string) => {
      if (!handlers.exec) return;
      await handlers.exec(sql);
    }
  };
}

