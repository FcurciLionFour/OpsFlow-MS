import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UserResponseDto } from './dto/user-response.dto';
import { PermissionsGuard } from 'src/auth/guards/permissions.guard';
import { RequirePermissions } from 'src/auth/decorators/permissions.decorator';
import { CurrentUser } from 'src/auth/decorators/current-user.decorator';
import { JwtGlobalGuard } from 'src/auth/guards/jwt-global.guard';
import { Roles } from 'src/auth/decorators/roles.decorator';
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

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtGlobalGuard, PermissionsGuard)
export class UsersController {
  constructor(private usersService: UsersService) {}

  @RequirePermissions('users.read')
  @Roles('ADMIN')
  @Get()
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'List users (requires users.read)' })
  @ApiOkResponse({ description: 'Users list' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  findAll(): Promise<UserResponseDto[]> {
    return this.usersService.findAll();
  }

  @Get('me')
  @ApiOperation({ summary: 'Get authenticated user identity' })
  @ApiOkResponse({ description: 'Current user identity' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentUser() user: { sub: string }) {
    return this.usersService.findById(user.sub, user.sub);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Get one user by id' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'User by id' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  findOne(
    @Param('id') id: string,
    @CurrentUser() user: { sub: string },
  ): Promise<UserResponseDto | null> {
    return this.usersService.findById(id, user.sub);
  }

  @RequirePermissions('users.write')
  @Post()
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Create user (requires users.write)' })
  @ApiBody({ type: CreateUserDto })
  @ApiOkResponse({ description: 'User created' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  create(@Body() body: CreateUserDto) {
    return this.usersService.create(body);
  }

  @RequirePermissions('users.write')
  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Update user by id (requires users.write)' })
  @ApiParam({ name: 'id', type: String })
  @ApiBody({ type: UpdateUserDto })
  @ApiOkResponse({ description: 'User updated' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser() user: { sub: string },
  ) {
    return this.usersService.update(id, body, user.sub);
  }

  @RequirePermissions('users.write')
  @Delete(':id')
  @UseGuards(PermissionsGuard)
  @ApiOperation({ summary: 'Delete user by id (requires users.write)' })
  @ApiParam({ name: 'id', type: String })
  @ApiOkResponse({ description: 'User deleted' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  remove(@Param('id') id: string, @CurrentUser() user: { sub: string }) {
    return this.usersService.remove(id, user.sub);
  }
}
