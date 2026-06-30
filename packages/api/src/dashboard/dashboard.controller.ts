import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@workshopos/shared';
import { RequirePermissions } from '../common/decorators';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboard: DashboardService) {}

  @Get() @RequirePermissions(PERMISSIONS.REPORT_VIEW)
  summary() {
    return this.dashboard.summary();
  }
}
