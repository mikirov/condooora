import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiBody, ApiResponse } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { Device } from 'src/device/entities/device.entity';
import { CommandDto } from 'src/command/dto/command.dto';
import { CommandService } from 'src/command/command.service';
// import * as os from 'os'; // Import the os module

class RegisterDto {
  macAddress: string;
}

class RegisterResponseDto {
  serverBaseUrl?: string;
  ntpServer?: string;
  pollingInterval?: number;
  queueSize?: number;
  jwtToken: string;
  initialCommands?: CommandDto[];
}

@ApiTags('device')
@Controller('device')
export class DeviceController {
  //   private readonly DEFAULT_NTP_SERVER = 'pool.ntp.org';
  //   private readonly DEFAULT_POLLING_INTERVAL =
  //     process.env.NODE_ENV == 'development' ? 10000 : 3000;

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
    // const initialCommands =
    //   await this.commandService.getUnsentCommandsForDevice(macAddress);
    const initialCommands =
      await this.commandService.getUnsentCommandsForDevice(device.macAddress);

    // Generate a JWT token with the macAddress as the payload
    const jwtToken = this.jwtService.sign(
      { id: macAddress },
      { secret: process.env.DEVICE_JWT_SECRET },
    );

    // Clear the commands after reading them (optional)
    // await this.commandService.clearCommands(macAddress);

    // Create and return the response with the commands from DB or defaults
    return {
      jwtToken, // Include the JWT token in the response
      //   ntpServer: this.DEFAULT_NTP_SERVER,
      initialCommands: initialCommands.map((command) => ({
        name: command.name,
        payload: command.payload,
      })),
    };
  }
}
