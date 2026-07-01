import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  createItemSchema,
  CreateItemInput,
  updateItemSchema,
  UpdateItemInput,
  createUomSchema,
  createItemCategorySchema,
  createLocationSchema,
  stockAdjustmentSchema,
  StockAdjustmentInput,
  stockTransferSchema,
  StockTransferInput,
  createStockCountSchema,
  CreateStockCountInput,
  paginationQuerySchema,
  PaginationQuery,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { InventoryService } from './inventory.service';

@Controller()
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}

  // ---- Reference data ----
  @Get('uoms') @RequirePermissions(PERMISSIONS.ITEM_VIEW)
  listUoms() { return this.inventory.listUoms(); }
  @Post('uoms') @RequirePermissions(PERMISSIONS.ITEM_MANAGE)
  createUom(@Body(new ZodValidationPipe(createUomSchema)) body: { name: string; symbol: string }) { return this.inventory.createUom(body); }

  @Get('item-categories') @RequirePermissions(PERMISSIONS.ITEM_VIEW)
  listCategories() { return this.inventory.listCategories(); }
  @Post('item-categories') @RequirePermissions(PERMISSIONS.ITEM_MANAGE)
  createCategory(@Body(new ZodValidationPipe(createItemCategorySchema)) body: { name: string; parentId?: string | null }) { return this.inventory.createCategory(body); }

  @Get('locations') @RequirePermissions(PERMISSIONS.ITEM_VIEW)
  listLocations() { return this.inventory.listLocations(); }
  @Post('locations') @RequirePermissions(PERMISSIONS.ITEM_MANAGE)
  createLocation(@Body(new ZodValidationPipe(createLocationSchema)) body: { name: string; type?: 'STORE' | 'WORKSHOP' | 'SCRAP' }) { return this.inventory.createLocation(body); }

  // ---- Items ----
  @Get('items') @RequirePermissions(PERMISSIONS.ITEM_VIEW)
  listItems(
    @Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.inventory.listItems(q, { type, search });
  }
  @Get('items/:id') @RequirePermissions(PERMISSIONS.ITEM_VIEW)
  getItem(@Param('id') id: string) { return this.inventory.getItem(id); }
  @Get('items/:id/movements') @RequirePermissions(PERMISSIONS.STOCK_VIEW)
  movements(@Param('id') id: string) { return this.inventory.itemMovements(id); }
  @Post('items') @RequirePermissions(PERMISSIONS.ITEM_MANAGE)
  createItem(@Body(new ZodValidationPipe(createItemSchema)) body: CreateItemInput) { return this.inventory.createItem(body); }
  @Patch('items/:id') @RequirePermissions(PERMISSIONS.ITEM_MANAGE)
  updateItem(@Param('id') id: string, @Body(new ZodValidationPipe(updateItemSchema)) body: UpdateItemInput) { return this.inventory.updateItem(id, body); }

  // ---- Stock ----
  @Get('stock') @RequirePermissions(PERMISSIONS.STOCK_VIEW)
  stock(@Query('locationId') locationId?: string, @Query('lowStock') lowStock?: string) {
    return this.inventory.stockLevels({ locationId, lowStock: lowStock === 'true' });
  }
  @Post('stock/adjustments') @RequirePermissions(PERMISSIONS.STOCK_MANAGE)
  adjust(@Body(new ZodValidationPipe(stockAdjustmentSchema)) body: StockAdjustmentInput, @CurrentUser() user: AuthUser) {
    return this.inventory.adjust(body, user.id);
  }
  @Post('stock/transfers') @RequirePermissions(PERMISSIONS.STOCK_MANAGE)
  transfer(@Body(new ZodValidationPipe(stockTransferSchema)) body: StockTransferInput, @CurrentUser() user: AuthUser) {
    return this.inventory.transfer(body, user.id);
  }

  @Get('stock/counts') @RequirePermissions(PERMISSIONS.STOCK_VIEW)
  listCounts() { return this.inventory.listStockCounts(); }
  @Post('stock/counts') @RequirePermissions(PERMISSIONS.STOCK_MANAGE)
  count(@Body(new ZodValidationPipe(createStockCountSchema)) body: CreateStockCountInput, @CurrentUser() user: AuthUser) {
    return this.inventory.stockCount(body, user.id);
  }
}
