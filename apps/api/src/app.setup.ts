import { type INestApplication, ValidationPipe } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { HttpExceptionFilter } from './common/errors/http-exception.filter.js';

/**
 * Shared between main.ts and e2e tests so both run the app with identical
 * global configuration.
 */
export function configureApp(app: INestApplication) {
  // Don't advertise the framework
  (app as NestExpressApplication).disable('x-powered-by');
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
}
