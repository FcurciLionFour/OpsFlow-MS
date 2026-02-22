import { PermissionCatalog } from 'src/common/rbac';
import { CashflowController } from './cashflow.controller';

describe('CashflowController', () => {
  const cashflowServiceMock = {
    getStats: jest.fn(),
  };

  const controller = new CashflowController(cashflowServiceMock as never);

  const currentUser = {
    sub: 'u1',
    id: 'u1',
    organizationId: 'org-1',
    role: 'MANAGER' as const,
    branchId: 'branch-1',
    roles: ['MANAGER'],
    permissions: [PermissionCatalog.CASHFLOW_STATS_READ],
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delegates getStats', async () => {
    cashflowServiceMock.getStats.mockResolvedValue({ ok: true });

    await controller.getStats({ branchId: 'branch-1' }, currentUser);

    expect(cashflowServiceMock.getStats).toHaveBeenCalledWith(
      { branchId: 'branch-1' },
      currentUser,
    );
  });
});
