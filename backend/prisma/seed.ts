import bcrypt from 'bcryptjs';
import { PrismaClient, Role, ApplicationCategory } from '@prisma/client';

const prisma = new PrismaClient();

// Idempotent seed: upserts make re-runs safe, and `update: {}` intentionally
// leaves existing rows untouched so seeding never overwrites data created during
// a demo (e.g. the sample application's current workflow status is preserved).
async function main() {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  const applicant = await prisma.user.upsert({
    where: { email: 'applicant@example.com' },
    update: {},
    create: { name: 'Amina Applicant', email: 'applicant@example.com', passwordHash, role: Role.APPLICANT },
  });
  await prisma.user.upsert({
    where: { email: 'reviewer@example.com' },
    update: {},
    create: { name: 'Robert Reviewer', email: 'reviewer@example.com', passwordHash, role: Role.REVIEWER },
  });
  await prisma.application.upsert({
    where: { id: 'seed-draft-application' },
    update: {},
    create: {
      id: 'seed-draft-application',
      title: 'Laptop procurement request',
      category: ApplicationCategory.PROCUREMENT,
      description: 'Request for a development laptop for field data analysis.',
      amount: 1500,
      ownerId: applicant.id,
    },
  });
}

main().finally(async () => prisma.$disconnect());
