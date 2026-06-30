import { Body, Controller, Get, Post } from '@nestjs/common';
import { setupSchema, SetupInput } from '@workshopos/shared';
import { ZodValidationPipe } from '../common/zod-validation.pipe';
import { Public } from '../common/decorators';
import { SetupService } from './setup.service';

@Controller('setup')
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  /** Public so the web app can decide whether to show the wizard or login. */
  @Public()
  @Get('status')
  status() {
    return this.setup.status();
  }

  @Public()
  @Post()
  run(@Body(new ZodValidationPipe(setupSchema)) body: SetupInput) {
    return this.setup.run(body);
  }
}
