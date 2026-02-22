export const PermissionCatalog = {
  BRANCH_READ: 'BRANCH_READ',
  BRANCH_CREATE: 'BRANCH_CREATE',
  BRANCH_UPDATE: 'BRANCH_UPDATE',
  USER_READ: 'USER_READ',
  USER_CREATE: 'USER_CREATE',
  USER_UPDATE: 'USER_UPDATE',
  CASH_MOVEMENT_CREATE: 'CASH_MOVEMENT_CREATE',
  CASH_MOVEMENT_READ: 'CASH_MOVEMENT_READ',
  CASH_MOVEMENT_APPROVE: 'CASH_MOVEMENT_APPROVE',
  CASH_MOVEMENT_REJECT: 'CASH_MOVEMENT_REJECT',
  CASH_MOVEMENT_DELIVER: 'CASH_MOVEMENT_DELIVER',
  CASHFLOW_STATS_READ: 'CASHFLOW_STATS_READ',
} as const;

export type Permission =
  (typeof PermissionCatalog)[keyof typeof PermissionCatalog];

export const ALL_PERMISSIONS: readonly Permission[] = [
  PermissionCatalog.BRANCH_READ,
  PermissionCatalog.BRANCH_CREATE,
  PermissionCatalog.BRANCH_UPDATE,
  PermissionCatalog.USER_READ,
  PermissionCatalog.USER_CREATE,
  PermissionCatalog.USER_UPDATE,
  PermissionCatalog.CASH_MOVEMENT_CREATE,
  PermissionCatalog.CASH_MOVEMENT_READ,
  PermissionCatalog.CASH_MOVEMENT_APPROVE,
  PermissionCatalog.CASH_MOVEMENT_REJECT,
  PermissionCatalog.CASH_MOVEMENT_DELIVER,
  PermissionCatalog.CASHFLOW_STATS_READ,
];
