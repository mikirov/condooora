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
import { Device } from 'src/device/entities/device.entity'; // Adjust this path to your actual Device entity path

@Injectable()
export class DeviceAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>, // Inject DeviceRepository
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers['authorization'];

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('No Bearer token provided');
    }

    const token = authHeader.split(' ')[1];

    // Validate JWT issued by the app
    const jwtPayload = await this.validateJwtToken(token);
    if (!jwtPayload || !jwtPayload.id) {
      throw new UnauthorizedException('Invalid or missing device ID in token');
    }

    // Check if the device exists in the repository
    const device = await this.deviceRepository.findOne({
      where: { macAddress: jwtPayload.id },
    });

    if (!device) {
      throw new UnauthorizedException('Device not found');
    }

    // Attach the device to the request object for further use
    request.device = device;

    return true;
  }

  // Validate JWT issued by your application
  async validateJwtToken(token: string): Promise<any> {
    try {
      const decoded = this.jwtService.verify(token, {
        secret: this.configService.get('DEVICE_JWT_SECRET'),
      });
      return decoded; // If verification is successful, return the decoded payload
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      return null; // If verification fails, return null
    }
  }
}
