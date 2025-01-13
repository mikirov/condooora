// src/devices/device.entity.ts
import { Command } from 'src/command/entities/command.entity';
import { Log } from 'src/logs/entity/log.entity';
import { Entity, PrimaryColumn, OneToMany, Column } from 'typeorm';

@Entity()
export class Device {
  @PrimaryColumn()
  macAddress: string;

  @OneToMany(() => Command, (command) => command.device)
  commands: Command[];

  @OneToMany(() => Log, (log) => log.device)
  logs: Log[]; // Inverse side of the relationship

  @Column({ type: 'int', nullable: true })
  latestSyncedCommandId: number | null; // ID of the latest successfully handled command
}
