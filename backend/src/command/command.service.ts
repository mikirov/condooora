// src/commands/command.service.ts
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CommandType } from './command-types';
import { Command } from './entities/command.entity';
import { Device } from 'src/device/entities/device.entity';
import { CommandDto } from './dto/command.dto';

@Injectable()
export class CommandService {
  constructor(
    @InjectRepository(Command)
    private readonly commandRepository: Repository<Command>,
    @InjectRepository(Device)
    private readonly deviceRepository: Repository<Device>,
  ) {}

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

  /**
   * Retrieve all commands for a specific device
   * @param macAddress - MAC address of the target device
   * @returns - List of CommandDto objects for the device
   */
  async getCommandsForDevice(macAddress: string): Promise<CommandDto[]> {
    const commands = await this.commandRepository.find({
      where: { device: { macAddress } },
      relations: ['device'],
    });

    // Map Command entities to CommandDto objects
    return commands.map((command) => ({
      name: command.name,
      payload: command.payload,
    }));
  }

  /**
   * Clear all commands for a specific device
   * @param macAddress - MAC address of the target device
   */
  async clearCommands(macAddress: string): Promise<void> {
    await this.commandRepository.delete({ device: { macAddress } });
  }
}
