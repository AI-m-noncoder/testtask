import type { INestApplication } from '@nestjs/common';

/**
 * Shared between main.ts and e2e tests so both run the app with identical
 * global configuration.
 */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
}
