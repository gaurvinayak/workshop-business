import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  createSupplierSchema,
  CreateSupplierInput,
  createPurchaseOrderSchema,
  CreatePurchaseOrderInput,
  goodsReceiptSchema,
  GoodsReceiptInput,
  supplierPaymentSchema,
  SupplierPaymentInput,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { PurchasingService } from './purchasing.service';

@Controller()
export class PurchasingController {
  constructor(private readonly purchasing: PurchasingService) {}

  @Get('suppliers') @RequirePermissions(PERMISSIONS.SUPPLIER_VIEW)
  listSuppliers() { return this.purchasing.listSuppliers(); }
  @Get('suppliers/:id') @RequirePermissions(PERMISSIONS.SUPPLIER_VIEW)
  getSupplier(@Param('id') id: string) { return this.purchasing.getSupplier(id); }
  @Post('suppliers') @RequirePermissions(PERMISSIONS.SUPPLIER_MANAGE)
  createSupplier(@Body(new ZodValidationPipe(createSupplierSchema)) body: CreateSupplierInput) { return this.purchasing.createSupplier(body); }

  @Get('purchase-orders') @RequirePermissions(PERMISSIONS.PURCHASE_VIEW)
  listPOs() { return this.purchasing.listPurchaseOrders(); }
  @Get('purchase-orders/:id') @RequirePermissions(PERMISSIONS.PURCHASE_VIEW)
  getPO(@Param('id') id: string) { return this.purchasing.getPurchaseOrder(id); }
  @Post('purchase-orders') @RequirePermissions(PERMISSIONS.PURCHASE_MANAGE)
  createPO(@Body(new ZodValidationPipe(createPurchaseOrderSchema)) body: CreatePurchaseOrderInput) { return this.purchasing.createPurchaseOrder(body); }
  @Post('purchase-orders/:id/receive') @RequirePermissions(PERMISSIONS.PURCHASE_MANAGE)
  receive(@Param('id') id: string, @Body(new ZodValidationPipe(goodsReceiptSchema)) body: GoodsReceiptInput, @CurrentUser() user: AuthUser) {
    return this.purchasing.receive(id, body, user.id);
  }

  @Get('supplier-bills') @RequirePermissions(PERMISSIONS.PURCHASE_VIEW)
  listBills(@Query('supplierId') supplierId?: string, @Query('status') status?: string) {
    return this.purchasing.listBills({ supplierId, status });
  }
  @Post('supplier-payments') @RequirePermissions(PERMISSIONS.PURCHASE_MANAGE)
  pay(@Body(new ZodValidationPipe(supplierPaymentSchema)) body: SupplierPaymentInput, @CurrentUser() user: AuthUser) {
    return this.purchasing.pay(body, user.id);
  }
}
