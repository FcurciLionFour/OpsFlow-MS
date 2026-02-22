import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from 'src/common/dto/error-response.dto';
import { PermissionCatalog } from 'src/common/rbac';
import { CashMovementsService } from './cash-movements.service';
import { CreateCashMovementDto } from './dto/create-cash-movement.dto';
import {
  CashMovementResponseDto,
  CashMovementsListResponseDto,
} from './dto/cash-movement-response.dto';
import { ListCashMovementsDto } from './dto/list-cash-movements.dto';

@ApiTags('CashMovements')
@ApiBearerAuth()
@Controller('cash-movements')
@UseGuards(PermissionsGuard)
export class CashMovementsController {
  constructor(private readonly cashMovementsService: CashMovementsService) {}

  @RequirePermissions(PermissionCatalog.CASH_MOVEMENT_CREATE)
  @Post()
  @ApiOperation({
    summary: 'Create cash movement',
    description:
      'Creates a movement in the authenticated tenant. OPERATOR branch is always inferred from session scope.',
  })
  @ApiCreatedResponse({ type: CashMovementResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ValidationErrorResponseDto })
  create(
    @Body() dto: CreateCashMovementDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.cashMovementsService.create(dto, currentUser);
  }

  @RequirePermissions(PermissionCatalog.CASH_MOVEMENT_READ)
  @Get()
  @ApiOperation({
    summary: 'List cash movements',
    description:
      'Tenant-scoped listing with pagination and optional filters by branch, status, and date range.',
  })
  @ApiOkResponse({ type: CashMovementsListResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnprocessableEntityResponse({ type: ValidationErrorResponseDto })
  findAll(
    @Query() query: ListCashMovementsDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.cashMovementsService.findAll(query, currentUser);
  }

  @RequirePermissions(PermissionCatalog.CASH_MOVEMENT_APPROVE)
  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a pending cash movement' })
  @ApiOkResponse({ type: CashMovementResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  approve(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.cashMovementsService.approve(id, currentUser);
  }

  @RequirePermissions(PermissionCatalog.CASH_MOVEMENT_REJECT)
  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a pending cash movement' })
  @ApiOkResponse({ type: CashMovementResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  reject(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.cashMovementsService.reject(id, currentUser);
  }

  @RequirePermissions(PermissionCatalog.CASH_MOVEMENT_DELIVER)
  @Post(':id/deliver')
  @ApiOperation({ summary: 'Deliver an approved cash movement' })
  @ApiOkResponse({ type: CashMovementResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  @ApiConflictResponse({ type: ErrorResponseDto })
  deliver(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.cashMovementsService.deliver(id, currentUser);
  }
}
