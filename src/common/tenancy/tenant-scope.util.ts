import { NotFoundException } from '@nestjs/common';
import { ErrorCodes } from 'src/common/errors/error-codes';

export function assertOrganizationAccess(
  resourceOrganizationId: string,
  organizationId: string,
): void {
  if (resourceOrganizationId === organizationId) {
    return;
  }

  throw new NotFoundException({
    code: ErrorCodes.RESOURCE_NOT_FOUND,
    message: 'Resource not found',
  });
}
