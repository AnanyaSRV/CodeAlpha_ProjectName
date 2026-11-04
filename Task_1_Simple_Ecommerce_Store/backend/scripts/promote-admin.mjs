
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const emailArgument = process.argv[2];

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to promote an admin in production.');
  process.exit(1);
}

if (process.env.MARKETHUB_ALLOW_ADMIN_PROMOTION !== 'true') {
  console.error(
    'Promotion is disabled. Set MARKETHUB_ALLOW_ADMIN_PROMOTION=true ' +
      'for this command only, then retry.',
  );
  process.exit(1);
}

if (!emailArgument || !emailArgument.includes('@')) {
  console.error(
    'Usage: node scripts/promote-admin.mjs user@example.com',
  );
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is not configured.');
  process.exit(1);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  }),
});

try {
  const email = emailArgument.trim().toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true },
  });

  if (!user) {
    console.error('No account exists with that email.');
    process.exitCode = 1;
  } else if (user.role === 'ADMIN') {
    console.log('This account is already an admin.');
    console.log(`Account: ${user.email}`);
  } else {
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { role: 'ADMIN' },
      select: { id: true, email: true, role: true },
    });

    console.log('Admin role assigned successfully.');
    console.log(`Account: ${updatedUser.email}`);
    console.log(`Role: ${updatedUser.role}`);
  }
} catch {
  console.error(
    'Admin promotion failed. Check the database connection and account.',
  );
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
