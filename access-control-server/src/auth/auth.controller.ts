import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Device } from 'src/device/entities/device.entity';
import { CommandService } from 'src/command/command.service';
import { CommandDto } from 'src/command/dto/command.dto';
import * as os from 'os'; // Import the os module

class RegisterDto {
  macAddress: string;
}

class RegisterResponseDto {
  serverBaseUrl: string;
  ntpServer: string;
  pollingInterval: number;
  queueSize: number;
  jwtToken: string;
  initialCommands: CommandDto[];
}

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  // Method to get the local IP address
  private getLocalIPAddress(): string {
    const networkInterfaces = os.networkInterfaces();
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          if (iface.family === 'IPv4' && !iface.internal) {
            return iface.address;
          }
        }
      }
    }
    return '127.0.0.1'; // Fallback to localhost if no private IP is found
  }

  // Default values
  private readonly DEFAULT_SERVER_BASE_URL = `http://${this.getLocalIPAddress()}:3002`;
  private readonly DEFAULT_NTP_SERVER = 'pool.ntp.org';
  private readonly DEFAULT_POLLING_INTERVAL = 3000;
  private readonly DEFAULT_QUEUE_SIZE = 10;

  constructor(
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
    private readonly commandService: CommandService,
    private readonly jwtService: JwtService,
  ) {}

  @Post('register')
  @ApiBody({ type: RegisterDto, description: 'MAC address of the device' })
  @ApiResponse({
    status: 201,
    description: 'Device registered successfully',
    type: RegisterResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  async register(
    @Body() registerDto: RegisterDto,
  ): Promise<RegisterResponseDto> {
    const { macAddress } = registerDto;

    // Find existing device or create a new one with default values
    let device = await this.deviceRepository.findOne({ where: { macAddress } });
    if (!device) {
      device = this.deviceRepository.create({ macAddress });
      await this.deviceRepository.save(device);
    }

    // Retrieve queued commands for the device
    const initialCommands =
      await this.commandService.getCommandsForDevice(macAddress);

    // Generate a JWT token with the macAddress as the payload
    const jwtToken = this.jwtService.sign(
      { id: macAddress },
      { secret: process.env.JWT_SECRET },
    );

    // Clear the commands after reading them (optional)
    // await this.commandService.clearCommands(macAddress);

    // Create and return the response with the commands from DB or defaults
    return {
      serverBaseUrl: this.DEFAULT_SERVER_BASE_URL,
      ntpServer: this.DEFAULT_NTP_SERVER,
      pollingInterval: this.DEFAULT_POLLING_INTERVAL,
      queueSize: this.DEFAULT_QUEUE_SIZE,
      jwtToken, // Include the JWT token in the response
      initialCommands: initialCommands.map((command) => ({
        name: command.name,
        payload: command.payload,
      })),
    };
  }
}
