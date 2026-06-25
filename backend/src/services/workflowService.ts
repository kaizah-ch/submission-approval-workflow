import { ApplicationStatus, Role } from '@prisma/client';
import { ApiError } from '../utils/apiError';

export type WorkflowAction = 'SUBMIT' | 'START_REVIEW' | 'APPROVE' | 'REJECT' | 'RETURN_FOR_CHANGES';

type TransitionRule = {
  from: ApplicationStatus[];
  to: ApplicationStatus;
  role: Role;
  requiresComment?: boolean;
};

// Single source of truth for the workflow. Each action declares the statuses it
// may start from, the status it produces, the role allowed to perform it, and
// whether a comment is mandatory. Controllers consult this table so the rules
// can never drift between endpoints.
export const transitionRules: Record<WorkflowAction, TransitionRule> = {
  SUBMIT: { from: ['DRAFT', 'RETURNED_FOR_CHANGES'], to: 'SUBMITTED', role: 'APPLICANT' },
  START_REVIEW: { from: ['SUBMITTED'], to: 'UNDER_REVIEW', role: 'REVIEWER' },
  APPROVE: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'APPROVED', role: 'REVIEWER' },
  REJECT: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'REJECTED', role: 'REVIEWER', requiresComment: true },
  RETURN_FOR_CHANGES: { from: ['SUBMITTED', 'UNDER_REVIEW'], to: 'RETURNED_FOR_CHANGES', role: 'REVIEWER', requiresComment: true },
};

export function assertTransitionAllowed(input: {
  action: WorkflowAction;
  currentStatus: ApplicationStatus;
  userRole: Role;
  comment?: string | null;
}) {
  const rule = transitionRules[input.action];
  // Checks run most- to least-fundamental: wrong role (403) before an
  // out-of-sequence transition (409) before a missing mandatory comment (400).
  if (input.userRole !== rule.role) {
    throw new ApiError(403, `Only ${rule.role.toLowerCase()} users can perform ${input.action.toLowerCase()}`);
  }
  if (!rule.from.includes(input.currentStatus)) {
    throw new ApiError(409, `Cannot perform ${input.action.toLowerCase()} from status ${input.currentStatus}`);
  }
  // Reject and return must carry a justification, which is persisted on the audit log.
  if (rule.requiresComment && !input.comment?.trim()) {
    throw new ApiError(400, `${input.action.toLowerCase()} requires a comment`);
  }
  return rule.to;
}
