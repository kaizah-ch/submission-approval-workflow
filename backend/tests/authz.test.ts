import request from 'supertest';
import bcrypt from 'bcryptjs';
import { app } from '../src/app';
import { prisma } from '../src/config/prisma';

async function token(email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'Password123!' });
  return res.body.token as string;
}

// Distinct fixtures per concern so state-changing tests stay isolated from
// the read-only authorization checks.
let applicantToken: string;
let otherApplicantToken: string;
let reviewerToken: string;
let reviewerId: string;

beforeAll(async () => {
  const passwordHash = await bcrypt.hash('Password123!', 10);
  await prisma.auditLog.deleteMany();
  await prisma.application.deleteMany();
  await prisma.user.deleteMany();

  const applicant = await prisma.user.create({ data: { name: 'Applicant', email: 'applicant@test.com', passwordHash, role: 'APPLICANT' } });
  const otherApplicant = await prisma.user.create({ data: { name: 'Other Applicant', email: 'other@test.com', passwordHash, role: 'APPLICANT' } });
  const reviewer = await prisma.user.create({ data: { name: 'Reviewer', email: 'reviewer@test.com', passwordHash, role: 'REVIEWER' } });
  reviewerId = reviewer.id;

  await prisma.application.createMany({
    data: [
      { id: 'submitted-readonly', title: 'Submitted (read-only)', category: 'GRANT', status: 'SUBMITTED', ownerId: applicant.id },
      { id: 'approved-app', title: 'Approved', category: 'GRANT', status: 'APPROVED', ownerId: applicant.id },
      { id: 'draft-edit', title: 'Draft to edit', category: 'GRANT', status: 'DRAFT', ownerId: applicant.id },
      { id: 'submitted-approve', title: 'Submitted to approve', category: 'GRANT', status: 'SUBMITTED', ownerId: applicant.id },
      { id: 'other-draft', title: 'Other applicant draft', category: 'GRANT', status: 'DRAFT', ownerId: otherApplicant.id },
    ],
  });

  applicantToken = await token('applicant@test.com');
  otherApplicantToken = await token('other@test.com');
  reviewerToken = await token('reviewer@test.com');
});

afterAll(async () => {
  await prisma.$disconnect();
});

const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('authentication', () => {
  it('rejects a request with no token (401)', async () => {
    const res = await request(app).get('/api/applications/my');
    expect(res.status).toBe(401);
  });

  it('rejects a request with an invalid token (401)', async () => {
    const res = await request(app).get('/api/applications/my').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });
});

describe('role segregation on list endpoints', () => {
  it('blocks a reviewer from the applicant list (403)', async () => {
    const res = await request(app).get('/api/applications/my').set(auth(reviewerToken));
    expect(res.status).toBe(403);
  });

  it('blocks an applicant from the reviewer queue (403)', async () => {
    const res = await request(app).get('/api/reviewer/applications').set(auth(applicantToken));
    expect(res.status).toBe(403);
  });
});

describe('applicant cannot perform reviewer actions directly (403)', () => {
  it.each(['approve', 'reject', 'return', 'under-review'])('rejects applicant calling %s', async (action) => {
    const res = await request(app)
      .post(`/api/reviewer/applications/submitted-readonly/${action}`)
      .set(auth(applicantToken))
      .send({ comment: 'attempting anyway' });
    expect(res.status).toBe(403);
    expect(res.body.message).toBeTruthy();
  });
});

describe('reject and return require a comment (400)', () => {
  it('reviewer reject without a comment is rejected', async () => {
    const res = await request(app).post('/api/reviewer/applications/submitted-readonly/reject').set(auth(reviewerToken)).send({});
    expect(res.status).toBe(400);
  });

  it('reviewer return with a whitespace-only comment is rejected', async () => {
    const res = await request(app).post('/api/reviewer/applications/submitted-readonly/return').set(auth(reviewerToken)).send({ comment: '   ' });
    expect(res.status).toBe(400);
  });
});

describe('query validation', () => {
  it('rejects an unknown status filter with 400 (not 500)', async () => {
    const res = await request(app).get('/api/reviewer/applications?status=GARBAGE').set(auth(reviewerToken));
    expect(res.status).toBe(400);
  });

  it('accepts a valid status filter (200)', async () => {
    const res = await request(app).get('/api/reviewer/applications?status=SUBMITTED').set(auth(reviewerToken));
    expect(res.status).toBe(200);
  });
});

describe('illegal state transitions (409)', () => {
  it('reviewer cannot approve an already-approved application', async () => {
    const res = await request(app).post('/api/reviewer/applications/approved-app/approve').set(auth(reviewerToken)).send({});
    expect(res.status).toBe(409);
  });
});

describe('ownership and editing', () => {
  it('applicant cannot edit an application after it leaves DRAFT (409)', async () => {
    const res = await request(app).put('/api/applications/submitted-readonly').set(auth(applicantToken)).send({ title: 'Edited title', category: 'GRANT' });
    expect(res.status).toBe(409);
  });

  it('an applicant cannot view another applicant\'s application (403)', async () => {
    const res = await request(app).get('/api/applications/other-draft').set(auth(applicantToken));
    expect(res.status).toBe(403);
  });

  it('an applicant cannot edit another applicant\'s application (403)', async () => {
    const res = await request(app).put('/api/applications/other-draft').set(auth(applicantToken)).send({ title: 'Hijacked title', category: 'GRANT' });
    expect(res.status).toBe(403);
  });
});

describe('authorized actions succeed (positive controls)', () => {
  it('owner can edit their own draft (200)', async () => {
    const res = await request(app).put('/api/applications/draft-edit').set(auth(applicantToken)).send({ title: 'Updated draft title', category: 'TRAVEL' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated draft title');
    expect(res.body.status).toBe('DRAFT');
  });

  it('reviewer can approve a submitted application and the transition is audited (200)', async () => {
    const res = await request(app).post('/api/reviewer/applications/submitted-approve/approve').set(auth(reviewerToken)).send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('APPROVED');

    const logs = await prisma.auditLog.findMany({ where: { applicationId: 'submitted-approve' } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ oldStatus: 'SUBMITTED', newStatus: 'APPROVED', performedById: reviewerId });
  });
});
