// src/commands/command.entity.ts
import { Device } from 'src/device/entities/device.entity';
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from 'typeorm';

@Entity()
export class Command {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column('json', { nullable: true })
  payload?: any;

  @ManyToOne(() => Device, (device) => device.commands)
  device: Device;
}
