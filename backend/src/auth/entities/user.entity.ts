import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BeforeInsert,
  BeforeUpdate,
  AfterLoad,
  CreateDateColumn,
  ManyToOne,
  OneToMany,
} from 'typeorm';
import * as bcrypt from 'bcryptjs'; // or 'bcryptjs'
import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsEnum,
  IsString,
  MinLength,
  IsOptional,
  IsUrl,
} from 'class-validator';
import { randomBytes } from 'crypto';
import { Department } from 'src/department/entities/department.entity';
import { SetMetadata } from '@nestjs/common';

// Define the Role enum with numeric values
export enum Role {
  BOSS = 1,
  CLERK = 2,
  MANAGER = 3,
  EMPLOYEE = 4,
}

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);

@Entity('user')
export class User {
  @PrimaryGeneratedColumn()
  @ApiProperty({ description: 'Unique identifier for the user' })
  id: number;

  @Column({ unique: true, nullable: true })
  @ApiProperty({ description: 'Email address of the user', uniqueItems: true })
  @IsEmail({}, { message: 'Invalid email address' })
  email?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'First name of the user', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Last name of the user', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Name of the user' })
  @IsString()
  @IsOptional()
  name: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Image URL of the user', required: false })
  @IsString()
  @IsUrl({}, { message: 'Invalid URL' })
  @IsOptional()
  imageUrl?: string;

  @Column({ nullable: true })
  @ApiProperty({ description: 'Password for the user account' })
  @IsString()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  password: string;

  @Column({
    type: 'int', // Store the enum as an integer
    default: Role.EMPLOYEE, // Default role
  })
  @ApiProperty({
    description: 'Role of the user',
    enum: Role,
    default: Role.EMPLOYEE,
  })
  @IsEnum(Role, {
    message:
      'Role must be one of: 1 (boss), 2 (clerk), 3 (manager), 4 (employee)',
  })
  role: Role;

  @Column({ default: false })
  @ApiProperty({
    description: 'Whether the user account is active or not',
    default: false,
  })
  isActive: boolean;

  @CreateDateColumn()
  @ApiProperty({ description: 'The date the user was created' })
  createdAt: Date;

  @Column({ type: 'bigint', nullable: true })
  @ApiProperty({
    description: 'Card ID associated with the user',
    example: '12345678',
  })
  cardId?: number;

  @Column({ type: 'bigint', nullable: true })
  @ApiProperty({ description: 'Start time for the user in ms (optional)' })
  @IsOptional()
  startTime?: number;

  @Column({ type: 'bigint', nullable: true })
  @ApiProperty({ description: 'End time for the user in ms (optional)' })
  @IsOptional()
  endTime?: number;

  @Column({ default: false })
  @ApiProperty({
    description: 'Indicates if the user is currently inside the workplace',
    default: false,
  })
  isInsideWorkplace: boolean;

  @Column({ type: 'bigint', default: 0 })
  @ApiProperty({
    description: 'Total time in ms the user has spent in the workplace',
    default: 0,
  })
  timeInOffice: number;

  @ManyToOne(() => Department, (department) => department.employees)
  department: Department;

  @OneToMany(() => Department, (department) => department.manager)
  managedDepartments: Department[];

  private tempPassword: string;

  @AfterLoad()
  private loadTempPassword(): void {
    this.tempPassword = this.password;
  }

  @BeforeInsert()
  @BeforeUpdate()
  async hashPassword() {
    if (this.tempPassword !== this.password) {
      const saltRounds = parseInt(process.env.SALT_ROUNDS || '10', 10);
      this.password = await bcrypt.hash(this.password, saltRounds);
    }
  }

  @BeforeInsert()
  generateRandomPassword() {
    if (!this.password) {
      // Generate a random password of 12 characters
      const randomPassword = randomBytes(6).toString('hex'); // 6 bytes = 12 hex characters
      this.password = randomPassword;

      console.log(
        `Generated password for user ${this.email}: ${randomPassword}`,
      ); // Optional logging
    }
  }

  async comparePassword(enteredPassword: string): Promise<boolean> {
    return await bcrypt.compare(enteredPassword, this.password);
  }
}
