// src/commands/command.module.ts
import { Module } from '@nestjs/common';
import { CommandService } from './command.service';
import { CommandController } from './command.controller';
import { Device } from 'src/device/entities/device.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Command } from './entities/command.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Command, Device]), // Import Log and Device entities
  ],
  controllers: [CommandController],
  providers: [CommandService],
})
export class CommandModule {}
