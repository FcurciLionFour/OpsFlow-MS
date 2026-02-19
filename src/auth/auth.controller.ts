import {
  Controller,
  Post,
  Body,
  Req,
  Res,
  UseGuards,
  Get,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';

import type { Request, Response, CookieOptions } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './decorators/public.decorator';
import { RegisterDto } from './dto/register.dto';
import { randomUUID } from 'crypto';
import { CsrfGuard } from './guards/csrf.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { ConfigService } from '@nestjs/config';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { RateLimit } from 'src/common/decorators/rate-limit.decorator';
import { RateLimitGuard } from 'src/common/guards/rate-limit.guard';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
  ApiNoContentResponse,
} from '@nestjs/swagger';
import { AccessTokenResponseDto, OkResponseDto } from './dto/auth-response.dto';
import {
  ErrorResponseDto,
  ValidationErrorResponseDto,
} from 'src/common/dto/error-response.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  private getRefreshCookieOptions(): CookieOptions {
    const sameSite =
      this.config.get<'lax' | 'strict' | 'none'>('cookies.sameSite') ?? 'lax';
    const secure = this.config.get<boolean>('cookies.secure') ?? false;
    const maxAge =
      this.config.get<number>('cookies.refreshMaxAgeMs') ??
      7 * 24 * 60 * 60 * 1000;

    return {
      httpOnly: true,
      sameSite,
      secure,
      path: '/',
      maxAge,
    };
  }

  private getCsrfCookieOptions(): CookieOptions {
    const sameSite =
      this.config.get<'lax' | 'strict' | 'none'>('cookies.sameSite') ?? 'lax';
    const secure = this.config.get<boolean>('cookies.secure') ?? false;
    const maxAge = this.config.get<number>('cookies.csrfMaxAgeMs') ?? 7200000;

    return {
      httpOnly: false,
      sameSite,
      secure,
      path: '/',
      maxAge,
    };
  }

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Register user and create session' })
  @ApiBody({ type: RegisterDto })
  @ApiCreatedResponse({ type: AccessTokenResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password);
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 10, windowMs: 60000 })
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginDto })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const tokens = await this.authService.login(dto.email, dto.password, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(
      'refresh_token',
      tokens.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return { accessToken: tokens.accessToken };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current authenticated user session data' })
  @ApiOkResponse({ description: 'Current session data' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  me(@CurrentUser() user: { sub: string }) {
    return this.authService.getSession(user.sub);
  }

  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ limit: 20, windowMs: 60000 })
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token with refresh cookie + CSRF' })
  @ApiOkResponse({ type: AccessTokenResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken =
      typeof req.cookies?.refresh_token === 'string'
        ? req.cookies.refresh_token
        : '';

    const tokens = await this.authService.refresh(refreshToken, {
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.cookie(
      'refresh_token',
      tokens.refreshToken,
      this.getRefreshCookieOptions(),
    );

    return { accessToken: tokens.accessToken };
  }

  @UseGuards(CsrfGuard, RateLimitGuard)
  @RateLimit({ limit: 30, windowMs: 60000 })
  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout current session' })
  @ApiNoContentResponse({ description: 'Session revoked' })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  async logout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    const refreshToken =
      typeof req.cookies?.refresh_token === 'string'
        ? req.cookies.refresh_token
        : '';

    res.clearCookie('refresh_token', this.getRefreshCookieOptions());

    await this.authService.logout(refreshToken);
  }

  @Public()
  @Get('csrf')
  @ApiOperation({ summary: 'Get CSRF cookie token' })
  @ApiOkResponse({ type: OkResponseDto })
  getCsrf(@Res({ passthrough: true }) res: Response) {
    const csrfToken = randomUUID();

    res.cookie('csrf_token', csrfToken, this.getCsrfCookieOptions());

    return { ok: true };
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60000 })
  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Request password reset token' })
  @ApiBody({ type: ForgotPasswordDto })
  @ApiOkResponse({ description: 'Neutral response for security reasons' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60000 })
  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset password with a valid reset token' })
  @ApiBody({ type: ResetPasswordDto })
  @ApiOkResponse({ description: 'Password updated' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  @UseGuards(RateLimitGuard)
  @RateLimit({ limit: 5, windowMs: 60000 })
  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change password for authenticated user' })
  @ApiBody({ type: ChangePasswordDto })
  @ApiOkResponse({ description: 'Password updated' })
  @ApiBadRequestResponse({ type: ValidationErrorResponseDto })
  @ApiForbiddenResponse({ type: ErrorResponseDto })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto })
  changePassword(
    @CurrentUser() user: { sub: string },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(
      user.sub,
      dto.currentPassword,
      dto.newPassword,
    );
  }
}
