import { execSync } from 'node:child_process';
import pg from 'pg';

const url =
  process.env.TEST_DATABASE_URL ?? 'postgresql://postgres:postgres@localhost:5433/org_users_test';

/** Creates the test database if needed and applies migrations once per run */
export default async function globalSetup() {
  const target = new URL(url);
  const dbName = target.pathname.slice(1);
  const admin = new URL(url);
  admin.pathname = '/postgres';

  const client = new pg.Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [
      dbName,
    ]);
    if (!rowCount) await client.query(`CREATE DATABASE "${dbName}"`);
  } finally {
    await client.end();
  }

  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'ignore',
  });
}
