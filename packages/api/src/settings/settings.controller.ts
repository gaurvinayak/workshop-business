import { Controller, Get } from '@nestjs/common';
import { PERMISSIONS } from '@workshopos/shared';
import { RequirePermissions } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly prisma: PrismaService) {}

  /** Business profile — used for invoice/payslip letterheads and headers. */
  @Get()
  @RequirePermissions(PERMISSIONS.SETTINGS_VIEW)
  async get() {
    const biz = await this.prisma.businessSetting.findFirst();
    const fy = await this.prisma.fiscalYear.findFirst({ where: { status: 'OPEN' }, orderBy: { startDate: 'desc' } });
    return {
      business: biz
        ? { name: biz.name, currency: biz.currency, timezone: biz.timezone, taxId: biz.taxId, logoUrl: biz.logoUrl }
        : null,
      fiscalYear: fy ? { name: fy.name, startDate: fy.startDate, endDate: fy.endDate } : null,
    };
  }
}
