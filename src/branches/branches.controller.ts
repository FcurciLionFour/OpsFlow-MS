import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { Roles } from 'src/auth/decorators/roles.decorator';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';
import { PermissionCatalog } from 'src/common/rbac';
import { BranchesService } from './branches.service';
import { BranchResponseDto } from './dto/branch-response.dto';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { QueryBranchesDto } from './dto/query-branches.dto';

@ApiTags('Branches')
@ApiBearerAuth()
@Controller('branches')
@UseGuards(PermissionsGuard)
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @RequirePermissions(PermissionCatalog.BRANCH_READ)
  @Get()
  @ApiOperation({ summary: 'List branches in current organization' })
  @ApiOkResponse({ type: BranchResponseDto, isArray: true })
  findAll(
    @CurrentUser() currentUser: AuthenticatedUserContext,
    @Query() query: QueryBranchesDto,
  ) {
    return this.branchesService.findAll(currentUser, query);
  }

  @RequirePermissions(PermissionCatalog.BRANCH_READ)
  @Get(':id')
  @ApiOperation({ summary: 'Get one branch in current organization' })
  @ApiOkResponse({ type: BranchResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.branchesService.findOne(id, currentUser);
  }

  @RequirePermissions(PermissionCatalog.BRANCH_CREATE)
  @Roles('ADMIN')
  @Post()
  @ApiOperation({ summary: 'Create branch in current organization' })
  @ApiOkResponse({ type: BranchResponseDto })
  create(
    @Body() dto: CreateBranchDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.branchesService.create(dto, currentUser);
  }

  @RequirePermissions(PermissionCatalog.BRANCH_UPDATE)
  @Patch(':id')
  @ApiOperation({ summary: 'Update branch in current organization' })
  @ApiOkResponse({ type: BranchResponseDto })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateBranchDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.branchesService.update(id, dto, currentUser);
  }
}
