import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PERMISSIONS, createWorkOrderSchema, CreateWorkOrderInput } from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { ProductionService } from './production.service';

@Controller('work-orders')
export class ProductionController {
  constructor(private readonly production: ProductionService) {}

  @Get() @RequirePermissions(PERMISSIONS.PRODUCTION_VIEW)
  list() { return this.production.list(); }
  @Get(':id') @RequirePermissions(PERMISSIONS.PRODUCTION_VIEW)
  get(@Param('id') id: string) { return this.production.get(id); }
  @Post() @RequirePermissions(PERMISSIONS.PRODUCTION_MANAGE)
  create(@Body(new ZodValidationPipe(createWorkOrderSchema)) body: CreateWorkOrderInput) { return this.production.create(body); }
  @Post(':id/complete') @RequirePermissions(PERMISSIONS.PRODUCTION_MANAGE)
  complete(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.production.complete(id, user.id); }
}
