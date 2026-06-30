import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  createEmployeeSchema,
  CreateEmployeeInput,
  updateEmployeeSchema,
  UpdateEmployeeInput,
  createDepartmentSchema,
  CreateDepartmentInput,
  createDesignationSchema,
  CreateDesignationInput,
  paginationQuerySchema,
  PaginationQuery,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { HrService } from './hr.service';

@Controller()
export class HrController {
  constructor(private readonly hr: HrService) {}

  // ---- Departments & designations ----
  @Get('departments')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  listDepartments() {
    return this.hr.listDepartments();
  }
  @Post('departments')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  createDepartment(@Body(new ZodValidationPipe(createDepartmentSchema)) body: CreateDepartmentInput) {
    return this.hr.createDepartment(body);
  }
  @Get('designations')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  listDesignations() {
    return this.hr.listDesignations();
  }
  @Post('designations')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  createDesignation(@Body(new ZodValidationPipe(createDesignationSchema)) body: CreateDesignationInput) {
    return this.hr.createDesignation(body);
  }

  // ---- Employees ----
  @Get('employees')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery, @CurrentUser() user: AuthUser) {
    return this.hr.list(q, this.canSensitive(user));
  }

  @Get('employees/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_VIEW)
  get(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.hr.get(id, this.canSensitive(user));
  }

  @Post('employees')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  create(@Body(new ZodValidationPipe(createEmployeeSchema)) body: CreateEmployeeInput) {
    return this.hr.create(body);
  }

  @Patch('employees/:id')
  @RequirePermissions(PERMISSIONS.EMPLOYEE_MANAGE)
  update(@Param('id') id: string, @Body(new ZodValidationPipe(updateEmployeeSchema)) body: UpdateEmployeeInput) {
    return this.hr.update(id, body);
  }

  private canSensitive(user: AuthUser): boolean {
    return user.permissions.includes(PERMISSIONS.EMPLOYEE_VIEW_SENSITIVE);
  }
}
