import { z } from 'zod';

export const roleCodeSchema = z.enum(['owner', 'accounts', 'store', 'supervisor', 'employee']);
export type RoleCodeInput = z.infer<typeof roleCodeSchema>;

export const createUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  roles: z.array(roleCodeSchema).min(1),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = z.object({
  name: z.string().min(2).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export const setUserRolesSchema = z.object({
  roles: z.array(roleCodeSchema).min(1),
});
export type SetUserRolesInput = z.infer<typeof setUserRolesSchema>;

export const resetPasswordSchema = z.object({
  password: z.string().min(8),
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
