import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  PERMISSIONS,
  clockSchema,
  correctAttendanceSchema,
  CorrectAttendanceInput,
  createShiftSchema,
  CreateShiftInput,
  assignShiftSchema,
  createHolidaySchema,
  CreateHolidayInput,
  createLeaveTypeSchema,
  CreateLeaveTypeInput,
  createLeaveRequestSchema,
  CreateLeaveRequestInput,
} from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { RequirePermissions, CurrentUser, AuthUser } from '../common/decorators';
import { AttendanceService } from './attendance.service';

@Controller()
export class AttendanceController {
  constructor(private readonly attendance: AttendanceService) {}

  @Post('attendance/clock')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_SELF)
  clock(@Body(new ZodValidationPipe(clockSchema)) body: { employeeId?: string; at?: string }, @CurrentUser() user: AuthUser) {
    return this.attendance.clock(body, user.id);
  }

  @Get('attendance')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  list(@Query('from') from?: string, @Query('to') to?: string, @Query('employeeId') employeeId?: string) {
    return this.attendance.list({ from, to, employeeId });
  }

  @Get('attendance/sheet')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  sheet(@Query('month') month: string) {
    return this.attendance.monthlySheet(month);
  }

  @Post('attendance/correct')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  correct(@Body(new ZodValidationPipe(correctAttendanceSchema)) body: CorrectAttendanceInput, @CurrentUser() user: AuthUser) {
    return this.attendance.correct(body, user.id);
  }

  // ---- Shifts ----
  @Get('shifts')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  listShifts() {
    return this.attendance.listShifts();
  }
  @Post('shifts')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  createShift(@Body(new ZodValidationPipe(createShiftSchema)) body: CreateShiftInput) {
    return this.attendance.createShift(body);
  }
  @Post('shifts/assign')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  assignShift(@Body(new ZodValidationPipe(assignShiftSchema)) body: { employeeId: string; shiftId: string; effectiveFrom: string }) {
    return this.attendance.assignShift(body);
  }

  // ---- Holidays ----
  @Get('holidays')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_VIEW)
  listHolidays() {
    return this.attendance.listHolidays();
  }
  @Post('holidays')
  @RequirePermissions(PERMISSIONS.ATTENDANCE_MANAGE)
  createHoliday(@Body(new ZodValidationPipe(createHolidaySchema)) body: CreateHolidayInput) {
    return this.attendance.createHoliday(body);
  }

  // ---- Leave ----
  @Get('leave-types')
  @RequirePermissions(PERMISSIONS.LEAVE_VIEW)
  listLeaveTypes() {
    return this.attendance.listLeaveTypes();
  }
  @Post('leave-types')
  @RequirePermissions(PERMISSIONS.LEAVE_MANAGE)
  createLeaveType(@Body(new ZodValidationPipe(createLeaveTypeSchema)) body: CreateLeaveTypeInput) {
    return this.attendance.createLeaveType(body);
  }
  @Get('leave-requests')
  @RequirePermissions(PERMISSIONS.LEAVE_VIEW)
  listLeaveRequests() {
    return this.attendance.listLeaveRequests();
  }
  @Post('leave-requests')
  @RequirePermissions(PERMISSIONS.LEAVE_REQUEST)
  createLeaveRequest(@Body(new ZodValidationPipe(createLeaveRequestSchema)) body: CreateLeaveRequestInput, @CurrentUser() user: AuthUser) {
    return this.attendance.createLeaveRequest(body, user.id);
  }
  @Post('leave-requests/:id/approve')
  @RequirePermissions(PERMISSIONS.LEAVE_MANAGE)
  approve(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attendance.decideLeave(id, true, user.id);
  }
  @Post('leave-requests/:id/reject')
  @RequirePermissions(PERMISSIONS.LEAVE_MANAGE)
  reject(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.attendance.decideLeave(id, false, user.id);
  }
}
