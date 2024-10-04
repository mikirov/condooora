// src/logs/log.entity.ts
import { Device } from 'src/device/entities/device.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';

export enum EntryType {
  NOT_REGISTERED = 'NOT_REGISTERED',
  ANTI_PASSBACK = 'ANTI_PASSBACK',
  DEACTIVATED_CARD = 'DEACTIVATED_CARD',
  ENTRY_ALLOWED = 'ENTRY_ALLOWED',
}

@Entity()
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  chipId: string;

  @Column()
  esp32Id: string;

  @Column({
    type: 'enum',
    enum: EntryType,
  })
  entryType: EntryType;

  @CreateDateColumn()
  timestamp: Date;

  @ManyToOne(() => Device, (device: Device) => device.logs, {
    onDelete: 'CASCADE',
  })
  device: Device; // Foreign key to Device
}
