import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.role.upsert({
    where: { name: 'ADMIN' },
    update: {},
    create: {
      name: 'ADMIN',
      description: 'Administrator',
    },
  });

  const userRole = await prisma.role.upsert({
    where: { name: 'USER' },
    update: {},
    create: {
      name: 'USER',
      description: 'Regular user',
    },
  });

  const usersRead = await prisma.permission.upsert({
    where: { key: 'users.read' },
    update: {},
    create: {
      key: 'users.read',
      description: 'Read users',
    },
  });

  const usersWrite = await prisma.permission.upsert({
    where: { key: 'users.write' },
    update: {},
    create: {
      key: 'users.write',
      description: 'Write users',
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: usersRead.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: usersRead.id,
    },
  });

  await prisma.rolePermission.upsert({
    where: {
      roleId_permissionId: {
        roleId: adminRole.id,
        permissionId: usersWrite.id,
      },
    },
    update: {},
    create: {
      roleId: adminRole.id,
      permissionId: usersWrite.id,
    },
  });

  // Keep USER role with least privilege by default.
  await prisma.rolePermission.deleteMany({
    where: {
      roleId: userRole.id,
      permissionId: usersRead.id,
    },
  });

  const seedAdminEmail = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const seedAdminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Password123!';
  const seedUserEmail = process.env.SEED_USER_EMAIL?.trim().toLowerCase();
  const seedUserPassword = process.env.SEED_USER_PASSWORD ?? 'Password123!';

  if (!seedAdminEmail && !seedUserEmail) {
    console.log(
      'SEED_ADMIN_EMAIL and SEED_USER_EMAIL not set, skipping test user creation.',
    );
    return;
  }

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
    const adminPasswordHash = await bcrypt.hash(seedAdminPassword, 10);
    const adminUser = await prisma.user.upsert({
      where: { email: seedAdminEmail },
      update: {
        password: adminPasswordHash,
        isActive: true,
      },
      create: {
        email: seedAdminEmail,
        password: adminPasswordHash,
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: adminUser.id,
          roleId: adminRole.id,
        },
      },
      update: {},
      create: {
        userId: adminUser.id,
        roleId: adminRole.id,
      },
    });

    console.log(`Admin test user ensured: ${seedAdminEmail}`);
  }

  if (seedUserEmail) {
    const userPasswordHash = await bcrypt.hash(seedUserPassword, 10);
    const basicUser = await prisma.user.upsert({
      where: { email: seedUserEmail },
      update: {
        password: userPasswordHash,
        isActive: true,
      },
      create: {
        email: seedUserEmail,
        password: userPasswordHash,
        isActive: true,
      },
    });

    await prisma.userRole.upsert({
      where: {
        userId_roleId: {
          userId: basicUser.id,
          roleId: userRole.id,
        },
      },
      update: {},
      create: {
        userId: basicUser.id,
        roleId: userRole.id,
      },
    });

    await prisma.userRole.deleteMany({
      where: {
        userId: basicUser.id,
        roleId: {
          not: userRole.id,
        },
      },
    });

    console.log(`User test user ensured (USER only): ${seedUserEmail}`);
  }
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
