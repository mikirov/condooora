import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log, mapIntegerToEntryType } from './entity/log.entity';
import { Device } from 'src/device/entities/device.entity';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(Log)
    private logsRepository: Repository<Log>,
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,
  ) {}

  async createLog(
    cardId: string,
    userId: string,
    attempt: number,
    timestamp: Date,
    deviceId: string,
  ) {
    const log = new Log();
    log.cardId = cardId;
    log.userId = userId;

    // Map the integer attempt to EntryType
    log.entryType = mapIntegerToEntryType(attempt);

    log.timestamp = timestamp;
    // Assume you set the device as well, maybe by fetching it from the repository
    log.device = await this.deviceRepository.findOneBy({
      macAddress: deviceId,
    });

    return this.logsRepository.save(log);
  }

  async findAll() {
    return this.logsRepository.find();
  }

  async findPaginated(limit: number, page: number) {
    const [data, total] = await this.logsRepository.findAndCount({
      skip: (page - 1) * limit, // Start index for pagination
      take: limit, // Number of items to fetch
      order: { timestamp: 'DESC' }, // Sort logs by timestamp (most recent first)
    });

    return {
      data,
      total,
      page,
      limit,
    };
  }

  async findByUserId(userId: string, limit: number, page: number) {
    const [data, total] = await this.logsRepository.findAndCount({
      where: { userId },
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' },
    });

    return { data, total, page, limit };
  }

  async findByCardId(cardId: string, limit: number, page: number) {
    const [data, total] = await this.logsRepository.findAndCount({
      where: { cardId },
      skip: (page - 1) * limit,
      take: limit,
      order: { timestamp: 'DESC' },
    });

    return { data, total, page, limit };
  }
}
