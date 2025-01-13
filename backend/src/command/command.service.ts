// src/commands/command.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { CommandType } from './command-types';
import { Command } from './entities/command.entity';
import { Device } from 'src/device/entities/device.entity';

@Injectable()
export class CommandService {
  private readonly logger = new Logger(CommandService.name);

  constructor(
    @InjectRepository(Command)
    private readonly commandRepository: Repository<Command>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

  /**
   * Set the sent status of a list of commands to true
   * @param commandIds - List of command IDs to update
   * @returns - Number of commands updated
   */
  async markCommandsAsSent(commandIds: number[]): Promise<number> {
    if (!commandIds || commandIds.length === 0) {
      this.logger.log(`No command IDs provided.'`);
      return 0;
    }

    const updateResult = await this.commandRepository.update(
      { id: In(commandIds) },
      { sent: true },
    );

    return updateResult.affected || 0; // Return the number of commands updated
  }

  /**
   * Queue a command for a specific device
   * @param macAddress - MAC address of the target device
   * @param commandType - Type of command to queue
   * @param payload - Optional payload for the command
   * @returns - The newly created command
   */
  async queueCommand(
    macAddress: string,
    commandType: CommandType,
    payload?: any,
  ): Promise<Command> {
    // Find the target device by macAddress
    const device = await this.deviceRepository.findOne({
      where: { macAddress },
    });
    if (!device) {
      throw new Error(`Device with MAC address ${macAddress} not found`);
    }

    // Create a new command for the device
    const command = this.commandRepository.create({
      name: commandType,
      payload: payload || {},
      device: device, // Associate the command with the device
    });

    // Save the command to the database
    return await this.commandRepository.save(command);
  }

  async getUnsentCommandsForDevice(macAddress: string): Promise<Command[]> {
    return await this.commandRepository.find({
      where: { device: { macAddress }, sent: false },
      relations: ['device'],
    });
  }

  async getAllCommandsForDevice(macAddress: string): Promise<Command[]> {
    return await this.commandRepository.find({
      where: { device: { macAddress } },
      relations: ['device'],
    });
  }
}
