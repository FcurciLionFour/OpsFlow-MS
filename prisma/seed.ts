import {
  CashMovementStatus,
  CashMovementType,
  Prisma,
  PrismaClient,
} from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  ALL_PERMISSIONS,
  PermissionCatalog,
  ROLE_PERMISSIONS_MAP,
  type Permission,
} from '../src/common/rbac';

const prisma = new PrismaClient();

type CanonicalRole = 'ADMIN' | 'MANAGER' | 'OPERATOR';

type DemoBranchBlueprint = {
  code: string;
  name: string;
};

type SeededDemoUser = {
  id: string;
  email: string;
  role: CanonicalRole;
  branchId: string | null;
};

const DEFAULT_ORG_SLUG = (
  process.env.SEED_ORG_SLUG?.trim().toLowerCase() || 'default-org'
).slice(0, 64);
const DEFAULT_ORG_NAME =
  process.env.SEED_ORG_NAME?.trim() || 'Default Organization';
const DEFAULT_BRANCH_CODE = (
  process.env.SEED_BRANCH_CODE?.trim().toUpperCase() || 'MAIN'
).slice(0, 32);
const DEFAULT_BRANCH_NAME =
  process.env.SEED_BRANCH_NAME?.trim() || 'Main Branch';

const DEMO_ORG_SLUG = 'pacific-treasury-demo';
const DEMO_ORG_NAME = 'Demo Pacific Treasury';
const DEMO_HQ_CODE = 'HQ';
const DEMO_HQ_NAME = 'HQ';
const DEMO_NORTH_CODE = 'NORTE';
const DEMO_NORTH_NAME = 'Sucursal Norte';

const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'Demo1234!';
const DEMO_ADMIN_EMAIL = 'demo.admin@pacifictreasury.local';
const DEMO_MANAGER_EMAIL = 'demo.manager@pacifictreasury.local';
const DEMO_OPERATOR_EMAIL = 'demo.operator@pacifictreasury.local';
const DEMO_MANAGER_ORG_EMAIL = 'demo.manager.org@pacifictreasury.local';
const DEMO_EMAIL_DOMAIN = 'pacifictreasury.local';

const DEMO_BRANCH_BLUEPRINTS: DemoBranchBlueprint[] = [
  { code: DEMO_HQ_CODE, name: DEMO_HQ_NAME },
  { code: DEMO_NORTH_CODE, name: DEMO_NORTH_NAME },
  { code: 'SUR', name: 'Sucursal Sur' },
  { code: 'CENTRO', name: 'Sucursal Centro' },
  { code: 'OESTE', name: 'Sucursal Oeste' },
  { code: 'ESTE', name: 'Sucursal Este' },
  { code: 'CORDOBA', name: 'Sucursal Cordoba' },
  { code: 'ROSARIO', name: 'Sucursal Rosario' },
];

const DEMO_BRANCH_COUNT = parseEnvInt(
  'SEED_DEMO_BRANCH_COUNT',
  6,
  2,
  DEMO_BRANCH_BLUEPRINTS.length,
);
const DEMO_OPERATORS_PER_BRANCH = parseEnvInt(
  'SEED_DEMO_OPERATORS_PER_BRANCH',
  3,
  1,
  8,
);
const DEMO_MOVEMENTS_PER_BRANCH = parseEnvInt(
  'SEED_DEMO_MOVEMENTS_PER_BRANCH',
  24,
  4,
  120,
);

const PERMISSION_DESCRIPTIONS: Record<Permission, string> = {
  [PermissionCatalog.BRANCH_READ]: 'Read branches',
  [PermissionCatalog.BRANCH_CREATE]: 'Create branches',
  [PermissionCatalog.BRANCH_UPDATE]: 'Update branches',
  [PermissionCatalog.USER_READ]: 'Read users',
  [PermissionCatalog.USER_CREATE]: 'Create users',
  [PermissionCatalog.USER_UPDATE]: 'Update users',
  [PermissionCatalog.CASH_MOVEMENT_CREATE]: 'Create cash movements',
  [PermissionCatalog.CASH_MOVEMENT_READ]: 'Read cash movements',
  [PermissionCatalog.CASH_MOVEMENT_APPROVE]: 'Approve cash movements',
  [PermissionCatalog.CASH_MOVEMENT_REJECT]: 'Reject cash movements',
  [PermissionCatalog.CASH_MOVEMENT_DELIVER]: 'Deliver cash movements',
  [PermissionCatalog.CASHFLOW_STATS_READ]: 'Read cashflow stats',
};

function parseEnvInt(
  envName: string,
  fallback: number,
  min: number,
  max: number,
): number {
  const rawValue = process.env[envName]?.trim();
  if (!rawValue) {
    return fallback;
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function toEmailToken(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function pushIntoMapList(map: Map<string, string[]>, key: string, value: string) {
  const current = map.get(key);
  if (current) {
    current.push(value);
    return;
  }
  map.set(key, [value]);
}

function pickByIndex(values: string[], index: number, fallback: string): string {
  if (!values.length) {
    return fallback;
  }
  return values[index % values.length];
}

async function main() {
  const organization = await prisma.organization.upsert({
    where: { slug: DEFAULT_ORG_SLUG },
    update: {
      name: DEFAULT_ORG_NAME,
      isActive: true,
    },
    create: {
      name: DEFAULT_ORG_NAME,
      slug: DEFAULT_ORG_SLUG,
      isActive: true,
    },
  });

  const defaultBranch = await prisma.branch.upsert({
    where: {
      organizationId_code: {
        organizationId: organization.id,
        code: DEFAULT_BRANCH_CODE,
      },
    },
    update: {
      name: DEFAULT_BRANCH_NAME,
      isActive: true,
    },
    create: {
      organizationId: organization.id,
      name: DEFAULT_BRANCH_NAME,
      code: DEFAULT_BRANCH_CODE,
      isActive: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator',
    },
  });

  const managerRole = await prisma.role.upsert({
    where: { name: 'MANAGER' },
    update: {},
    create: {
      name: 'MANAGER',
      description: 'Organization manager',
    },
  });

  const operatorRole = await prisma.role.upsert({
    where: { name: 'OPERATOR' },
    update: {},
    create: {
      name: 'OPERATOR',
      description: 'Branch operator',
    },
  });

  // Keep legacy USER role to avoid breaking older integrations.
  const legacyUserRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {
      description: 'Legacy role (mapped as OPERATOR in runtime context)',
    },
    create: {
      name: 'USER',
      description: 'Legacy role (mapped as OPERATOR in runtime context)',
    },
  });

  const permissionsCatalog = ALL_PERMISSIONS.map((key) => ({
    key,
    description: PERMISSION_DESCRIPTIONS[key],
  }));

  const permissionByKey = new Map<string, { id: string }>();
  for (const permission of permissionsCatalog) {
    const savedPermission = await prisma.permission.upsert({
      where: { key: permission.key },
      update: {
        description: permission.description,
      },
      create: {
        key: permission.key,
        description: permission.description,
      },
    });

    permissionByKey.set(permission.key, { id: savedPermission.id });
  }

  const rolePermissionMatrix: Record<string, Permission[]> = {
    ADMIN: [...ROLE_PERMISSIONS_MAP.ADMIN],
    MANAGER: [...ROLE_PERMISSIONS_MAP.MANAGER],
    OPERATOR: [...ROLE_PERMISSIONS_MAP.OPERATOR],
    USER: [...ROLE_PERMISSIONS_MAP.OPERATOR],
  };

  const roleByName = new Map<string, { id: string }>([
    ['ADMIN', { id: adminRole.id }],
    ['MANAGER', { id: managerRole.id }],
    ['OPERATOR', { id: operatorRole.id }],
    ['USER', { id: legacyUserRole.id }],
  ]);

  for (const [roleName, permissionKeys] of Object.entries(
    rolePermissionMatrix,
  )) {
    const role = roleByName.get(roleName);
    if (!role) {
      continue;
    }

    await prisma.rolePermission.deleteMany({
      where: {
        roleId: role.id,
        permission: {
          key: {
            notIn: permissionKeys,
          },
        },
      },
    });

    for (const permissionKey of permissionKeys) {
      const permission = permissionByKey.get(permissionKey);
      if (!permission) {
        continue;
      }

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: role.id,
            permissionId: permission.id,
          },
        },
        update: {},
        create: {
          roleId: role.id,
          permissionId: permission.id,
        },
      });
    }
  }

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Password123!';
  const seedUserEmail = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const seedUserPassword = process.env.SEED_USER_PASSWORD ?? 'Password123!';

  const passwordHashCache = new Map<string, string>();
  const getPasswordHash = async (plainPassword: string): Promise<string> => {
    const cachedHash = passwordHashCache.get(plainPassword);
    if (cachedHash) {
      return cachedHash;
    }

    const hash = await bcrypt.hash(plainPassword, 10);
    passwordHashCache.set(plainPassword, hash);
    return hash;
  };

  const ensureSingleRole = async (
    userId: string,
    roleId: string,
    removeRoleIds: string[],
  ) => {
    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
      update: {},
      create: {
        userId,
        roleId,
      },
    });

    if (!removeRoleIds.length) {
      return;
    }

    await prisma.userRole.deleteMany({
      where: {
        userId,
        roleId: {
          in: removeRoleIds,
        },
      },
    });
  };

  const ensureUserWithRole = async (params: {
    email: string;
    password: string;
    organizationId: string;
    branchId: string | null;
    roleId: string;
    removeRoleIds: string[];
  }) => {
    const passwordHash = await getPasswordHash(params.password);
    const user = await prisma.user.upsert({
      where: { email: params.email },
      update: {
        password: passwordHash,
        isActive: true,
        organizationId: params.organizationId,
        branchId: params.branchId,
      },
      create: {
        email: params.email,
        password: passwordHash,
        isActive: true,
        organizationId: params.organizationId,
        branchId: params.branchId,
      },
    });

    await ensureSingleRole(user.id, params.roleId, params.removeRoleIds);
    return user;
  };

  if (
    seedAdminEmail &&
    seedUserEmail &&
    seedAdminEmail.toLowerCase() === seedUserEmail.toLowerCase()
  ) {
    throw new Error(
      'SEED_ADMIN_EMAIL and SEED_USER_EMAIL must be different values.',
    );
  }

  if (seedAdminEmail) {
    await ensureUserWithRole({
      email: seedAdminEmail,
      password: seedAdminPassword,
      organizationId: organization.id,
      branchId: null,
      roleId: adminRole.id,
      removeRoleIds: [managerRole.id, operatorRole.id, legacyUserRole.id],
    });
    console.log(`Admin test user ensured: ${seedAdminEmail}`);
  }

  if (seedUserEmail) {
    await ensureUserWithRole({
      email: seedUserEmail,
      password: seedUserPassword,
      organizationId: organization.id,
      branchId: defaultBranch.id,
      roleId: operatorRole.id,
      removeRoleIds: [adminRole.id, managerRole.id, legacyUserRole.id],
    });
    console.log(`Operator test user ensured (OPERATOR only): ${seedUserEmail}`);
  }

  if (!seedAdminEmail && !seedUserEmail) {
    console.log(
      'SEED_ADMIN_EMAIL and SEED_USER_EMAIL not set, skipping optional default test users.',
    );
  }

  const demoOrganization = await prisma.organization.upsert({
    where: { slug: DEMO_ORG_SLUG },
    update: {
      name: DEMO_ORG_NAME,
      isActive: true,
    },
    create: {
      name: DEMO_ORG_NAME,
      slug: DEMO_ORG_SLUG,
      isActive: true,
    },
  });

  const selectedDemoBranchBlueprints = DEMO_BRANCH_BLUEPRINTS.slice(
    0,
    DEMO_BRANCH_COUNT,
  );
  const demoBranches: Array<{ id: string; code: string; name: string }> = [];
  for (const branchBlueprint of selectedDemoBranchBlueprints) {
    const branch = await prisma.branch.upsert({
      where: {
        organizationId_code: {
          organizationId: demoOrganization.id,
          code: branchBlueprint.code,
        },
      },
      update: {
        name: branchBlueprint.name,
        isActive: true,
      },
      create: {
        organizationId: demoOrganization.id,
        name: branchBlueprint.name,
        code: branchBlueprint.code,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
    });

    demoBranches.push(branch);
  }

  const branchByCode = new Map<string, { id: string; code: string; name: string }>(
    demoBranches.map((branch) => [branch.code, branch]),
  );
  const hqBranch = branchByCode.get(DEMO_HQ_CODE) ?? demoBranches[0];
  if (!hqBranch) {
    throw new Error('Demo branch seed could not resolve any branch.');
  }

  const roleIdByCanonical: Record<CanonicalRole, string> = {
    ADMIN: adminRole.id,
    MANAGER: managerRole.id,
    OPERATOR: operatorRole.id,
  };
  const allRoleIds = [
    adminRole.id,
    managerRole.id,
    operatorRole.id,
    legacyUserRole.id,
  ];

  const demoUsersByEmail = new Map<string, SeededDemoUser>();
  const ensureDemoUser = async (params: {
    email: string;
    role: CanonicalRole;
    branchId: string | null;
  }) => {
    const roleId = roleIdByCanonical[params.role];
    const removeRoleIds = allRoleIds.filter((id) => id !== roleId);
    const user = await ensureUserWithRole({
      email: params.email,
      password: DEMO_PASSWORD,
      organizationId: demoOrganization.id,
      branchId: params.branchId,
      roleId,
      removeRoleIds,
    });

    demoUsersByEmail.set(params.email, {
      id: user.id,
      email: params.email,
      role: params.role,
      branchId: params.branchId,
    });
  };

  await ensureDemoUser({
    email: DEMO_ADMIN_EMAIL,
    role: 'ADMIN',
    branchId: null,
  });
  await ensureDemoUser({
    email: DEMO_MANAGER_EMAIL,
    role: 'MANAGER',
    branchId: hqBranch.id,
  });
  await ensureDemoUser({
    email: DEMO_OPERATOR_EMAIL,
    role: 'OPERATOR',
    branchId: hqBranch.id,
  });
  await ensureDemoUser({
    email: DEMO_MANAGER_ORG_EMAIL,
    role: 'MANAGER',
    branchId: null,
  });

  for (const branch of demoBranches) {
    const branchToken = toEmailToken(branch.code);
    await ensureDemoUser({
      email: `demo.manager.${branchToken}@${DEMO_EMAIL_DOMAIN}`,
      role: 'MANAGER',
      branchId: branch.id,
    });

    for (let operatorIndex = 1; operatorIndex <= DEMO_OPERATORS_PER_BRANCH; operatorIndex += 1) {
      await ensureDemoUser({
        email: `demo.operator.${branchToken}.${operatorIndex}@${DEMO_EMAIL_DOMAIN}`,
        role: 'OPERATOR',
        branchId: branch.id,
      });
    }
  }

  const demoUsers = Array.from(demoUsersByEmail.values());
  if (!demoUsers.length) {
    throw new Error(
      'Demo organization has no active users to assign as cash movement actors.',
    );
  }

  const adminIds = demoUsers
    .filter((user) => user.role === 'ADMIN')
    .map((user) => user.id);
  const orgWideManagerIds = demoUsers
    .filter((user) => user.role === 'MANAGER' && !user.branchId)
    .map((user) => user.id);
  const branchManagerIdsByBranchId = new Map<string, string[]>();
  const operatorIdsByBranchId = new Map<string, string[]>();

  for (const user of demoUsers) {
    if (!user.branchId) {
      continue;
    }

    if (user.role === 'MANAGER') {
      pushIntoMapList(branchManagerIdsByBranchId, user.branchId, user.id);
      continue;
    }

    if (user.role === 'OPERATOR') {
      pushIntoMapList(operatorIdsByBranchId, user.branchId, user.id);
    }
  }

  const fallbackActorId = adminIds[0] ?? demoUsers[0]?.id;
  if (!fallbackActorId) {
    throw new Error('Demo seed could not resolve any fallback actor user.');
  }

  const statusPattern: CashMovementStatus[] = [
    CashMovementStatus.PENDING,
    CashMovementStatus.APPROVED,
    CashMovementStatus.DELIVERED,
    CashMovementStatus.REJECTED,
    CashMovementStatus.DELIVERED,
    CashMovementStatus.APPROVED,
    CashMovementStatus.PENDING,
    CashMovementStatus.DELIVERED,
  ];

  const demoMovements: Prisma.CashMovementCreateManyInput[] = [];
  const now = new Date();
  for (const [branchIndex, branch] of demoBranches.entries()) {
    const branchManagers = [
      ...(branchManagerIdsByBranchId.get(branch.id) ?? []),
      ...orgWideManagerIds,
      ...adminIds,
    ];
    const branchOperators = operatorIdsByBranchId.get(branch.id) ?? [];
    const creatorPool = branchOperators.length ? branchOperators : branchManagers;
    const approvalPool = branchManagers.length ? branchManagers : [fallbackActorId];

    for (
      let movementIndex = 0;
      movementIndex < DEMO_MOVEMENTS_PER_BRANCH;
      movementIndex += 1
    ) {
      const status =
        statusPattern[(branchIndex + movementIndex) % statusPattern.length];
      const type =
        (branchIndex + movementIndex) % 2 === 0
          ? CashMovementType.IN
          : CashMovementType.OUT;
      const daysAgo = (branchIndex * 3 + movementIndex) % 30;

      const createdAt = new Date(now);
      createdAt.setUTCDate(now.getUTCDate() - daysAgo);
      createdAt.setUTCHours(
        8 + ((branchIndex + movementIndex) % 10),
        (branchIndex * 13 + movementIndex * 7) % 60,
        0,
        0,
      );
      const updatedAt = new Date(createdAt.getTime() + 45 * 60 * 1000);

      const amountNumber =
        1200 +
        branchIndex * 350 +
        movementIndex * 97 +
        ((branchIndex + movementIndex) % 5) * 25;

      const createdById = pickByIndex(
        creatorPool,
        movementIndex,
        fallbackActorId,
      );
      const approvedById =
        status === CashMovementStatus.APPROVED ||
        status === CashMovementStatus.DELIVERED
          ? pickByIndex(approvalPool, movementIndex, fallbackActorId)
          : null;
      const deliveredById =
        status === CashMovementStatus.DELIVERED
          ? pickByIndex(approvalPool, movementIndex + 1, fallbackActorId)
          : null;

      const code = `${branch.code}-${String(movementIndex + 1).padStart(3, '0')}`;
      demoMovements.push({
        organizationId: demoOrganization.id,
        branchId: branch.id,
        amount: amountNumber.toFixed(2),
        currency: 'ARS',
        type,
        status,
        description: `[DEMO-CM:${code}] seeded movement`,
        createdById,
        approvedById,
        deliveredById,
        createdAt,
        updatedAt,
      });
    }
  }

  await prisma.cashMovement.deleteMany({
    where: {
      organizationId: demoOrganization.id,
      description: {
        startsWith: '[DEMO-CM:',
      },
    },
  });

  if (demoMovements.length) {
    await prisma.cashMovement.createMany({
      data: demoMovements,
    });
  }

  const demoBranchCodes = demoBranches.map((branch) => branch.code).join(', ');
  console.log(
    `Tenant seed ready: org=${organization.slug} branch=${defaultBranch.code}`,
  );
  console.log(
    `Demo seed ready: org=${demoOrganization.slug} branches=[${demoBranchCodes}] users=${demoUsers.length} movements=${demoMovements.length}`,
  );
  console.log(
    `Demo seed config: branchCount=${DEMO_BRANCH_COUNT} operatorsPerBranch=${DEMO_OPERATORS_PER_BRANCH} movementsPerBranch=${DEMO_MOVEMENTS_PER_BRANCH}`,
  );
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
