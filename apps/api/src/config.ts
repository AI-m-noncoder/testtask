const REQUIRED = ['DATABASE_URL', 'JWT_SECRET'] as const;

/** Fail fast on startup instead of on the first request that needs a missing variable */
export function validateEnv(env: Record<string, unknown>) {
  const missing = REQUIRED.filter((key) => !env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  return env;
}
