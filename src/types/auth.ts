export type UserRole = 'staff' | 'manager' | 'owner' | 'admin' | 'platform-admin';

export interface AuthUser {
  id: string;
  restaurantId: string;
  name: string;
  email?: string | null;
  role: UserRole;
  permissions: string[];
}

export interface AccessTokenPayload {
  sub: string; // user id
  restaurantId: string;
  sid?: string; // session id (optional)
  iat?: number;
  exp?: number;
}

