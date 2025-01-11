// src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LogsModule } from './logs/logs.module';
import { AuthModule } from './auth/auth.module';
import { Log } from './logs/entity/log.entity';
import { CommandModule } from './command/command.module';
import { Device } from './device/entities/device.entity';
import { Command } from './command/entities/command.entity';
import { DeviceModule } from './device/device.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.get<string>('DATABASE_URL'),
        entities: [Log, Device, Command],
        synchronize: true,
      }),
    }),
    LogsModule,
    CommandModule,
    DeviceModule,
    AuthModule,
  ],
})
export class AppModule {}
