export type ServiceFactory<T = unknown> = (...deps: any[]) => T;

export type ServiceLifetime = 'singleton' | 'transient' | 'scoped';

export interface ServiceDefinition<T = unknown> {
  factory: ServiceFactory<T>;
  lifetime: ServiceLifetime;
  dependencies: string[];
}

export class ServiceContainer {
  private services = new Map<string, ServiceDefinition>();
  private singletons = new Map<string, unknown>();
  private scopes = new Map<string, Map<string, unknown>>();

  register<T>(
    name: string,
    factory: ServiceFactory<T>,
    options: { singleton?: boolean; lifetime?: ServiceLifetime; dependencies?: string[] } = {}
  ): this {
    const lifetime: ServiceLifetime =
      options.lifetime ?? (options.singleton === undefined ? 'singleton' : options.singleton ? 'singleton' : 'transient');

    this.services.set(name, {
      factory,
      lifetime,
      dependencies: options.dependencies ?? []
    });
    return this;
  }

  registerValue<T>(name: string, value: T): this {
    return this.register<T>(name, () => value, { lifetime: 'singleton', dependencies: [] });
  }

  has(name: string): boolean {
    return this.services.has(name);
  }

  createScope(scopeId: string): void {
    if (!this.scopes.has(scopeId)) this.scopes.set(scopeId, new Map());
  }

  destroyScope(scopeId: string): void {
    this.scopes.delete(scopeId);
  }

  get<T>(name: string, scopeId?: string): T {
    const definition = this.services.get(name);
    if (!definition) throw new Error(`Service '${name}' not found`);

    if (definition.lifetime === 'singleton') {
      if (this.singletons.has(name)) return this.singletons.get(name) as T;
      const instance = this.instantiate<T>(definition, scopeId);
      this.singletons.set(name, instance);
      return instance;
    }

    if (definition.lifetime === 'scoped') {
      if (!scopeId) throw new Error(`Service '${name}' is scoped but no scopeId was provided`);
      const scope = this.scopes.get(scopeId);
      if (!scope) throw new Error(`Scope '${scopeId}' not found (did you forget createScope?)`);

      if (scope.has(name)) return scope.get(name) as T;
      const instance = this.instantiate<T>(definition, scopeId);
      scope.set(name, instance);
      return instance;
    }

    // transient
    return this.instantiate<T>(definition, scopeId);
  }

  clear(): void {
    this.singletons.clear();
    this.scopes.clear();
  }

  private instantiate<T>(definition: ServiceDefinition, scopeId?: string): T {
    const deps = definition.dependencies.map((depName) => this.get(depName, scopeId));
    return definition.factory(...deps) as T;
  }
}

export const container = new ServiceContainer();

