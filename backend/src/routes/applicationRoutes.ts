import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import {
  approveApplication,
  createApplication,
  getApplication,
  listMyApplications,
  listReviewerApplications,
  rejectApplication,
  returnApplication,
  startReview,
  submitApplication,
  updateApplication,
} from '../controllers/applicationController';

export const applicationRoutes = Router();
applicationRoutes.use(requireAuth);

applicationRoutes.get('/applications/my', asyncHandler(listMyApplications));
applicationRoutes.post('/applications', asyncHandler(createApplication));
applicationRoutes.get('/applications/:id', asyncHandler(getApplication));
applicationRoutes.put('/applications/:id', asyncHandler(updateApplication));
applicationRoutes.post('/applications/:id/submit', asyncHandler(submitApplication));

applicationRoutes.get('/reviewer/applications', asyncHandler(listReviewerApplications));
applicationRoutes.post('/reviewer/applications/:id/under-review', asyncHandler(startReview));
applicationRoutes.post('/reviewer/applications/:id/approve', asyncHandler(approveApplication));
applicationRoutes.post('/reviewer/applications/:id/reject', asyncHandler(rejectApplication));
applicationRoutes.post('/reviewer/applications/:id/return', asyncHandler(returnApplication));
