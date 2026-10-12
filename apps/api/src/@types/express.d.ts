export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  tenantId: string | null;
  roleId: number;
  role: string;
  isSuperAdmin: boolean;
}

export interface TenantContext {
  id: string;
  name: string;
  slug: string;
}

declare global {
  namespace Express {
    interface User extends AuthUser {}
    interface Request {
      user?: AuthUser;
      tenant?: TenantContext;
    }
  }
}
