import { CashMovementStatus } from '@prisma/client';
import { isValidCashMovementTransition } from './cash-movement-transition.validator';

describe('cash movement transition validator', () => {
  it('allows PENDING -> APPROVED and PENDING -> REJECTED', () => {
    expect(
      isValidCashMovementTransition(
        CashMovementStatus.PENDING,
        CashMovementStatus.APPROVED,
      ),
    ).toBe(true);

    expect(
      isValidCashMovementTransition(
        CashMovementStatus.PENDING,
        CashMovementStatus.REJECTED,
      ),
    ).toBe(true);
  });

  it('allows APPROVED -> DELIVERED only', () => {
    expect(
      isValidCashMovementTransition(
        CashMovementStatus.APPROVED,
        CashMovementStatus.DELIVERED,
      ),
    ).toBe(true);
    expect(
      isValidCashMovementTransition(
        CashMovementStatus.APPROVED,
        CashMovementStatus.REJECTED,
      ),
    ).toBe(false);
  });

  it('blocks transitions from terminal statuses', () => {
    expect(
      isValidCashMovementTransition(
        CashMovementStatus.REJECTED,
        CashMovementStatus.APPROVED,
      ),
    ).toBe(false);
    expect(
      isValidCashMovementTransition(
        CashMovementStatus.DELIVERED,
        CashMovementStatus.PENDING,
      ),
    ).toBe(false);
  });
});
