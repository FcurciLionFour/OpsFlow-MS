import { BranchesController } from './branches.controller';
import { PermissionCatalog } from 'src/common/rbac';

describe('BranchesController', () => {
  const branchesServiceMock = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  const controller = new BranchesController(branchesServiceMock as never);

  const currentUser = {
    sub: 'u1',
    id: 'u1',
    organizationId: 'org-1',
    role: 'ADMIN' as const,
    branchId: null,
    roles: ['ADMIN'],
    permissions: [
      PermissionCatalog.BRANCH_READ,
      PermissionCatalog.BRANCH_CREATE,
      PermissionCatalog.BRANCH_UPDATE,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates findAll', async () => {
    branchesServiceMock.findAll.mockResolvedValue([]);

    await controller.findAll(currentUser, {});

    expect(branchesServiceMock.findAll).toHaveBeenCalledWith(currentUser, {});
  });

  it('delegates findOne', async () => {
    branchesServiceMock.findOne.mockResolvedValue({ id: 'b1' });

    await controller.findOne('b1', currentUser);

    expect(branchesServiceMock.findOne).toHaveBeenCalledWith('b1', currentUser);
  });

  it('delegates create', async () => {
    branchesServiceMock.create.mockResolvedValue({ id: 'b1' });

    await controller.create({ name: 'Main', code: 'MAIN' }, currentUser);

    expect(branchesServiceMock.create).toHaveBeenCalledWith(
      { name: 'Main', code: 'MAIN' },
      currentUser,
    );
  });

  it('delegates update', async () => {
    branchesServiceMock.update.mockResolvedValue({ id: 'b1' });

    await controller.update('b1', { name: 'Changed' }, currentUser);

    expect(branchesServiceMock.update).toHaveBeenCalledWith(
      'b1',
      { name: 'Changed' },
      currentUser,
    );
  });
});
