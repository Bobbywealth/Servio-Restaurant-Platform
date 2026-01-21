import type { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { ServiceContainer } from '../container/ServiceContainer';

export function containerMiddleware(container: ServiceContainer) {
  return (req: Request, res: Response, next: NextFunction) => {
    const scopeId = uuidv4();
    req.scopeId = scopeId;
    req.container = container;
    container.createScope(scopeId);

    res.on('finish', () => {
      container.destroyScope(scopeId);
    });

    next();
  };
}

