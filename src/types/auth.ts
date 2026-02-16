export type UserRole = 'staff' | 'manager' | 'owner' | 'admin' | 'platform-admin';
export type CompanyRole = 'super_admin' | 'admin' | 'manager' | 'viewer';

export interface AuthUser {
  id: string;
  restaurantId: string;
  companyId?: string;
  name: string;
  email?: string | null;
  role: UserRole;
  companyRole?: CompanyRole;
  permissions: string[];
  companyPermissions?: string[];
}

export interface AccessTokenPayload {
  sub: string; // user id
  restaurantId: string;
  companyId?: string;
  sid?: string; // session id (optional)
  iat?: number;
  exp?: number;
}

