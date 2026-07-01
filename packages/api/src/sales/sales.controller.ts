import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  createCustomerSchema,
  CreateCustomerInput,
  createInvoiceSchema,
  CreateInvoiceInput,
  paymentReceiptSchema,
  PaymentReceiptInput,
  createQuotationSchema,
  CreateQuotationInput,
  createCreditNoteSchema,
  CreateCreditNoteInput,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { SalesService } from './sales.service';

@Controller()
export class SalesController {
  constructor(private readonly sales: SalesService) {}

  @Get('customers') @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  listCustomers() { return this.sales.listCustomers(); }
  @Get('customers/:id') @RequirePermissions(PERMISSIONS.CUSTOMER_VIEW)
  getCustomer(@Param('id') id: string) { return this.sales.getCustomer(id); }
  @Post('customers') @RequirePermissions(PERMISSIONS.CUSTOMER_MANAGE)
  createCustomer(@Body(new ZodValidationPipe(createCustomerSchema)) body: CreateCustomerInput) { return this.sales.createCustomer(body); }

  @Get('invoices') @RequirePermissions(PERMISSIONS.SALES_VIEW)
  listInvoices(@Query('customerId') customerId?: string, @Query('status') status?: string) {
    return this.sales.listInvoices({ customerId, status });
  }
  @Get('invoices/:id') @RequirePermissions(PERMISSIONS.SALES_VIEW)
  getInvoice(@Param('id') id: string) { return this.sales.getInvoice(id); }
  @Post('invoices') @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  createInvoice(@Body(new ZodValidationPipe(createInvoiceSchema)) body: CreateInvoiceInput) { return this.sales.createInvoice(body); }
  @Post('invoices/:id/post') @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  postInvoice(@Param('id') id: string, @CurrentUser() user: AuthUser) { return this.sales.postInvoice(id, user.id); }

  @Post('payment-receipts') @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  receivePayment(@Body(new ZodValidationPipe(paymentReceiptSchema)) body: PaymentReceiptInput, @CurrentUser() user: AuthUser) {
    return this.sales.receivePayment(body, user.id);
  }

  // ---- Quotations ----
  @Get('quotations') @RequirePermissions(PERMISSIONS.SALES_VIEW)
  listQuotations() { return this.sales.listQuotations(); }
  @Post('quotations') @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  createQuotation(@Body(new ZodValidationPipe(createQuotationSchema)) body: CreateQuotationInput) { return this.sales.createQuotation(body); }
  @Post('quotations/:id/convert') @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  convertQuotation(@Param('id') id: string) { return this.sales.convertQuotation(id); }

  // ---- Credit notes (sales returns) ----
  @Get('credit-notes') @RequirePermissions(PERMISSIONS.SALES_VIEW)
  listCreditNotes() { return this.sales.listCreditNotes(); }
  @Post('credit-notes') @RequirePermissions(PERMISSIONS.SALES_MANAGE)
  createCreditNote(@Body(new ZodValidationPipe(createCreditNoteSchema)) body: CreateCreditNoteInput, @CurrentUser() user: AuthUser) {
    return this.sales.createCreditNote(body, user.id);
  }
}
