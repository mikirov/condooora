import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Request,
  Logger,
  Query,
} from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { LogsService } from './logs.service';
import { CreateLogDto } from './dto/create-log.dto';
import {
  ApiTags,
  ApiOperation,
  ApiBody,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { PaginationDto } from './dto/get-logs.dto';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  private readonly logger = new Logger(LogsController.name);

  constructor(private readonly logsService: LogsService) {}

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create multiple logs' })
  @ApiBody({ type: [CreateLogDto] })
  @ApiResponse({
    status: 201,
    description: 'The logs have been successfully created.',
  })
  @ApiResponse({ status: 403, description: 'Forbidden.' })
  async createLog(@Request() req, @Body() logs: CreateLogDto[]) {
    const deviceId = req.user.id;
    this.logger.debug(`Creating logs for device ID: ${deviceId}`);
    this.logger.debug(`Received logs: ${JSON.stringify(logs)}`);

    try {
      const createdLogs = await Promise.all(
        logs.map((log) => {
          // Convert Unix timestamp to JavaScript Date object
          const timestampDate = new Date(log.timestamp * 1000);
          this.logger.debug(
            `Processing log: cardId=${log.cardId}, userId=${log.userId}, attempt=${log.attempt}, timestamp=${timestampDate}`,
          );

          return this.logsService.createLog(
            log.cardId,
            log.userId,
            log.attempt,
            timestampDate, // Pass the Date object
            deviceId,
          );
        }),
      );

      this.logger.log(`Successfully created ${createdLogs.length} logs.`);
      return createdLogs;
    } catch (error) {
      this.logger.error('Error creating logs', error.stack);
      throw error;
    }
  }

  @Get()
  @ApiOperation({ summary: 'Retrieve paginated logs' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of entries per page',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Current page number',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'List of paginated logs.' })
  async findAll(@Query() pagination: PaginationDto) {
    const { limit = 10, page = 1 } = pagination;

    this.logger.debug(`Retrieving logs with limit=${limit} and page=${page}`);

    try {
      const logs = await this.logsService.findPaginated(limit, page);
      this.logger.log(
        `Retrieved ${logs.data.length} logs (Page ${page}, Limit ${limit}).`,
      );
      return logs;
    } catch (error) {
      this.logger.error('Error retrieving logs', error.stack);
      throw error;
    }
  }

  @Get('/by-user')
  @ApiOperation({ summary: 'Retrieve logs by userId' })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of entries per page',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Current page number',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'List of logs by userId.' })
  async findByUserId(
    @Query('userId') userId: string,
    @Query() pagination: PaginationDto,
  ) {
    const { limit = 10, page = 1 } = pagination;

    this.logger.debug(
      `Retrieving logs for userId=${userId} with limit=${limit} and page=${page}`,
    );

    try {
      const logs = await this.logsService.findByUserId(userId, limit, page);
      this.logger.log(
        `Retrieved ${logs.data.length} logs for userId=${userId} (Page ${page}, Limit ${limit}).`,
      );
      return logs;
    } catch (error) {
      this.logger.error('Error retrieving logs by userId', error.stack);
      throw error;
    }
  }

  @Get('/by-card')
  @ApiOperation({ summary: 'Retrieve logs by cardId' })
  @ApiQuery({ name: 'cardId', required: true, description: 'Card ID' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Number of entries per page',
    example: 10,
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: 'Current page number',
    example: 1,
  })
  @ApiResponse({ status: 200, description: 'List of logs by cardId.' })
  async findByCardId(
    @Query('cardId') cardId: string,
    @Query() pagination: PaginationDto,
  ) {
    const { limit = 10, page = 1 } = pagination;

    this.logger.debug(
      `Retrieving logs for cardId=${cardId} with limit=${limit} and page=${page}`,
    );

    try {
      const logs = await this.logsService.findByCardId(cardId, limit, page);
      this.logger.log(
        `Retrieved ${logs.data.length} logs for cardId=${cardId} (Page ${page}, Limit ${limit}).`,
      );
      return logs;
    } catch (error) {
      this.logger.error('Error retrieving logs by cardId', error.stack);
      throw error;
    }
  }
}
