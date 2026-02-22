import { CashMovementStatus, CashMovementType } from '@prisma/client';
import { PermissionCatalog } from 'src/common/rbac';
import { CashMovementsController } from './cash-movements.controller';

describe('CashMovementsController', () => {
  const cashMovementsServiceMock = {
    create: jest.fn(),
    findAll: jest.fn(),
    approve: jest.fn(),
    reject: jest.fn(),
    deliver: jest.fn(),
  };

  const controller = new CashMovementsController(
    cashMovementsServiceMock as never,
  );

  const currentUser = {
    sub: 'u1',
    id: 'u1',
    organizationId: 'org-1',
    role: 'MANAGER' as const,
    branchId: null,
    roles: ['MANAGER'],
    permissions: [
      PermissionCatalog.CASH_MOVEMENT_CREATE,
      PermissionCatalog.CASH_MOVEMENT_READ,
      PermissionCatalog.CASH_MOVEMENT_APPROVE,
      PermissionCatalog.CASH_MOVEMENT_REJECT,
      PermissionCatalog.CASH_MOVEMENT_DELIVER,
    ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates create', async () => {
    cashMovementsServiceMock.create.mockResolvedValue({ id: 'cm-1' });

    await controller.create(
      {
        amount: '50.00',
        type: CashMovementType.OUT,
      },
      currentUser,
    );

    expect(cashMovementsServiceMock.create).toHaveBeenCalledWith(
      {
        amount: '50.00',
        type: CashMovementType.OUT,
      },
      currentUser,
    );
  });

  it('delegates findAll', async () => {
    cashMovementsServiceMock.findAll.mockResolvedValue({
      data: [],
      meta: { page: 1, pageSize: 20, total: 0, totalPages: 1 },
    });

    await controller.findAll(
      {
        status: CashMovementStatus.PENDING,
      },
      currentUser,
    );

    expect(cashMovementsServiceMock.findAll).toHaveBeenCalledWith(
      { status: CashMovementStatus.PENDING },
      currentUser,
    );
  });

  it('delegates approve/reject/deliver', async () => {
    cashMovementsServiceMock.approve.mockResolvedValue({ id: 'cm-1' });
    cashMovementsServiceMock.reject.mockResolvedValue({ id: 'cm-1' });
    cashMovementsServiceMock.deliver.mockResolvedValue({ id: 'cm-1' });

    await controller.approve('cm-1', currentUser);
    await controller.reject('cm-1', currentUser);
    await controller.deliver('cm-1', currentUser);

    expect(cashMovementsServiceMock.approve).toHaveBeenCalledWith(
      'cm-1',
      currentUser,
    );
    expect(cashMovementsServiceMock.reject).toHaveBeenCalledWith(
      'cm-1',
      currentUser,
    );
    expect(cashMovementsServiceMock.deliver).toHaveBeenCalledWith(
      'cm-1',
      currentUser,
    );
  });
});
