/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../entities/user.entity'; // Adjust this path to your actual User entity path
import { HttpService } from '@nestjs/axios';

@Injectable()
export class TokenAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>, // Inject UserRepository
    private readonly httpService: HttpService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No Bearer token provided');
    }

    const token = authHeader.split(' ')[1];

    // Check if the token is a valid JWT from the app
    const jwtPayload = await this.validateJwtToken(token);
    if (jwtPayload) {
      const user = await this.userRepository.findOne({
        where: { id: jwtPayload.userId },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      request.user = user; // Set req.user with the user record from the DB
      return true;
    }

    // Check if the token is a valid Google access token
    const googleUser = await this.validateGoogleToken(token);
    if (googleUser) {
      const user = await this.userRepository.findOne({
        where: { email: googleUser.email },
      });
      if (!user) {
        throw new UnauthorizedException('User not found');
      }
      request.user = user; // Set req.user with the user record from the DB
      return true;
    }

    // If none of the above validations passed, throw an unauthorized exception
    throw new UnauthorizedException('Invalid token');
  }

  // Validate JWT issued by your application
  async validateJwtToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('ACCESS_TOKEN_SECRET'),
      });
      return decoded; // If verification is successful, return the decoded payload
    } catch (error) {
      return null; // If verification fails, return null
    }
  }

  // Validate Google access token by calling Google's token info API
  async validateGoogleToken(token: string): Promise<any> {
    const googleTokenInfoUrl = `https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=${token}`;

    try {
      const response = await this.httpService
        .get(googleTokenInfoUrl)
        .toPromise();
      if (
        response.data.audience === this.configService.get('GOOGLE_CLIENT_ID')
      ) {
        return {
          email: response.data.email,
          userId: response.data.user_id,
        };
      }
      return null;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null;
    }
  }
}
