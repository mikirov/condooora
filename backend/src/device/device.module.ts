// src/devices/device.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceService } from './device.service';
import { Device } from './entities/device.entity';
import { CommandService } from 'src/command/command.service';
import { Command } from 'src/command/entities/command.entity';
import { DeviceController } from './device.controller';
import { JwtService } from '@nestjs/jwt';

@Module({
  imports: [TypeOrmModule.forFeature([Device, Command])],
  controllers: [DeviceController],
  providers: [DeviceService, CommandService, JwtService],
  exports: [DeviceService],
})
export class DeviceModule {}
