import { Controller, Get, Query } from '@nestjs/common';
import { PERMISSIONS } from '@workshopos/shared';
import { RequirePermissions } from '../common/decorators';
import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Get('trial-balance') @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  trialBalance(@Query('asOf') asOf?: string) { return this.reports.trialBalance(asOf); }

  @Get('profit-loss') @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  profitLoss(@Query('from') from?: string, @Query('to') to?: string) { return this.reports.profitAndLoss(from, to); }

  @Get('balance-sheet') @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  balanceSheet(@Query('asOf') asOf?: string) { return this.reports.balanceSheet(asOf); }

  @Get('receivables-aging') @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  receivables() { return this.reports.receivablesAging(); }

  @Get('payables-aging') @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  payables() { return this.reports.payablesAging(); }
}
