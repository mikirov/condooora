// src/logs/logs.controller.ts
import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import { EntryType } from './entity/log.entity';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { LogsService } from './logs.service';

@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  async createLog(
    @Request() req, // Access the request object to get the authenticated user (device)
    @Body('cardId') cardId: string,
    @Body('userId') userId: string,
    @Body('entryType') attempt: EntryType,
    @Body('timestamp') timestamp: number,
  ) {
    // Pass the device ID (from JWT) to the logsService
    return this.logsService.createLog(
      cardId,
      userId,
      attempt,
      timestamp,
      req.user.id,
    );
  }

  @Get()
  async findAll() {
    return this.logsService.findAll();
  }
}
