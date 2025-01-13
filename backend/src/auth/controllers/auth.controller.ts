import {
  Controller,
  Post,
  Body,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  UseGuards,
  Req,
  Delete,
} from '@nestjs/common';
import { AuthService } from '../services/auth.service';

import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CreateUserDto } from '../dto/create-user.dto';
import { LoginDto } from '../dto/login.dto';
import { ResetPasswordDto } from '../dto/reset-password.dto';
import { ForgotPasswordDto } from '../dto/forgot-password.dto';
import { TokenAuthGuard } from '../guards/auth.guard';
import { OAuthService } from '../services/oauth.service';
import { MailChangeDto } from '../dto/mail-chage.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { User } from '../entities/user.entity';

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name); // Set up logger for controller

  constructor(
    @InjectRepository(User)
    private readonly authService: AuthService,
    private readonly oAuthService: OAuthService,
  ) {}

  // Endpoint to get Google Auth URL
  @Get('google-url')
  @ApiOperation({ summary: 'Get Google OAuth URL' })
  @ApiResponse({ status: 200, description: 'Google OAuth URL returned' })
  getGoogleAuthUrl(): { url: string } {
    const url = this.oAuthService.getGoogleAuthURL();
    return { url };
  }

  @Post('google/callback')
  async googleAuth(@Body('code') code: string) {
    return this.authService.googleLogin(code);
  }

  @Post('jwt/callback')
  @ApiResponse({
    status: 200,
    description: 'Email confirmed successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid token or email confirmation failed.',
  })
  async jwtAuth(@Body('code') code: string) {
    this.logger.log(`Email confirmation attempt for token: ${code}`);
    return this.authService.jwtLogin(code);
  }

  @Post('register')
  @ApiOperation({ summary: 'Register a new user' })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'User already exists' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  async register(@Body() createUserDto: CreateUserDto) {
    this.logger.log(`Registering user with email: ${createUserDto.email}`);
    return this.authService.register(createUserDto);
  }

  @Post('update-email')
  @UseGuards(TokenAuthGuard)
  @ApiOperation({ summary: 'Set user email' })
  @ApiResponse({
    status: 200,
    description: 'Confirmation email sent successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or user not found.',
  })
  async updateEmail(@Body() mailChangeDto: MailChangeDto, @Req() req) {
    //This check might not be necessary
    // const user = await this.userRepository.findOne({
    //   where: { email: mailChangeDto.email },
    // });
    // if (user && user.id !== req.user.id) {
    //   throw new BadRequestException('Email belongs to another user');
    // }

    this.logger.log(
      `Sending mail change confirmation email for: ${mailChangeDto.email}`,
    );
    return this.authService.sendConfirmation(mailChangeDto.email, req.user.id);
  }

  @Post('resend-confirmation')
  @ApiOperation({ summary: 'Resend email confirmation link' })
  @ApiResponse({
    status: 200,
    description: 'Confirmation email resent successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or user not found.',
  })
  async resendConfirmation(@Body('email') email: string) {
    this.logger.log(`Resending confirmation email for: ${email}`);
    return this.authService.sendConfirmation(email);
  }

  @Post('login')
  @ApiOperation({ summary: 'Login a user' })
  @ApiResponse({ status: 200, description: 'User logged in successfully' })
  @ApiResponse({ status: 400, description: 'Invalid credentials' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiBody({ type: LoginDto })
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto) {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);
    return this.authService.login(loginDto);
  }

  @Post('refresh-token')
  @ApiOperation({ summary: 'Refresh access token using a refresh token' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        refreshToken: {
          type: 'string',
          description: 'The refresh token to generate a new access token',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Access token refreshed successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid or expired refresh token.',
  })
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    this.logger.log('Attempting to refresh access token');
    return this.authService.refreshAccessToken(refreshToken);
  }

  @Post('forgot-password')
  @ApiOperation({ summary: 'Send a password reset link to user’s email' })
  @ApiResponse({
    status: 200,
    description: 'Password reset email sent successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid email or user not found.',
  })
  async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using a valid reset token' })
  @ApiResponse({
    status: 200,
    description: 'Password reset successfully.',
  })
  @ApiBadRequestResponse({
    description: 'Invalid token or password reset failed.',
  })
  async resetPassword(@Body() resetPasswordDto: ResetPasswordDto) {
    return this.authService.resetPassword(resetPasswordDto);
  }

  @UseGuards(TokenAuthGuard)
  @ApiBearerAuth() // Document the use of JWT or access token
  @Get('profile')
  @ApiOperation({ summary: 'Get the profile of the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'User profile data returned successfully.',
  })
  @ApiUnauthorizedResponse({
    description: 'Unauthorized access, JWT token is missing or invalid.',
  })
  async getProfile(@Req() req): Promise<any> {
    const userId = req.user.id; // Extract the user ID from the request
    const user = await this.authService.getUserProfile(userId);

    return user; // Return user profile data (password is excluded)
  }

  @UseGuards(TokenAuthGuard)
  @ApiBearerAuth()
  @Delete('delete-user')
  @ApiOperation({ summary: 'Delete the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'User deletion email sent successfully.',
  })
  @ApiBadRequestResponse({ description: 'Failed to delete user.' })
  @HttpCode(HttpStatus.OK)
  async deleteUser(@Req() req) {
    const userId = req.user.id; // Get user ID from request
    this.logger.log(`Deletion request for user ID: ${userId}`);
    return this.authService.deleteUser(userId);
  }

  @Post('confirm-delete')
  @ApiOperation({ summary: 'Confirm user deletion' })
  @ApiResponse({
    status: 200,
    description: 'User account deleted successfully.',
  })
  @ApiBadRequestResponse({ description: 'Invalid or expired token.' })
  @HttpCode(HttpStatus.OK)
  async confirmDeletion(@Body('token') token: string) {
    this.logger.log(
      `Account deletion confirmation attempt for token: ${token}`,
    );
    return this.authService.confirmDeletion(token);
  }
}
