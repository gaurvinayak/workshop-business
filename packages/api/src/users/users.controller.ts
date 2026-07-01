import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  paginationQuerySchema,
  PaginationQuery,
  createUserSchema,
  CreateUserInput,
  updateUserSchema,
  UpdateUserInput,
  setUserRolesSchema,
  SetUserRolesInput,
  resetPasswordSchema,
  ResetPasswordInput,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { UsersService } from './users.service';

@Controller()
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get('users')
  @RequirePermissions(PERMISSIONS.USER_VIEW)
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) {
    return this.users.list(q);
  }

  @Get('roles')
  @RequirePermissions(PERMISSIONS.USER_VIEW)
  listRoles() {
    return this.users.listRoles();
  }

  @Post('users')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  create(@Body(new ZodValidationPipe(createUserSchema)) body: CreateUserInput) {
    return this.users.create(body);
  }

  @Patch('users/:id')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  update(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateUserSchema)) body: UpdateUserInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.update(id, body, user.id);
  }

  @Patch('users/:id/roles')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  setRoles(@Param('id') id: string, @Body(new ZodValidationPipe(setUserRolesSchema)) body: SetUserRolesInput) {
    return this.users.setRoles(id, body);
  }

  @Post('users/:id/reset-password')
  @RequirePermissions(PERMISSIONS.USER_MANAGE)
  resetPassword(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(resetPasswordSchema)) body: ResetPasswordInput,
  ) {
    return this.users.resetPassword(id, body);
  }
}
