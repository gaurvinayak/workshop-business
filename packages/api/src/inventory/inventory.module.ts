import { Module } from '@nestjs/common';
import { AccountingModule } from '../accounting/accounting.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { StockService } from './stock.service';

@Module({
  imports: [AccountingModule],
  controllers: [InventoryController],
  providers: [InventoryService, StockService],
  exports: [StockService],
})
export class InventoryModule {}
