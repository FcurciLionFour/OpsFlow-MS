import { type Permission } from './permissions.catalog';
import { ROLE_PERMISSIONS_MAP } from './role-permissions.map';
import { toCanonicalRole } from './roles.catalog';

export function getPermissionsForRole(role: string): Permission[] {
  const canonicalRole = toCanonicalRole(role);
  if (!canonicalRole) {
    return [];
  }

  return [...ROLE_PERMISSIONS_MAP[canonicalRole]];
}

export function hasPermissions(
  userPerms: readonly string[],
  requiredPerms: readonly string[],
): boolean {
  if (requiredPerms.length === 0) {
    return true;
  }

  const userPermissionSet = new Set(userPerms);
  return requiredPerms.every((permission) => userPermissionSet.has(permission));
}
