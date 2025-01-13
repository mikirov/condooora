import {
  Controller,
  Get,
  Param,
  UseGuards,
  ForbiddenException,
  Body,
  Post,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { DepartmentService } from './department.service';
import { RoleGuard } from '../auth/guards/role.guard';
import { Role, Roles } from 'src/auth/entities/user.entity';
import { TokenAuthGuard } from 'src/auth/guards/auth.guard';
import { CreateEmployeeDto } from './dto/create-employee.dto';

@ApiTags('Departments')
@Controller('departments')
export class DepartmentController {
  constructor(private readonly departmentService: DepartmentService) {}

  @Get(':id/employees')
  @ApiOperation({ summary: 'Get employees in a department' })
  @ApiBearerAuth()
  @ApiResponse({ status: 200, description: 'List of employees' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(TokenAuthGuard, RoleGuard)
  @Roles(Role.MANAGER) // Restrict access to managers
  async getEmployees(@Param('id') id: number) {
    const department = await this.departmentService.getDepartmentById(id);

    if (!department) {
      throw new ForbiddenException('Department not found.');
    }

    return department.employees;
  }

  @Post('create-employee')
  @ApiOperation({ summary: 'Create a new employee' })
  @ApiBearerAuth()
  @ApiResponse({ status: 201, description: 'Employee created successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @UseGuards(TokenAuthGuard, RoleGuard)
  @Roles(Role.CLERK, Role.BOSS) // Restrict access to specified roles
  async createEmployee(@Body() createEmployeeDto: CreateEmployeeDto) {
    const { departmentId, email, firstName, lastName, role } =
      createEmployeeDto;

    if (role !== Role.EMPLOYEE) {
      throw new ForbiddenException(
        'Only employees can be created through this endpoint.',
      );
    }

    const employee = await this.departmentService.createEmployee({
      departmentId,
      email,
      firstName,
      lastName,
      role,
    });

    return {
      message:
        'Employee created successfully. A password has been generated for the user.',
      employee: {
        id: employee.id,
        email: employee.email,
        firstName: employee.firstName,
        lastName: employee.lastName,
        department: employee.department.id,
        role: employee.role,
      },
    };
  }
}
