import { ConfigService } from '@nestjs/config';
import { PermissionCatalog } from 'src/common/rbac';
import { JwtStrategy } from './jwt.strategy';
import { PrismaService } from 'src/prisma/prisma.service';

describe('JwtStrategy', () => {
  it('maps payload to enriched request user shape', async () => {
    const config = {
      getOrThrow: jest.fn().mockReturnValue('secret'),
    } as unknown as ConfigService;
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          isActive: true,
          organizationId: 'org-1',
          branchId: 'branch-1',
        }),
      },
      userRole: {
        findMany: jest.fn().mockResolvedValue([
          {
            role: {
              name: 'MANAGER',
              permissions: [
                { permission: { key: PermissionCatalog.CASH_MOVEMENT_READ } },
                { permission: { key: PermissionCatalog.CASH_MOVEMENT_CREATE } },
              ],
            },
          },
        ]),
      },
    } as unknown as PrismaService;

    const strategy = new JwtStrategy(config, prisma);

    await expect(
      strategy.validate({ sub: 'user-1', sid: 'session-1' }),
    ).resolves.toEqual({
      sub: 'user-1',
      id: 'user-1',
      sid: 'session-1',
      organizationId: 'org-1',
      branchId: 'branch-1',
      role: 'MANAGER',
      roles: ['MANAGER'],
      permissions: [
        PermissionCatalog.CASH_MOVEMENT_READ,
        PermissionCatalog.CASH_MOVEMENT_CREATE,
      ],
    });
  });
});
