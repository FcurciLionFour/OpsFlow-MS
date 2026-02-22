import { UsersController } from './users.controller';
import { PermissionCatalog } from 'src/common/rbac';

describe('UsersController', () => {
  const usersServiceMock: { findAll: jest.Mock } = {
    findAll: jest.fn(),
  };

  const controller = new UsersController(usersServiceMock as never);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates findAll to service', async () => {
    usersServiceMock.findAll.mockResolvedValue([
      {
        id: '1',
        organizationId: 'org-1',
        branchId: null,
        role: 'OPERATOR',
        email: 'a@a.com',
        roles: ['OPERATOR'],
      },
    ]);

    const currentUser = {
      sub: 'u1',
      id: 'u1',
      organizationId: 'org-1',
      role: 'ADMIN' as const,
      branchId: null,
      roles: ['ADMIN'],
      permissions: [PermissionCatalog.USER_READ],
    };

    const result = await controller.findAll(currentUser);

    expect(usersServiceMock.findAll).toHaveBeenCalledWith(currentUser);
    expect(result).toHaveLength(1);
  });
});
