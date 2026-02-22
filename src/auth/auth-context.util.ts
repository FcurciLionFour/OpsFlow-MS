export const RUNTIME_ROLE_PRECEDENCE = [
  'ADMIN',
  'MANAGER',
  'OPERATOR',
  'USER',
] as const;

export type RuntimeRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

export interface AuthenticatedUserContext {
  sub: string;
  id: string;
  sid?: string;
  organizationId: string;
  role: RuntimeRole;
  branchId: string | null;
  roles: string[];
  permissions: string[];
}

export function resolveRuntimeRole(roleNames: string[]): RuntimeRole {
  for (const roleName of RUNTIME_ROLE_PRECEDENCE) {
    if (!roleNames.includes(roleName)) {
      continue;
    }

    if (roleName === 'USER') {
      return 'OPERATOR';
    }

    return roleName;
  }

  return 'OPERATOR';
}

export function uniqueStrings(values: string[]): string[] {
  return [...new Set(values)];
}
