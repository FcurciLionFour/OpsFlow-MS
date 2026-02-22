import { CashMovementStatus } from '@prisma/client';

const VALID_TRANSITIONS: Readonly<
  Record<CashMovementStatus, ReadonlyArray<CashMovementStatus>>
> = {
  [CashMovementStatus.PENDING]: [
    CashMovementStatus.APPROVED,
    CashMovementStatus.REJECTED,
  ],
  [CashMovementStatus.APPROVED]: [CashMovementStatus.DELIVERED],
  [CashMovementStatus.REJECTED]: [],
  [CashMovementStatus.DELIVERED]: [],
};

export function isValidCashMovementTransition(
  from: CashMovementStatus,
  to: CashMovementStatus,
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}
