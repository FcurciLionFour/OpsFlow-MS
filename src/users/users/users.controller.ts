import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtGlobalGuard } from 'src/auth/guards/jwt-global.guard';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from 'src/common/dto/error-response.dto';
import { PermissionCatalog } from 'src/common/rbac';
import type { AuthenticatedUserContext } from 'src/auth/auth-context.util';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtGlobalGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @RequirePermissions(PermissionCatalog.USER_READ)
  @Get()
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'List users in requester organization' })
  @ApiOkResponse({ description: 'Users list' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  findAll(
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<UserResponseDto[]> {
    return this.usersService.findAll(currentUser);
  }

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user identity' })
  @ApiOkResponse({ description: 'Current user identity' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentUser() currentUser: AuthenticatedUserContext) {
    return this.usersService.findById(currentUser.id, currentUser);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Get one user by id in requester scope' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'User by id' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ): Promise<UserResponseDto> {
    return this.usersService.findById(id, currentUser);
  }

  @RequirePermissions(PermissionCatalog.USER_CREATE)
  @Post()
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Create user in requester organization' })
  @ApiBody({ type: CreateUserDto })
  @ApiOkResponse({ description: 'User created' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  create(
    @Body() body: CreateUserDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.usersService.create(body, currentUser);
  }

  @RequirePermissions(PermissionCatalog.USER_UPDATE)
  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Update user by id in requester organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'User updated' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.usersService.update(id, body, currentUser);
  }

  @RequirePermissions(PermissionCatalog.USER_UPDATE)
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Soft-delete user by id in requester organization' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'User deleted' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUserContext,
  ) {
    return this.usersService.remove(id, currentUser);
  }
}
