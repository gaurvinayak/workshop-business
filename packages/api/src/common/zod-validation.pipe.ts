import { PipeTransform, Injectable } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { AppError } from '@workshopos/shared';

/**
 * Validates request payloads against a zod schema and converts failures into
 * the shared VALIDATION_ERROR envelope (422 with a field map).
 *
 * Usage: @Body(new ZodValidationPipe(createAccountSchema)) body: CreateAccountInput
 */
@Injectable()
export class ZodValidationPipe<T> implements PipeTransform {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      const fields: Record<string, string> = {};
      for (const issue of result.error.issues) {
        fields[issue.path.join('.') || '_'] = issue.message;
      }
      throw AppError.validation('Validation failed', fields);
    }
    return result.data;
  }
}
