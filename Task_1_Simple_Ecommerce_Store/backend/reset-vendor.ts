import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from './src/generated/prisma/client.js';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const vendorUserId = 'cmvmnvnet0000w0hu2lftq96h';
  const newEmail = 'vendor1.text@example.com';
  const newPassword = 'codsoftintern';
if (
  !vendorUserId.trim() ||
  !newEmail.trim() ||
  !newPassword.trim()
) {
  throw new Error('Vendor ID, email, and password are required.');
}
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured.');
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const email = newEmail.trim().toLowerCase();
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing && existing.id !== vendorUserId) {
      throw new Error('That email is already used by another account.');
    }

    const vendor = await prisma.vendor.findUnique({
      where: { userId: vendorUserId },
    });

    if (!vendor) {
      throw new Error('No vendor profile exists for this user ID.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: vendorUserId  },
      data: { email, password: passwordHash },
    });

    console.log('Vendor email and password updated successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('Vendor account reset failed:', error.message);
  process.exitCode = 1;
});
