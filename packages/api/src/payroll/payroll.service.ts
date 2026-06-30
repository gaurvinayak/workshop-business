import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ACCOUNT_CODES,
  AppError,
  CreateSalaryComponentInput,
  SetSalaryStructureInput,
  Money,
  prorate,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';
import { JournalService } from '../accounting/journal.service';

type Tx = Prisma.TransactionClient;

const PAID_STATUSES = new Set(['PRESENT', 'HOLIDAY', 'WEEKLY_OFF', 'LEAVE']);

@Injectable()
export class PayrollService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly journal: JournalService,
  ) {}

  // ---- Components & structures ----
  listComponents() {
    return this.prisma.salaryComponent.findMany({ orderBy: { name: 'asc' } });
  }
  createComponent(input: CreateSalaryComponentInput) {
    return this.prisma.salaryComponent.create({ data: input });
  }

  async setStructure(input: SetSalaryStructureInput) {
    return this.prisma.$transaction(async (tx) => {
      await tx.salaryStructure.updateMany({ where: { employeeId: input.employeeId, isActive: true }, data: { isActive: false } });
      return tx.salaryStructure.create({
        data: {
          employeeId: input.employeeId,
          effectiveFrom: new Date(input.effectiveFrom),
          isActive: true,
          lines: { create: input.lines.map((l) => ({ componentId: l.componentId, amountOrRate: l.amountOrRate })) },
        },
        include: { lines: true },
      });
    });
  }

  // ---- Payroll runs ----
  async createRun(period: string) {
    const existing = await this.prisma.payrollRun.findUnique({ where: { period } });
    if (existing) throw AppError.conflict(`A payroll run for ${period} already exists`);
    const run = await this.prisma.payrollRun.create({ data: { period } });
    return this.compute(run.id);
  }

  /** (Re)compute payslips for a draft run from salary structures + attendance. */
  async compute(runId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runId } });
      if (!run) throw AppError.notFound('Payroll run');
      if (run.status !== 'DRAFT') throw AppError.conflict('Only draft runs can be recomputed');

      const [year, month] = run.period.split('-').map(Number);
      const start = new Date(Date.UTC(year, month - 1, 1));
      const nextMonth = new Date(Date.UTC(year, month, 1));
      const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

      // Clear previous payslips.
      await tx.payslip.deleteMany({ where: { runId } });

      const employees = await tx.employee.findMany({
        where: { status: 'ACTIVE' },
        include: { salaryStructs: { where: { isActive: true }, include: { lines: { include: { component: true } } } } },
      });

      let grossTotal = Money.zero();
      let netTotal = Money.zero();

      for (const emp of employees) {
        const structure = emp.salaryStructs[0];
        if (!structure) continue;

        // Attendance-driven paid days.
        const attendance = await tx.attendance.findMany({ where: { employeeId: emp.id, date: { gte: start, lt: nextMonth } } });
        let paidDays = daysInMonth;
        let overtimeMinutes = 0;
        if (attendance.length > 0) {
          paidDays = 0;
          for (const a of attendance) {
            if (a.status === 'HALF_DAY') paidDays += 0.5;
            else if (PAID_STATUSES.has(a.status)) paidDays += 1;
            overtimeMinutes += a.overtimeMinutes;
          }
        }
        const lopDays = Math.max(0, daysInMonth - paidDays);

        // Basic (for percent-of-basic components), prorated.
        const basicLine = structure.lines.find((l) => l.component.name.toLowerCase() === 'basic');
        const basicFull = Money.of(basicLine?.amountOrRate.toString() ?? '0');

        let gross = Money.zero();
        let deductions = Money.zero();
        const payslipLines: { componentId: string; type: 'EARNING' | 'DEDUCTION'; amount: string }[] = [];

        for (const line of structure.lines) {
          const full =
            line.component.calc === 'PERCENT_OF_BASIC'
              ? basicFull.percent(line.amountOrRate.toString())
              : Money.of(line.amountOrRate.toString());
          const amount = prorate(full.toString(), paidDays, daysInMonth);
          payslipLines.push({ componentId: line.componentId, type: line.component.type, amount: amount.toString() });
          if (line.component.type === 'EARNING') gross = gross.add(amount);
          else deductions = deductions.add(amount);
        }

        const net = gross.subtract(deductions);
        grossTotal = grossTotal.add(gross);
        netTotal = netTotal.add(net);

        await tx.payslip.create({
          data: {
            runId,
            employeeId: emp.id,
            paidDays: paidDays.toFixed(2),
            lopDays: lopDays.toFixed(2),
            overtimeMinutes,
            gross: gross.toString(),
            totalDeductions: deductions.toString(),
            net: net.toString(),
            lines: { create: payslipLines },
          },
        });
      }

      await tx.payrollRun.update({ where: { id: runId }, data: { grossTotal: grossTotal.toString(), netTotal: netTotal.toString() } });
      return this.getRunTx(tx, runId);
    });
  }

  async approve(runId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runId }, include: { payslips: true } });
      if (!run) throw AppError.notFound('Payroll run');
      if (run.status !== 'DRAFT') throw AppError.conflict('Run is not in draft');
      if (run.payslips.length === 0) throw AppError.validation('Run has no payslips to approve');

      const gross = Money.of(run.grossTotal.toString());
      const net = Money.of(run.netTotal.toString());
      const deductions = gross.subtract(net);

      const [expense, salaryPayable, statutoryPayable] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.SALARY_EXPENSE),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.SALARY_PAYABLE),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.STATUTORY_PAYABLE),
      ]);

      const entry = await this.journal.postWithinTransaction(tx, {
        date: `${run.period}-01`,
        narration: `Payroll ${run.period}`,
        sourceType: 'payroll_run',
        sourceId: run.id,
        postedById: userId,
        lines: [
          { accountId: expense, debit: gross.toString(), credit: '0' },
          ...(deductions.isZero() ? [] : [{ accountId: statutoryPayable, debit: '0', credit: deductions.toString() }]),
          { accountId: salaryPayable, debit: '0', credit: net.toString() },
        ],
      });

      return tx.payrollRun.update({ where: { id: runId }, data: { status: 'APPROVED', approvedById: userId, journalEntryId: entry.id } });
    });
  }

  async markPaid(runId: string, userId: string) {
    return this.prisma.$transaction(async (tx) => {
      const run = await tx.payrollRun.findUnique({ where: { id: runId } });
      if (!run) throw AppError.notFound('Payroll run');
      if (run.status !== 'APPROVED') throw AppError.conflict('Only approved runs can be paid');

      const net = Money.of(run.netTotal.toString());
      const [salaryPayable, bank] = await Promise.all([
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.SALARY_PAYABLE),
        this.journal.accountIdByCode(tx, ACCOUNT_CODES.BANK),
      ]);
      await this.journal.postWithinTransaction(tx, {
        date: `${run.period}-01`,
        narration: `Salary paid ${run.period}`,
        sourceType: 'payroll_payment',
        sourceId: run.id,
        postedById: userId,
        lines: [
          { accountId: salaryPayable, debit: net.toString(), credit: '0' },
          { accountId: bank, debit: '0', credit: net.toString() },
        ],
      });
      return tx.payrollRun.update({ where: { id: runId }, data: { status: 'PAID' } });
    });
  }

  listRuns() {
    return this.prisma.payrollRun.findMany({ orderBy: { period: 'desc' } });
  }
  getRun(runId: string) {
    return this.getRunTx(this.prisma, runId);
  }
  private async getRunTx(tx: Tx | PrismaService, runId: string) {
    const run = await tx.payrollRun.findUnique({
      where: { id: runId },
      include: { payslips: { include: { employee: { select: { code: true, name: true } }, lines: { include: { component: true } } } } },
    });
    if (!run) throw AppError.notFound('Payroll run');
    return run;
  }

  /** Payslips for the logged-in employee. */
  async myPayslips(userId: string) {
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) throw AppError.validation('Your login is not linked to an employee record');
    return this.prisma.payslip.findMany({
      where: { employeeId: emp.id },
      orderBy: { run: { period: 'desc' } },
      include: { run: { select: { period: true, status: true } }, lines: { include: { component: true } } },
    });
  }
}
