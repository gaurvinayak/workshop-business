import { z } from 'zod';

export const createDepartmentSchema = z.object({ name: z.string().min(1) });
export type CreateDepartmentInput = z.infer<typeof createDepartmentSchema>;

export const createDesignationSchema = z.object({ name: z.string().min(1) });
export type CreateDesignationInput = z.infer<typeof createDesignationSchema>;

export const employeeStatusEnum = z.enum(['ACTIVE', 'INACTIVE', 'LEFT']);
export type EmployeeStatus = z.infer<typeof employeeStatusEnum>;

export const createEmployeeSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(2),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  dateOfBirth: z.string().date().optional(),
  dateJoined: z.string().date(),
  departmentId: z.string().uuid().optional().nullable(),
  designationId: z.string().uuid().optional().nullable(),
  // Sensitive — only returned/editable with employee.view_sensitive.
  bankAccount: z.string().optional(),
  bankIfsc: z.string().optional(),
  taxId: z.string().optional(),
});
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;

export const updateEmployeeSchema = createEmployeeSchema.partial().extend({
  status: employeeStatusEnum.optional(),
  dateLeft: z.string().date().optional().nullable(),
});
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
