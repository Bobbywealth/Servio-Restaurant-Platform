export type UserRole = 'staff' | 'manager' | 'owner';

export interface AuthUser {
  id: string;
  name: string;
  email?: string | null;
  role: UserRole;
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string; // user id
  sid?: string; // session id (optional)
  iat?: number;
  exp?: number;
}

