import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  createSalaryComponentSchema,
  CreateSalaryComponentInput,
  setSalaryStructureSchema,
  SetSalaryStructureInput,
  createPayrollRunSchema,
  CreatePayrollRunInput,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { PayrollService } from './payroll.service';

@Controller()
export class PayrollController {
  constructor(private readonly payroll: PayrollService) {}

  @Get('salary-components') @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  listComponents() { return this.payroll.listComponents(); }
  @Post('salary-components') @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  createComponent(@Body(new ZodValidationPipe(createSalaryComponentSchema)) body: CreateSalaryComponentInput) { return this.payroll.createComponent(body); }

  @Post('salary-structures') @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  setStructure(@Body(new ZodValidationPipe(setSalaryStructureSchema)) body: SetSalaryStructureInput) { return this.payroll.setStructure(body); }

  @Get('payroll/runs') @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  listRuns() { return this.payroll.listRuns(); }
  @Get('payroll/runs/:id') @RequirePermissions(PERMISSIONS.PAYROLL_VIEW)
  getRun(@Param('id') id: string) { return this.payroll.getRun(id); }
  @Post('payroll/runs') @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  createRun(@Body(new ZodValidationPipe(createPayrollRunSchema)) body: CreatePayrollRunInput) { return this.payroll.createRun(body.period); }
  @Post('payroll/runs/:id/compute') @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  compute(@Param('id') id: string) { return this.payroll.compute(id); }
  @Post('payroll/runs/:id/approve') @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.payroll.approve(id, user.id); }
  @Post('payroll/runs/:id/mark-paid') @RequirePermissions(PERMISSIONS.PAYROLL_MANAGE)
  markPaid(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.payroll.markPaid(id, user.id); }

  @Get('my/payslips') @RequirePermissions(PERMISSIONS.PAYSLIP_SELF)
  myPayslips(@CurrentUser() user: AuthUser) { return this.payroll.myPayslips(user.id); }
}
