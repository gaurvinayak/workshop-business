import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  createAccountSchema,
  CreateAccountInput,
  createJournalEntrySchema,
  CreateJournalEntryInput,
  paginationQuerySchema,
  PaginationQuery,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { AccountsService } from './accounts.service';
import { JournalService } from './journal.service';

@Controller()
export class AccountingController {
  constructor(
    private readonly accounts: AccountsService,
    private readonly journal: JournalService,
  ) {}

  // ---- Chart of accounts ----
  @Get('accounts')
  @RequirePermissions(PERMISSIONS.ACCOUNT_VIEW)
  listAccounts() {
    return this.accounts.list();
  }

  @Post('accounts')
  @RequirePermissions(PERMISSIONS.ACCOUNT_MANAGE)
  createAccount(@Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput) {
    return this.accounts.create(body);
  }

  @Get('accounts/:id/ledger')
  @RequirePermissions(PERMISSIONS.JOURNAL_VIEW)
  ledger(@Param('id') id: string) {
    return this.accounts.ledger(id);
  }

  // ---- Journal ----
  @Get('journal-entries')
  @RequirePermissions(PERMISSIONS.JOURNAL_VIEW)
  listEntries(@Query(new ZodValidationPipe(paginationQuerySchema)) q: PaginationQuery) {
    return this.journal.list(q);
  }

  @Get('journal-entries/:id')
  @RequirePermissions(PERMISSIONS.JOURNAL_VIEW)
  getEntry(@Param('id') id: string) {
    return this.journal.get(id);
  }

  @Post('journal-entries')
  @RequirePermissions(PERMISSIONS.JOURNAL_POST)
  postEntry(
    @Body(new ZodValidationPipe(createJournalEntrySchema)) body: CreateJournalEntryInput,
    @CurrentUser() user: AuthUser,
  ) {
    return this.journal.postManual(body, user.id);
  }
}
