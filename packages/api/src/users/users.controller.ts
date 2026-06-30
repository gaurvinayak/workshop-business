import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS, paginationQuerySchema, PaginationQuery } from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions } from '../common/decorators';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @RequirePermissions(PERMISSIONS.USER_VIEW)
  list(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) {
    return this.users.list(q);
  }
}
