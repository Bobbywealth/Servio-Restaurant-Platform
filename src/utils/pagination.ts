import { Request } from 'express';

export interface PaginationParams {
  page: number;
  limit: number;
  offset: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface PaginationOptions {
  defaultLimit?: number;
  maxLimit?: number;
  defaultPage?: number;
}

/**
 * Parse pagination parameters from request query
 */
export function getPaginationParams(req: QueryParams, options: PaginationOptions = {}): PaginationParams {
  const defaultLimit = options.defaultLimit || 20;
  const maxLimit = options.maxLimit || 100;
  const defaultPage = options.defaultPage || 1;
  
  // Parse page (default to 1)
  const page = Math.max(1, parseInt(req.page as string) || defaultPage);
  
  // Parse limit (default to 20, max 100)
  const limit = Math.min(maxLimit, Math.max(1, parseInt(req.limit as string) || defaultLimit));
  
  // Calculate offset
  const offset = (page - 1) * limit;
  
  // Parse sort parameters
  const sortBy = (req.sortBy as string) || undefined;
  const sortOrder = (req.sortOrder === 'asc' || req.sortOrder === 'desc') 
    ? req.sortOrder as 'asc' | 'desc' 
    : 'asc';
  
  return { page, limit, offset, sortBy, sortOrder };
}

/**
 * Create paginated response
 */
export function createPaginatedResponse<T>(
  data: T[],
  total: number,
  params: PaginationParams
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / params.limit);
  
  return {
    data,
    pagination: {
      page: params.page,
      limit: params.limit,
      total,
      totalPages,
      hasNext: params.page < totalPages,
      hasPrev: params.page > 1
    }
  };
}

// Type for query params
interface QueryParams {
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
  [key: string]: string | number | undefined;
}

/**
 * Build pagination metadata for response headers (Link header for HATEOAS)
 */
export function buildPaginationLinks(
  req: Request,
  page: number,
  limit: number,
  total: number
): string {
  const totalPages = Math.ceil(total / limit);
  const baseUrl = `${req.protocol}://${req.get('host')}${req.path}`;
  const queryParams = new URLSearchParams(req.query as any).toString();
  
  const links: string[] = [];
  
  // Self link
  links.push(`<${baseUrl}?${queryParams}>; rel="self"`);
  
  // First link
  if (page > 1) {
    const firstParams = new URLSearchParams(req.query as any);
    firstParams.set('page', '1');
    links.push(`<${baseUrl}?${firstParams}>; rel="first"`);
  }
  
  // Previous link
  if (page > 1) {
    const prevParams = new URLSearchParams(req.query as any);
    prevParams.set('page', String(page - 1));
    links.push(`<${baseUrl}?${prevParams}>; rel="previous"`);
  }
  
  // Next link
  if (page < totalPages) {
    const nextParams = new URLSearchParams(req.query as any);
    nextParams.set('page', String(page + 1));
    links.push(`<${baseUrl}?${nextParams}>; rel="next"`);
  }
  
  // Last link
  if (page < totalPages) {
    const lastParams = new URLSearchParams(req.query as any);
    lastParams.set('page', String(totalPages));
    links.push(`<${baseUrl}?${lastParams}>; rel="last"`);
  }
  
  return links.join(', ');
}

/**
 * Cursor-based pagination for large datasets
 * More efficient than offset-based for real-time data
 */
export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CursorPaginatedResponse<T> {
  data: T[];
  pagination: {
    nextCursor: string | null;
    previousCursor: string | null;
    hasMore: boolean;
    limit: number;
  };
}

/**
 * Encode cursor for pagination
 */
export function encodeCursor(value: any): string {
  return Buffer.from(JSON.stringify(value)).toString('base64');
}

/**
 * Decode cursor for pagination
 */
export function decodeCursor<T>(cursor: string): T | null {
  try {
    return JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
  } catch {
    return null;
  }
}
