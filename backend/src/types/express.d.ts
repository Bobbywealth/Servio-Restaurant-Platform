import type { AuthUser } from './auth';
import 'multer';
import type { ServiceContainer } from '../container/ServiceContainer';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      file?: Multer.File;
      files?: Multer.File[] | { [fieldname: string]: Multer.File[] };
      scopeId?: string;
      container?: ServiceContainer;
    }
    
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        destination: string;
        filename: string;
        path: string;
        buffer: Buffer;
      }
    }
  }
}

export {};

