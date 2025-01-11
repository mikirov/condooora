import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { BasicStrategy } from 'passport-http';

@Injectable()
export class BasicAuthStrategy extends PassportStrategy(
  BasicStrategy,
  'basic',
) {
  private readonly logger = new Logger(BasicAuthStrategy.name);

  async validate(username: string, password: string): Promise<any> {
    this.logger.log(`Authenticating user: ${username}`);

    const validUsername = process.env.ADMIN_USERNAME || 'admin';
    const validPassword = process.env.ADMIN_PASSWORD || 'password123';

    if (username === validUsername && password === validPassword) {
      this.logger.log(`Authentication successful for user: ${username}`);
      return { username };
    }

    this.logger.warn(`Authentication failed for user: ${username}`);
    throw new UnauthorizedException('Not Admin');
  }
}
