// src/logs/logs.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Log } from './entity/log.entity';
import { EntryType } from './entity/log.entity';
import { Device } from 'src/device/entities/device.entity';

@Injectable()
export class LogsService {
  constructor(
    @InjectRepository(Log)
    private readonly logRepository: Repository<Log>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  async createLog(
    cardId: string,
    userId: string,
    attempt: EntryType,
    timestamp: number,
    deviceId: string, // Add deviceId from the JWT token
  ): Promise<Log> {
    // Find the associated device using the provided deviceId
    const device = await this.deviceRepository.findOne({
      where: { macAddress: deviceId },
    });
    if (!device) {
      throw new NotFoundException(`Device with ID ${deviceId} not found`);
    }

    // Create a new log and associate it with the device
    const newLog = this.logRepository.create({
      chipId: cardId,
      esp32Id: deviceId,
      entryType: attempt,
      timestamp: new Date(timestamp),
      device: device, // Associate the log with the device
    });

    return await this.logRepository.save(newLog);
  }

  async findAll(): Promise<Log[]> {
    return this.logRepository.find({ relations: ['device'] });
  }
}
