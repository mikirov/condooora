import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';
import { Role, User } from 'src/auth/entities/user.entity';
import { randomBytes } from 'crypto'; // Import for generating passwords

@Injectable()
export class DepartmentService {
  constructor(
    @InjectRepository(Department)
    private readonly departmentRepository: Repository<Department>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  /**
   * Get a department by ID
   * @param id - Department ID
   * @returns - Department or null
   */
  async getDepartmentById(id: number): Promise<Department | null> {
    return this.departmentRepository.findOne({
      where: { id },
      relations: ['employees', 'manager'],
    });
  }

  /**
   * Create a new employee in a department
   * @param employeeData - Employee creation data
   * @returns - Created employee
   */
  async createEmployee({
    departmentId,
    email,
    firstName,
    lastName,
    role,
  }: {
    departmentId: number;
    email: string;
    firstName?: string;
    lastName?: string;
    role: Role;
  }): Promise<User> {
    const department = await this.departmentRepository.findOne({
      where: { id: departmentId },
    });

    if (!department) {
      throw new NotFoundException(
        `Department with ID ${departmentId} not found`,
      );
    }

    // Generate an 8-character random password
    const password = randomBytes(4).toString('hex'); // 4 bytes = 8 hex characters

    const newEmployee = this.userRepository.create({
      email,
      firstName,
      lastName,
      password,
      role,
      department,
    });

    // Save the new employee to the database
    const savedEmployee = await this.userRepository.save(newEmployee);

    // Optionally log or return the generated password
    console.log(`Generated password for ${email}: ${password}`);

    return savedEmployee;
  }
}
