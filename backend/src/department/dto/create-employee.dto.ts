import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsOptional, IsString, IsInt } from 'class-validator';
import { Role } from 'src/auth/entities/user.entity';

export class CreateEmployeeDto {
  @ApiProperty({ description: 'The ID of the department', required: false })
  @IsInt()
  @IsOptional()
  departmentId?: number;

  @ApiProperty({
    description: 'Email address of the employee',
    required: false,
  })
  @IsEmail({}, { message: 'Invalid email address' })
  @IsOptional()
  email?: string;

  @ApiProperty({ description: 'First name of the employee', required: false })
  @IsString()
  @IsOptional()
  firstName?: string;

  @ApiProperty({ description: 'Last name of the employee', required: false })
  @IsString()
  @IsOptional()
  lastName?: string;

  @ApiProperty({
    description: 'Role of the employee',
    enum: Role,
    default: Role.EMPLOYEE,
    required: false,
  })
  @IsEnum(Role, {
    message:
      'Role must be one of: 1 (BOSS), 2 (CLERK), 3 (MANAGER), 4 (EMPLOYEE)',
  })
  @IsOptional()
  role?: Role;
}
