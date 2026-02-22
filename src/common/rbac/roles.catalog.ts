export const RoleCatalog = {
  ADMIN: 'ADMIN',
  MANAGER: 'MANAGER',
  OPERATOR: 'OPERATOR',
} as const;

export type CanonicalRole = (typeof RoleCatalog)[keyof typeof RoleCatalog];
export type SupportedRole = CanonicalRole | 'USER';

const LEGACY_ROLE_ALIASES: Readonly<Record<string, CanonicalRole>> = {
  USER: RoleCatalog.OPERATOR,
};

const CANONICAL_ROLES = new Set<string>(Object.values(RoleCatalog));

export function toCanonicalRole(role: string): CanonicalRole | null {
  if (CANONICAL_ROLES.has(role)) {
    return role as CanonicalRole;
  }

  return LEGACY_ROLE_ALIASES[role] ?? null;
}
