// src/commands/command.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Request,
  Body,
  Post,
  Logger,
  // BadRequestException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CommandService } from './command.service';
import { CommandDto } from './dto/command.dto';
import { CommandType } from './command-types';
import { TokenAuthGuard } from 'src/auth/guards/auth.guard';
import { DeviceAuthGuard } from 'src/auth/guards/device.guard';

@ApiTags('commands')
@ApiBearerAuth()
@Controller('commands')
export class CommandController {
  private readonly logger = new Logger(CommandController.name);
  constructor(private readonly commandService: CommandService) {}

  @UseGuards(DeviceAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Get the list of commands for the device and clear them',
  })
  @ApiResponse({
    status: 200,
    description: 'List of commands',
    type: [CommandDto],
  })
  async getCommands(@Request() req): Promise<CommandDto[]> {
    const device = req.device; // The authenticated device
    console.log('Device:', device);

    // Perform sanity check for the latest executed command
    // const isSynced = await this.deviceService.checkCommandSyncStatus(
    //   device.macAddress,
    // );
    // if (!isSynced) {
    //   throw new BadRequestException(
    //     'Device has not executed the latest command. Please ensure proper execution before fetching new commands.',
    //   );
    // }

    // Fetch commands from the database
    // const commands = await this.commandService.getUnsentCommandsForDevice(
    //   device.macAddress,
    // );

    const commands = await this.commandService.getUnsentCommandsForDevice(
      device.macAddress,
    );

    // Map Command entities to CommandDto objects
    const commandDtos: CommandDto[] = commands.map((command) => ({
      name: command.name,
      payload: command.payload,
    }));

    const commandIds = commands.map((c) => c.id);
    this.logger.log(`Marking commands as sent: ${commandIds}`);
    const affected = await this.commandService.markCommandsAsSent(commandIds);
    this.logger.log(`Marked ${affected} commands as sent`);

    // Add the FETCH_LOGS command to the list in all cases
    const fetchLogsCommand: CommandDto = {
      name: CommandType.FETCH_LOGS,
      payload: {},
    };
    commandDtos.push(fetchLogsCommand);

    return commandDtos;
  }

  @Post('queue')
  @UseGuards(TokenAuthGuard)
  @ApiBody({ description: 'Queue commands for a device' })
  @ApiResponse({ status: 201, description: 'Commands queued successfully' })
  async queueCommands(
    @Body()
    body: {
      macAddress: string;
      commands: { name: CommandType; payload?: any }[];
    },
  ) {
    console.log('Queueing commands:', JSON.stringify(body.commands, null, 2));
    const { macAddress, commands } = body;

    for (const command of commands) {
      await this.commandService.queueCommand(
        macAddress,
        command.name,
        command.payload,
      );
    }

    return { message: 'Commands queued successfully' };
  }
}
