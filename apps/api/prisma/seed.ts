/**
 * CLI seed (`prisma db seed`). Idempotent: does nothing if the database is already
 * seeded, so it is safe to run on every container start.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { seed } from './seed-data.js';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

seed(prisma)
  .then((seeded) => console.log(seeded ? 'Seed: done' : 'Seed: database already seeded, skipping'))
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
