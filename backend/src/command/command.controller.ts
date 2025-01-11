// src/commands/command.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Request,
  Body,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CommandService } from './command.service';
import { CommandDto } from './dto/command.dto';
import { CommandType } from './command-types';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('commands')
@ApiBearerAuth()
@Controller('commands')
export class CommandController {
  constructor(private readonly commandService: CommandService) {}

  @UseGuards(JwtAuthGuard)
  @Get()
  @ApiOperation({
    summary: 'Get the list of commands for the device and clear them',
  })
  @ApiResponse({
    status: 200,
    description: 'List of commands',
    type: [CommandDto],
  })
  async getAndClearCommands(@Request() req): Promise<CommandDto[]> {
    const device = req.user; // The authenticated device
    console.log('Device:', device);

    // Fetch commands from the database
    const commands: CommandDto[] =
      await this.commandService.getCommandsForDevice(device.macAddress);

    // Add the FETCH_LOGS command to the list
    const fetchLogsCommand: CommandDto = {
      name: CommandType.FETCH_LOGS,
      payload: {},
    };
    commands.push(fetchLogsCommand);

    // Clear the commands from the database
    await this.commandService.clearCommands(device.macAddress);

    return commands;
  }

  @Post('queue')
  @UseGuards(AuthGuard('basic'))
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
