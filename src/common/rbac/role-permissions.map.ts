import {
  ALL_PERMISSIONS,
  PermissionCatalog,
  type Permission,
} from './permissions.catalog';
import { RoleCatalog, type CanonicalRole } from './roles.catalog';

export const ROLE_PERMISSIONS_MAP: Record<
  CanonicalRole,
  readonly Permission[]
> = {
  [RoleCatalog.ADMIN]: ALL_PERMISSIONS,
  [RoleCatalog.MANAGER]: [
    PermissionCatalog.BRANCH_READ,
    PermissionCatalog.USER_READ,
    PermissionCatalog.CASH_MOVEMENT_CREATE,
    PermissionCatalog.CASH_MOVEMENT_READ,
    PermissionCatalog.CASH_MOVEMENT_APPROVE,
    PermissionCatalog.CASH_MOVEMENT_REJECT,
    PermissionCatalog.CASH_MOVEMENT_DELIVER,
    PermissionCatalog.CASHFLOW_STATS_READ,
  ],
  [RoleCatalog.OPERATOR]: [
    PermissionCatalog.CASH_MOVEMENT_CREATE,
    PermissionCatalog.CASH_MOVEMENT_READ,
    PermissionCatalog.CASHFLOW_STATS_READ,
  ],
};
