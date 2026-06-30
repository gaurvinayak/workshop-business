import { z } from 'zod';

// ---- Shifts ----
export const createShiftSchema = z.object({
  name: z.string().min(1),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, 'HH:MM'),
  breakMinutes: z.coerce.number().int().min(0).default(0),
  graceMinutes: z.coerce.number().int().min(0).default(0),
});
export type CreateShiftInput = z.infer<typeof createShiftSchema>;

export const assignShiftSchema = z.object({
  employeeId: z.string().uuid(),
  shiftId: z.string().uuid(),
  effectiveFrom: z.string().date(),
});

// ---- Attendance ----
export const attendanceStatusEnum = z.enum(['PRESENT', 'ABSENT', 'HALF_DAY', 'LEAVE', 'HOLIDAY', 'WEEKLY_OFF']);
export type AttendanceStatus = z.infer<typeof attendanceStatusEnum>;

/** Clock punch — for the logged-in employee or a kiosk. */
export const clockSchema = z.object({
  employeeId: z.string().uuid().optional(), // kiosk supplies it; self-service omits
  at: z.string().datetime().optional(), // defaults to now on the server
});

/** Supervisor manual correction. A reason is required and audit-logged. */
export const correctAttendanceSchema = z.object({
  employeeId: z.string().uuid(),
  date: z.string().date(),
  status: attendanceStatusEnum,
  checkIn: z.string().datetime().optional().nullable(),
  checkOut: z.string().datetime().optional().nullable(),
  reason: z.string().min(3),
});
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;

// ---- Leave ----
export const createLeaveTypeSchema = z.object({
  name: z.string().min(1),
  paid: z.boolean().default(true),
  annualQuota: z.coerce.number().min(0).default(0),
});
export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

export const createLeaveRequestSchema = z
  .object({
    employeeId: z.string().uuid().optional(),
    leaveTypeId: z.string().uuid(),
    fromDate: z.string().date(),
    toDate: z.string().date(),
    reason: z.string().optional(),
  })
  .refine((v) => v.toDate >= v.fromDate, { message: 'End date must be on or after start date', path: ['toDate'] });
export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

export const createHolidaySchema = z.object({
  date: z.string().date(),
  name: z.string().min(1),
});
export type CreateHolidayInput = z.infer<typeof createHolidaySchema>;
