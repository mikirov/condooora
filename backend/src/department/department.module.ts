import { Module } from '@nestjs/common';
import { DepartmentController } from './department.controller';
import { DepartmentService } from './department.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RoleGuard } from '../auth/guards/role.guard';
import { Department } from './entities/department.entity';
import { User } from 'src/auth/entities/user.entity';
import { TokenAuthGuard } from 'src/auth/guards/auth.guard';
import { JwtService } from '@nestjs/jwt';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [TypeOrmModule.forFeature([Department, User]), HttpModule],
  controllers: [DepartmentController],
  providers: [DepartmentService, TokenAuthGuard, RoleGuard, JwtService],
})
export class DepartmentModule {}
