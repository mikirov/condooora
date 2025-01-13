import { Device } from 'src/device/entities/device.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
} from 'typeorm';

export enum EntryType {
  ENTRY_ALLOWED = 'ENTRY_ALLOWED',
  INTERMEDIARY_ACCESS = 'INTERMEDIARY_ACCESS',
  ANTI_PASSBACK = 'ANTI_PASSBACK',
  NOT_REGISTERED = 'NOT_REGISTERED',
  DEACTIVATED_CARD = 'DEACTIVATED_CARD',
}

// Mapping function
export function mapIntegerToEntryType(value: number): EntryType {
  switch (value) {
    case 0:
      return EntryType.ENTRY_ALLOWED;
    case 1:
      return EntryType.INTERMEDIARY_ACCESS;
    case 2:
      return EntryType.ANTI_PASSBACK;
    case 3:
      return EntryType.NOT_REGISTERED;
    case 4:
      return EntryType.DEACTIVATED_CARD;
    default:
      throw new Error(`Invalid EntryType value: ${value}`);
  }
}

@Entity()
export class Log {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: 'int', unsigned: true }) // Store cardId as an unsigned integer
  cardId: number;

  @Column({ type: 'int', unsigned: true }) // Store userId as an unsigned integer
  userId: number;

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
