import { Injectable } from '@nestjs/common';
import {
  AppError,
  CorrectAttendanceInput,
  CreateShiftInput,
  CreateLeaveTypeInput,
  CreateLeaveRequestInput,
  CreateHolidayInput,
  toLocalDateString,
  minutesBetween,
} from '@workshopos/shared';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_EXPECTED_MINUTES = 480; // 8h when no shift assigned

function shiftExpectedMinutes(start: string, end: string, breakMins: number): number {
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  let mins = eh * 60 + em - (sh * 60 + sm);
  if (mins < 0) mins += 24 * 60; // overnight shift
  return Math.max(0, mins - breakMins);
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  private async timezone(): Promise<string> {
    const biz = await this.prisma.businessSetting.findFirst();
    return biz?.timezone ?? 'UTC';
  }

  private async resolveEmployeeId(explicit: string | undefined, userId: string): Promise<string> {
    if (explicit) return explicit;
    const emp = await this.prisma.employee.findUnique({ where: { userId } });
    if (!emp) throw AppError.validation('Your login is not linked to an employee record');
    return emp.id;
  }

  /** Clock in (first punch) or clock out (second punch) for the local day. */
  async clock(params: { employeeId?: string; at?: string }, userId: string) {
    const employeeId = await this.resolveEmployeeId(params.employeeId, userId);
    const tz = await this.timezone();
    const at = params.at ? new Date(params.at) : new Date();
    const localDate = toLocalDateString(at, tz);
    const date = new Date(localDate);

    const existing = await this.prisma.attendance.findUnique({
      where: { employeeId_date: { employeeId, date } },
    });

    if (!existing || !existing.checkIn) {
      return this.prisma.attendance.upsert({
        where: { employeeId_date: { employeeId, date } },
        create: { employeeId, date, checkIn: at, status: 'PRESENT', source: params.employeeId ? 'kiosk' : 'self' },
        update: { checkIn: at, status: 'PRESENT' },
      });
    }

    if (existing.checkOut) throw AppError.conflict('Already clocked out for today');

    const expected = await this.expectedMinutes(employeeId, date);
    const worked = Math.max(0, minutesBetween(existing.checkIn, at));
    const overtime = Math.max(0, worked - expected);
    return this.prisma.attendance.update({
      where: { id: existing.id },
      data: { checkOut: at, workedMinutes: worked, overtimeMinutes: overtime },
    });
  }

  private async expectedMinutes(employeeId: string, date: Date): Promise<number> {
    const assign = await this.prisma.employeeShift.findFirst({
      where: { employeeId, effectiveFrom: { lte: date } },
      orderBy: { effectiveFrom: 'desc' },
      include: { shift: true },
    });
    if (!assign) return DEFAULT_EXPECTED_MINUTES;
    return shiftExpectedMinutes(assign.shift.startTime, assign.shift.endTime, assign.shift.breakMinutes);
  }

  async list(params: { from?: string; to?: string; employeeId?: string }) {
    return this.prisma.attendance.findMany({
      where: {
        employeeId: params.employeeId,
        date: {
          gte: params.from ? new Date(params.from) : undefined,
          lte: params.to ? new Date(params.to) : undefined,
        },
      },
      orderBy: [{ date: 'desc' }, { employeeId: 'asc' }],
      include: { employee: { select: { code: true, name: true } } },
    });
  }

  /** Supervisor manual correction; the reason is stored and audit-logged. */
  async correct(input: CorrectAttendanceInput, userId: string) {
    const date = new Date(input.date);
    const checkIn = input.checkIn ? new Date(input.checkIn) : null;
    const checkOut = input.checkOut ? new Date(input.checkOut) : null;
    const expected = await this.expectedMinutes(input.employeeId, date);
    const worked = checkIn && checkOut ? Math.max(0, minutesBetween(checkIn, checkOut)) : 0;
    const overtime = Math.max(0, worked - expected);

    return this.prisma.attendance.upsert({
      where: { employeeId_date: { employeeId: input.employeeId, date } },
      create: {
        employeeId: input.employeeId,
        date,
        status: input.status,
        checkIn,
        checkOut,
        workedMinutes: worked,
        overtimeMinutes: overtime,
        source: 'manual',
        note: `${input.reason} (by ${userId})`,
      },
      update: {
        status: input.status,
        checkIn,
        checkOut,
        workedMinutes: worked,
        overtimeMinutes: overtime,
        source: 'manual',
        note: `${input.reason} (by ${userId})`,
      },
    });
  }

  /** Monthly muster grid: employees × days. */
  async monthlySheet(month: string) {
    const start = new Date(`${month}-01`);
    const end = new Date(start);
    end.setMonth(end.getMonth() + 1);
    const [employees, records] = await Promise.all([
      this.prisma.employee.findMany({ where: { status: 'ACTIVE' }, orderBy: { code: 'asc' }, select: { id: true, code: true, name: true } }),
      this.prisma.attendance.findMany({ where: { date: { gte: start, lt: end } } }),
    ]);
    const byEmp = new Map<string, Record<string, string>>();
    for (const r of records) {
      const day = r.date.toISOString().slice(8, 10);
      if (!byEmp.has(r.employeeId)) byEmp.set(r.employeeId, {});
      byEmp.get(r.employeeId)![day] = r.status;
    }
    return {
      month,
      employees: employees.map((e) => ({ ...e, days: byEmp.get(e.id) ?? {} })),
    };
  }

  // ---- Shifts ----
  listShifts() {
    return this.prisma.shift.findMany({ orderBy: { name: 'asc' } });
  }
  createShift(input: CreateShiftInput) {
    return this.prisma.shift.create({ data: input });
  }
  assignShift(input: { employeeId: string; shiftId: string; effectiveFrom: string }) {
    return this.prisma.employeeShift.create({
      data: { employeeId: input.employeeId, shiftId: input.shiftId, effectiveFrom: new Date(input.effectiveFrom) },
    });
  }

  // ---- Holidays ----
  listHolidays() {
    return this.prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  }
  createHoliday(input: CreateHolidayInput) {
    return this.prisma.holiday.create({ data: { date: new Date(input.date), name: input.name } });
  }

  // ---- Leave ----
  listLeaveTypes() {
    return this.prisma.leaveType.findMany({ orderBy: { name: 'asc' } });
  }
  createLeaveType(input: CreateLeaveTypeInput) {
    return this.prisma.leaveType.create({ data: input });
  }

  async createLeaveRequest(input: CreateLeaveRequestInput, userId: string) {
    const employeeId = await this.resolveEmployeeId(input.employeeId, userId);
    const from = new Date(input.fromDate);
    const to = new Date(input.toDate);
    const days = Math.floor((to.getTime() - from.getTime()) / 86400000) + 1;
    return this.prisma.leaveRequest.create({
      data: {
        employeeId,
        leaveTypeId: input.leaveTypeId,
        fromDate: from,
        toDate: to,
        days,
        reason: input.reason,
      },
    });
  }

  async listLeaveRequests() {
    return this.prisma.leaveRequest.findMany({
      orderBy: { createdAt: 'desc' },
      include: { employee: { select: { code: true, name: true } }, leaveType: true },
    });
  }

  async decideLeave(id: string, approve: boolean, approverId: string) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } });
    if (!req) throw AppError.notFound('Leave request');
    if (req.status !== 'PENDING') throw AppError.conflict('Leave request already decided');
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status: approve ? 'APPROVED' : 'REJECTED', approverId },
    });
  }
}
