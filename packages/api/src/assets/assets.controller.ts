import { Body, Controller, Get, Post } from '@nestjs/common';
import { PERMISSIONS, createFixedAssetSchema, CreateFixedAssetInput, depreciationRunSchema, DepreciationRunInput } from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { AssetsService } from './assets.service';

@Controller()
export class AssetsController {
  constructor(private readonly assets: AssetsService) {}

  @Get('fixed-assets') @RequirePermissions(PERMISSIONS.ASSET_VIEW)
  list() { return this.assets.list(); }
  @Post('fixed-assets') @RequirePermissions(PERMISSIONS.ASSET_MANAGE)
  create(@Body(new ZodValidationPipe(createFixedAssetSchema)) body: CreateFixedAssetInput, @CurrentUser() user: AuthUser) {
    return this.assets.create(body, user.id);
  }
  @Post('fixed-assets/depreciation') @RequirePermissions(PERMISSIONS.ASSET_MANAGE)
  depreciate(@Body(new ZodValidationPipe(depreciationRunSchema)) body: DepreciationRunInput, @CurrentUser() user: AuthUser) {
    return this.assets.runDepreciation(body.period, user.id);
  }
}
