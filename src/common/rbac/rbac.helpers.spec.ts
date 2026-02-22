import { ALL_PERMISSIONS, PermissionCatalog } from './permissions.catalog';
import { getPermissionsForRole, hasPermissions } from './rbac.helpers';

describe('RBAC helpers', () => {
  it('returns all permissions for ADMIN', () => {
    expect(getPermissionsForRole('ADMIN')).toEqual(ALL_PERMISSIONS);
  });

  it('returns manager permissions with read + cash actions + stats', () => {
    const managerPermissions = getPermissionsForRole('MANAGER');

    expect(managerPermissions).toEqual(
      expect.arrayContaining([
        PermissionCatalog.BRANCH_READ,
        PermissionCatalog.USER_READ,
        PermissionCatalog.CASH_MOVEMENT_CREATE,
        PermissionCatalog.CASH_MOVEMENT_READ,
        PermissionCatalog.CASH_MOVEMENT_APPROVE,
        PermissionCatalog.CASH_MOVEMENT_REJECT,
        PermissionCatalog.CASH_MOVEMENT_DELIVER,
        PermissionCatalog.CASHFLOW_STATS_READ,
      ]),
    );

    expect(managerPermissions).not.toContain(PermissionCatalog.BRANCH_CREATE);
    expect(managerPermissions).not.toContain(PermissionCatalog.USER_CREATE);
  });

  it('returns operator permissions for cash create/read and stats', () => {
    expect(getPermissionsForRole('OPERATOR')).toEqual([
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
      PermissionCatalog.CASHFLOW_STATS_READ,
    ]);
  });

  it('maps legacy USER role to OPERATOR permissions', () => {
    expect(getPermissionsForRole('USER')).toEqual(
      getPermissionsForRole('OPERATOR'),
    );
  });

  it('returns empty permissions for unknown roles', () => {
    expect(getPermissionsForRole('UNKNOWN_ROLE')).toEqual([]);
  });

  it('hasPermissions returns true when all required permissions are present', () => {
    const userPermissions = [
      PermissionCatalog.BRANCH_READ,
      PermissionCatalog.CASH_MOVEMENT_CREATE,
    ];

    expect(
      hasPermissions(userPermissions, [
        PermissionCatalog.BRANCH_READ,
        PermissionCatalog.CASH_MOVEMENT_CREATE,
      ]),
    ).toBe(true);
  });

  it('hasPermissions returns false when one required permission is missing', () => {
    expect(
      hasPermissions(
        [PermissionCatalog.CASH_MOVEMENT_READ],
        [PermissionCatalog.CASH_MOVEMENT_READ, PermissionCatalog.BRANCH_READ],
      ),
    ).toBe(false);
  });

  it('hasPermissions returns true when no permissions are required', () => {
    expect(hasPermissions([PermissionCatalog.BRANCH_READ], [])).toBe(true);
  });
});
