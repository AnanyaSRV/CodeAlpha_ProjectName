
import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

const TARGET_EMAIL = 'admin.markethub@gmail.com';

async function main() {
  const password = process.env.ADMIN_RESET_PASSWORD;

  if (!password || password.length < 8 || password.length > 72) {
    throw new Error('Password must contain between 8 and 72 characters.');
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });

  const prisma = new PrismaClient({ adapter });

  try {
    const admins = await prisma.user.findMany({
      where: { role: 'ADMIN' },
      select: {
        id: true,
        email: true,
      },
    });

    if (admins.length === 0) {
      throw new Error('No existing ADMIN account was found.');
    }

    if (admins.length > 1) {
      throw new Error(
        'Multiple ADMIN accounts exist. Stop and identify the intended account before changing credentials.',
      );
    }

    const admin = admins[0];

    const existingEmail = await prisma.user.findUnique({
      where: { email: TARGET_EMAIL },
      select: { id: true },
    });

    if (existingEmail && existingEmail.id !== admin.id) {
      throw new Error(
        'The target email already belongs to another account. No changes were made.',
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: TARGET_EMAIL,
        password: passwordHash,
        role: 'ADMIN',
      },
    });

    console.log('Admin credentials updated successfully.');
    console.log(`Admin email: ${TARGET_EMAIL}`);
    console.log('Admin role: ADMIN');
    console.log('Password: updated and securely hashed.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : 'Admin reset failed.',
  );
  process.exitCode = 1;
});
