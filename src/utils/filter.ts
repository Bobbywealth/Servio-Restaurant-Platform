import { Request } from 'express';

export interface FilterParams {
  filters: Record<string, any>;
  search?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
  status?: string | string[];
}

export interface SortParams {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

export interface FilterOptions {
  allowedFilters?: string[];
  searchableFields?: string[];
  defaultSort?: SortParams;
}

/**
 * Parse filter parameters from request query
 * Supports: exact match, partial match, range, in-array
 * 
 * Query format:
 * - ?status=active (exact match)
 * - ?name_contains=pizza (partial match)
 * ?price_gte=10&price_lte=20 (range)
 * - ?status_in=active,pending (in array)
 * - ?search=pizza (full-text search)
 * - ?date_from=2024-01-01&date_to=2024-12-31 (date range)
 */
export function getFilterParams(req: QueryParams, options: FilterOptions = {}): FilterParams {
  const { allowedFilters, searchableFields } = options;
  const filters: Record<string, any> = {};
  
  // Process each query parameter
  Object.entries(req).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    
    // Skip pagination and sorting params
    if (['page', 'limit', 'sortBy', 'sortOrder', 'search', 'date_from', 'date_to'].includes(key)) {
      return;
    }
    
    // Check if filter is allowed
    if (allowedFilters && !allowedFilters.includes(key)) {
      return;
    }
    
    // Handle operators: _contains, _gte, _lte, _in
    const operatorMatch = key.match(/^(.+)_((?:contains|gte|lte|in|gt|lt|like))$/);
    
    if (operatorMatch) {
      const [, field, operator] = operatorMatch;
      const processedValue = processValue(value, operator);
      
      switch (operator) {
        case 'contains':
          filters[field] = { ilike: `%${processedValue}%` };
          break;
        case 'gte':
          filters[field] = { ...filters[field], gte: processedValue };
          break;
        case 'lte':
          filters[field] = { ...filters[field], lte: processedValue };
          break;
        case 'gt':
          filters[field] = { ...filters[field], gt: processedValue };
          break;
        case 'lt':
          filters[field] = { ...filters[field], lt: processedValue };
          break;
        case 'like':
          filters[field] = { ilike: `%${processedValue}%` };
          break;
        case 'in':
          filters[field] = { in: Array.isArray(value) ? value : String(value).split(',') };
          break;
      }
    } else {
      // Exact match
      filters[key] = value;
    }
  });
  
  // Handle search (full-text search across searchable fields)
  const search = req.search as string;
  let searchFilter: Record<string, any> | undefined;
  
  if (search && searchableFields) {
    searchFilter = {
      or: searchableFields.map(field => ({ [field]: { ilike: `%${search}%` } }))
    };
  }
  
  // Handle date range
  const dateFrom = req.date_from as string;
  const dateTo = req.date_to as string;
  let dateRange: FilterParams['dateRange'] | undefined;
  
  if (dateFrom || dateTo) {
    dateRange = {
      start: dateFrom ? new Date(dateFrom) : new Date(0),
      end: dateTo ? new Date(dateTo) : new Date()
    };
  }
  
  // Handle status filter (can be single or array)
  let status: string | string[] | undefined;
  if (req.status) {
    status = Array.isArray(req.status) ? req.status as string[] : String(req.status).split(',');
  }
  
  return {
    filters,
    search: searchFilter ? search : undefined,
    dateRange,
    status
  };
}

/**
 * Process value based on operator
 */
function processValue(value: any, operator: string): any {
  if (operator === 'in') {
    return Array.isArray(value) ? value : String(value).split(',');
  }
  
  // Try to parse as number
  if (['gte', 'lte', 'gt', 'lt'].includes(operator)) {
    const num = parseFloat(value);
    return isNaN(num) ? value : num;
  }
  
  return value;
}

/**
 * Build SQL WHERE clause from filters (for PostgreSQL)
 */
export function buildWhereClause(
  filters: Record<string, any>,
  searchFilter?: Record<string, any>,
  dateRange?: FilterParams['dateRange']
): { where: string; params: any[] } {
  const conditions: string[] = [];
  const params: any[] = [];
  let paramIndex = 1;
  
  // Process filters
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null) return;
    
    if (typeof value === 'object') {
      // Handle operators
      if (value.ilike) {
        conditions.push(`LOWER(${key}) LIKE LOWER($${paramIndex})`);
        params.push(value.ilike);
        paramIndex++;
      } else if (value.in) {
        const placeholders = value.in.map(() => `$${paramIndex++}`).join(', ');
        conditions.push(`${key} IN (${placeholders})`);
        params.push(...value.in);
      } else if (value.gte) {
        conditions.push(`${key} >= $${paramIndex++}`);
        params.push(value.gte);
      } else if (value.lte) {
        conditions.push(`${key} <= $${paramIndex++}`);
        params.push(value.lte);
      } else if (value.gt) {
        conditions.push(`${key} > $${paramIndex++}`);
        params.push(value.gt);
      } else if (value.lt) {
        conditions.push(`${key} < $${paramIndex++}`);
        params.push(value.lt);
      }
    } else {
      // Exact match
      conditions.push(`${key} = $${paramIndex++}`);
      params.push(value);
    }
  });
  
  // Handle search filter
  if (searchFilter && searchFilter.or) {
    const searchConditions = searchFilter.or.map((cond: Record<string, any>) => {
      const [key, value] = Object.entries(cond)[0];
      conditions.push(`LOWER(${key}) LIKE LOWER($${paramIndex++})`);
      params.push(value.ilike);
      return key;
    });
  }
  
  // Handle date range
  if (dateRange) {
    if (dateRange.start) {
      conditions.push(`created_at >= $${paramIndex++}`);
      params.push(dateRange.start);
    }
    if (dateRange.end) {
      conditions.push(`created_at <= $${paramIndex++}`);
      params.push(dateRange.end);
    }
  }
  
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  
  return { where, params };
}

/**
 * Build ORDER BY clause from sort params
 */
export function buildOrderByClause(sortBy?: string, sortOrder: 'asc' | 'desc' = 'asc'): string {
  if (!sortBy) return 'ORDER BY created_at DESC';
  
  // Sanitize column name to prevent SQL injection
  const sanitizedColumn = sortBy.replace(/[^a-zA-Z0-9_]/g, '');
  const order = sortOrder === 'desc' ? 'DESC' : 'ASC';
  
  return `ORDER BY ${sanitizedColumn} ${order}`;
}

interface QueryParams {
  [key: string]: string | string[] | number | undefined;
  page?: string | number;
  limit?: string | number;
  sortBy?: string;
  sortOrder?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
  status?: string | string[];
}
