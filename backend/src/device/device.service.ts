// src/devices/device.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Device } from './entities/device.entity';
import { Command } from 'src/command/entities/command.entity';

@Injectable()
export class DeviceService {
  constructor(
    @InjectRepository(Device)
    private deviceRepository: Repository<Device>,

    @InjectRepository(Command)
    private readonly commandRepository: Repository<Command>,
  ) {}

  async findById(id: string): Promise<Device> {
    return this.deviceRepository.findOne({ where: { macAddress: id } });
  }

  /**
   * Check if the device's latest synced command matches the latest command in the database.
   * @param macAddress - MAC address of the device
   * @returns - True if synced, false otherwise
   */
  async checkCommandSyncStatus(macAddress: string): Promise<boolean> {
    const device = await this.deviceRepository.findOne({
      where: { macAddress },
    });

    if (!device) {
      throw new Error(`Device with MAC address ${macAddress} not found`);
    }

    // Get the latest command from the database
    const latestCommand = await this.commandRepository.findOne({
      where: { device: { macAddress } },
      order: { id: 'DESC' },
    });

    if (!latestCommand) {
      console.log(`No commands found for device ${macAddress}`);
      return true; // No commands to compare, assume synced
    }

    return device.latestSyncedCommandId === latestCommand.id;
  }
}
