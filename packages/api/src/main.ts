import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { loadEnv } from './config/env';

async function bootstrap() {
  const env = loadEnv();
  const app = await NestFactory.create(AppModule, { bufferLogs: false });

  app.setGlobalPrefix('api/v1');
  app.use(cookieParser());
  app.enableCors({
    origin: env.WEB_ORIGIN.split(',').map((o) => o.trim()),
    credentials: true,
  });
  // Validation is handled per-route by ZodValidationPipe (see common/).

  await app.listen(env.API_PORT);
  Logger.log(`WorkshopOS API listening on :${env.API_PORT}/api/v1`, 'Bootstrap');
}

bootstrap();
