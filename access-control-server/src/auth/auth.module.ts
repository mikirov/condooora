// src/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt/jwt.strategy';
import { Device } from 'src/device/entities/device.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DeviceModule } from 'src/device/device.module';
import { CommandModule } from 'src/command/command.module';
import { CommandService } from 'src/command/command.service';
import { Command } from 'src/command/entities/command.entity';

@Module({
  imports: [
    DeviceModule,
    TypeOrmModule.forFeature([Device, Command]),
    PassportModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
    }),
    CommandModule,
  ],
  providers: [AuthService, JwtStrategy, CommandService],
  controllers: [AuthController],
  exports: [AuthService],
})
export class AuthModule {}
