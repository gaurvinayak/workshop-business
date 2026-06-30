import { Module } from '@nestjs/common';
import { AccountingController } from './accounting.controller';
import { AccountsService } from './accounts.service';
import { JournalService } from './journal.service';

@Module({
  controllers: [AccountingController],
  providers: [AccountsService, JournalService],
  exports: [AccountsService, JournalService],
})
export class AccountingModule {}
