import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

const ADMIN_EMAIL = 'admin.markethub@gmail.com';

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
    }),
  });

  const terminal = createInterface({ input: stdin, output: stdout });

  try {
    const user = await prisma.user.findUnique({
      where: { email: ADMIN_EMAIL },
      select: {
        id: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      throw new Error(`Account ${ADMIN_EMAIL} was not found.`);
    }

    if (user.role === 'ADMIN') {
      console.log('This account is already an administrator.');
      return;
    }

    const confirmation = await terminal.question(
      `Promote ${ADMIN_EMAIL} to ADMIN in the connected database? Type PROMOTE ADMIN to confirm: `,
    );

    if (confirmation !== 'PROMOTE ADMIN') {
      console.log('Cancelled. No database changes were made.');
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
      select: {
        email: true,
        role: true,
      },
    });

    console.log('Administrator role assigned successfully.');
    console.log(`Account: ${updatedUser.email}`);
    console.log(`Role: ${updatedUser.role}`);
  } finally {
    terminal.close();
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Admin setup failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});