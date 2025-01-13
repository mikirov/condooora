import { User } from 'src/auth/entities/user.entity';
import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';

@Entity('department')
export class Department {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => User, (user) => user.managedDepartments, {
    cascade: true,
    eager: true,
  })
  @JoinColumn({ name: 'managerId' })
  manager: User;

  @OneToMany(() => User, (user) => user.department, { cascade: true })
  employees: User[];
}
