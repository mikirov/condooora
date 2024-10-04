import { Module } from '@nestjs/common';
import { LogsController } from './logs.controller';
import { LogsService } from './logs.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Log } from './entity/log.entity';
import { Device } from 'src/device/entities/device.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Log, Device]), // Import Log and Device entities
  ],
  providers: [LogsService],
  controllers: [LogsController],
})
export class LogsModule {}
