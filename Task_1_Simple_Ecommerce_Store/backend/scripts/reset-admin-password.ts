
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

async function main(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('This development password reset is disabled in production.');
  }

  const email = process.argv[2]?.trim().toLowerCase();

  if (!email) {
    throw new Error(
      'Usage: npx tsx scripts/reset-admin-password.ts admin@example.com',
    );
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });

  const readline = createInterface({ input: stdin, output: stdout });

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new Error('No account exists with that email.');
    }

    if (user.role !== 'ADMIN') {
      throw new Error('This account is not an ADMIN account.');
    }

    const password = await readline.question(
      'Enter a new admin password (minimum 12 characters): ',
    );

    if (password.length < 12 || password.length > 72) {
      throw new Error('Password must contain 12–72 characters.');
    }

    const confirmation = await readline.question(
      'Confirm the new password: ',
    );

    if (password !== confirmation) {
      throw new Error('Passwords do not match. No changes were made.');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: { password: passwordHash },
    });

    console.log(`Password updated successfully for ${user.email}.`);
  } finally {
    readline.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Password reset failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});
