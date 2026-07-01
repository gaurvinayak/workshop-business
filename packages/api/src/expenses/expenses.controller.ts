import { Body, Controller, Get, Post } from '@nestjs/common';
import { PERMISSIONS, createExpenseSchema, CreateExpenseInput } from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { ExpensesService } from './expenses.service';

@Controller('expenses')
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get() @RequirePermissions(PERMISSIONS.EXPENSE_VIEW)
  list() { return this.expenses.list(); }

  @Post() @RequirePermissions(PERMISSIONS.EXPENSE_MANAGE)
  create(@Body(new ZodValidationPipe(createExpenseSchema)) body: CreateExpenseInput, @CurrentUser() user: AuthUser) {
    return this.expenses.create(body, user.id);
  }
}
