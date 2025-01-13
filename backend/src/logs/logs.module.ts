import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './entity/log.entity';
import { Device } from 'src/device/entities/device.entity';
import { JwtService } from '@nestjs/jwt';
import { User } from 'src/auth/entities/user.entity';
import { HttpModule } from '@nestjs/axios';
import { UserService } from 'src/auth/services/user.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Log, Device, User]), // Import Log and Device entities
    HttpModule,
  ],
  providers: [LogsService, JwtService, UserService],
  controllers: [LogsController],
})
export class LogsModule {}
