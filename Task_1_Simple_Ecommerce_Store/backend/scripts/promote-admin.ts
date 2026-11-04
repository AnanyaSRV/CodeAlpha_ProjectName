
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

async function main(): Promise<void> {
  const emailArgument = process.argv[2]?.trim().toLowerCase();

  if (process.env.NODE_ENV === 'production') {
    throw new Error('Admin promotion is disabled in production.');
  }

  if (process.env.MARKETHUB_ALLOW_ADMIN_PROMOTION !== 'true') {
    throw new Error(
      'Set MARKETHUB_ALLOW_ADMIN_PROMOTION=true for this command only.',
    );
  }

  if (
    !emailArgument ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailArgument)
  ) {
    throw new Error(
      'Usage: npx tsx scripts/promote-admin.ts your-admin-email@example.com',
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

  try {
    const user = await prisma.user.findUnique({
      where: { email: emailArgument },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      throw new Error(
        'No account exists with that email. Register the account first.',
      );
    }

    if (user.role === 'ADMIN') {
      console.log('This account is already an admin.');
      console.log(`Account: ${user.email}`);
      return;
    }

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
      select: { email: true, role: true },
    });

    console.log('Admin role assigned successfully.');
    console.log(`Account: ${updatedUser.email}`);
    console.log(`Role: ${updatedUser.role}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    'Admin promotion failed:',
    error instanceof Error ? error.message : 'Unknown error',
  );
  process.exitCode = 1;
});
