import { Request, Response } from 'express';
import { ApplicationCategory, ApplicationStatus, Prisma, Role } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../config/prisma';
import { ApiError } from '../utils/apiError';
import { assertTransitionAllowed, WorkflowAction } from '../services/workflowService';

// Whitelists the only client-settable fields. Notably excludes `status` and
// `ownerId`, so a request body can never self-approve or change ownership.
const applicationInputSchema = z.object({
  title: z.string().trim().min(3, 'Title must be at least 3 characters'),
  category: z.nativeEnum(ApplicationCategory),
  description: z.string().trim().optional().nullable(),
  amount: z.coerce.number().positive().optional().nullable(),
});

const commentSchema = z.object({ comment: z.string().trim().optional() });

const reviewerQuerySchema = z.object({
  // Treat an empty string as "no filter"; reject any other unknown value.
  status: z.preprocess((v) => (v === '' ? undefined : v), z.nativeEnum(ApplicationStatus).optional()),
  search: z.string().trim().optional(),
});

export async function createApplication(req: Request, res: Response) {
  if (req.user!.role !== Role.APPLICANT) throw new ApiError(403, 'Only applicants can create applications');
  const body = applicationInputSchema.parse(req.body);
  // Ownership is bound to the authenticated user, never taken from the request body.
  const application = await prisma.application.create({
    data: { ...body, amount: body.amount ?? null, ownerId: req.user!.id },
  });
  res.status(201).json(application);
}

export async function listMyApplications(req: Request, res: Response) {
  if (req.user!.role !== Role.APPLICANT) throw new ApiError(403, 'Only applicants can access this list');
  const applications = await prisma.application.findMany({
    where: { ownerId: req.user!.id },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(applications);
}

export async function listReviewerApplications(req: Request, res: Response) {
  if (req.user!.role !== Role.REVIEWER) throw new ApiError(403, 'Only reviewers can access this queue');
  // Validate the query so an unknown status returns 400 instead of reaching
  // Prisma with an invalid enum (which would surface as a 500).
  const { status, search } = reviewerQuerySchema.parse(req.query);

  // Reviewers only see applications that have left DRAFT. A specific status
  // narrows that down; otherwise we show the full reviewable set.
  const where: Prisma.ApplicationWhereInput = status
    ? { status }
    : { status: { in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED_FOR_CHANGES'] } };

  if (search) {
    // category is an enum, so match it by comparing the search term against the
    // enum values rather than a SQL "contains".
    const matchingCategories = Object.values(ApplicationCategory).filter((c) => c.toLowerCase().includes(search.toLowerCase()));
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { owner: { name: { contains: search, mode: 'insensitive' } } },
      ...(matchingCategories.length ? [{ category: { in: matchingCategories } }] : []),
    ];
  }

  const applications = await prisma.application.findMany({
    where,
    include: { owner: { select: { id: true, name: true, email: true } } },
    orderBy: { updatedAt: 'desc' },
  });
  res.json(applications);
}

export async function getApplication(req: Request, res: Response) {
  const application = await prisma.application.findUnique({
    where: { id: req.params.id },
    include: {
      owner: { select: { id: true, name: true, email: true } },
      auditLogs: { include: { performedBy: { select: { id: true, name: true, email: true, role: true } } }, orderBy: { createdAt: 'asc' } },
    },
  });
  if (!application) throw new ApiError(404, 'Application not found');
  if (req.user!.role === Role.APPLICANT && application.ownerId !== req.user!.id) throw new ApiError(403, 'Forbidden');
  res.json(application);
}

export async function updateApplication(req: Request, res: Response) {
  if (req.user!.role !== Role.APPLICANT) throw new ApiError(403, 'Only applicants can edit applications');
  const existing = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!existing) throw new ApiError(404, 'Application not found');
  if (existing.ownerId !== req.user!.id) throw new ApiError(403, 'Only the owner can edit this application');
  if (!['DRAFT', 'RETURNED_FOR_CHANGES'].includes(existing.status)) {
    throw new ApiError(409, 'Applications cannot be edited after submission unless returned for changes');
  }
  const body = applicationInputSchema.parse(req.body);
  // Editing a returned application sends it back to DRAFT for resubmission. That
  // is a real status change, so when it happens it is recorded in the audit trail.
  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.application.update({ where: { id: existing.id }, data: { ...body, amount: body.amount ?? null, status: 'DRAFT' } });
    if (existing.status !== 'DRAFT') {
      await tx.auditLog.create({
        data: { applicationId: existing.id, oldStatus: existing.status, newStatus: 'DRAFT', comment: 'Edited and returned to draft', performedById: req.user!.id },
      });
    }
    return app;
  });
  res.json(updated);
}

async function transition(req: Request, res: Response, action: WorkflowAction) {
  const { comment } = commentSchema.parse(req.body ?? {});
  const application = await prisma.application.findUnique({ where: { id: req.params.id } });
  if (!application) throw new ApiError(404, 'Application not found');
  if (action === 'SUBMIT' && application.ownerId !== req.user!.id) throw new ApiError(403, 'Only the owner can submit this application');
  const newStatus = assertTransitionAllowed({ action, currentStatus: application.status, userRole: req.user!.role, comment });
  // Status update and audit row are written in one transaction, so a status can
  // never change without a matching history entry (and vice versa).
  const updated = await prisma.$transaction(async (tx) => {
    const app = await tx.application.update({ where: { id: application.id }, data: { status: newStatus } });
    await tx.auditLog.create({
      data: { applicationId: application.id, oldStatus: application.status, newStatus, comment: comment || null, performedById: req.user!.id },
    });
    return app;
  });
  res.json(updated);
}

export const submitApplication = (req: Request, res: Response) => transition(req, res, 'SUBMIT');
export const startReview = (req: Request, res: Response) => transition(req, res, 'START_REVIEW');
export const approveApplication = (req: Request, res: Response) => transition(req, res, 'APPROVE');
export const rejectApplication = (req: Request, res: Response) => transition(req, res, 'REJECT');
export const returnApplication = (req: Request, res: Response) => transition(req, res, 'RETURN_FOR_CHANGES');
