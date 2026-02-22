import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from 'src/common/dto/error-response.dto';
import { PermissionCatalog } from 'src/common/rbac';
import { CashflowService } from './cashflow.service';
import { CashflowStatsQueryDto } from './dto/cashflow-stats-query.dto';
import { CashflowStatsResponseDto } from './dto/cashflow-stats-response.dto';

@ApiTags('Cashflow')
@ApiBearerAuth()
@Controller('cashflow')
@UseGuards(PermissionsGuard)
export class CashflowController {
  constructor(private readonly cashflowService: CashflowService) {}

  @RequirePermissions(PermissionCatalog.CASHFLOW_STATS_READ)
  @Get('stats')
  @ApiOperation({
    summary: 'Cashflow dashboard stats',
    description:
      'Returns totals and workflow status counts scoped by tenant and branch access rules. Default range is last 30 days when from/to are omitted.',
  })
  @ApiOkResponse({ type: CashflowStatsResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ValidationErrorResponseDto })
  getStats(
    @Query() query: CashflowStatsQueryDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.cashflowService.getStats(query, currentUser);
  }
}
