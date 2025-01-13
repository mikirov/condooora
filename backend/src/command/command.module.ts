// src/commands/command.module.ts
import { Module } from '@nestjs/common';
import { CommandService } from './command.service';
import { CommandController } from './command.controller';
import { Device } from 'src/device/entities/device.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Command } from './entities/command.entity';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/auth/entities/user.entity';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    HttpModule,
    TypeOrmModule.forFeature([Command, Device, User]), // Import Log and Device entities
  ],
  controllers: [CommandController],
  providers: [CommandService, JwtService],
})
export class CommandModule {}
