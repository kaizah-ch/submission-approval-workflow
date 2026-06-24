import { assertTransitionAllowed, WorkflowAction } from '../src/services/workflowService';
import { ApplicationStatus, Role } from '@prisma/client';
import { ApiError } from '../src/utils/apiError';

// Helper: assert the rejected transition throws an ApiError with a given HTTP
// status, so the unit tests pin the same semantics the API relies on
// (403 = wrong role, 409 = illegal state, 400 = missing comment).
function expectRejected(
  input: { action: WorkflowAction; currentStatus: ApplicationStatus; userRole: Role; comment?: string | null },
  status: number,
) {
  try {
    assertTransitionAllowed(input);
    throw new Error('Expected transition to be rejected, but it was allowed');
  } catch (err) {
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).statusCode).toBe(status);
  }
}

describe('workflow state machine', () => {
  describe('legal transitions', () => {
    it('applicant submits a draft -> SUBMITTED', () => {
      expect(assertTransitionAllowed({ action: 'SUBMIT', currentStatus: 'DRAFT', userRole: 'APPLICANT' })).toBe('SUBMITTED');
    });

    it('applicant resubmits a returned application -> SUBMITTED', () => {
      expect(assertTransitionAllowed({ action: 'SUBMIT', currentStatus: 'RETURNED_FOR_CHANGES', userRole: 'APPLICANT' })).toBe('SUBMITTED');
    });

    it('reviewer starts review of a submitted application -> UNDER_REVIEW', () => {
      expect(assertTransitionAllowed({ action: 'START_REVIEW', currentStatus: 'SUBMITTED', userRole: 'REVIEWER' })).toBe('UNDER_REVIEW');
    });

    it('reviewer approves a submitted application -> APPROVED', () => {
      expect(assertTransitionAllowed({ action: 'APPROVE', currentStatus: 'SUBMITTED', userRole: 'REVIEWER' })).toBe('APPROVED');
    });

    it('reviewer approves an under-review application -> APPROVED', () => {
      expect(assertTransitionAllowed({ action: 'APPROVE', currentStatus: 'UNDER_REVIEW', userRole: 'REVIEWER' })).toBe('APPROVED');
    });

    it('reviewer rejects with a comment -> REJECTED', () => {
      expect(assertTransitionAllowed({ action: 'REJECT', currentStatus: 'UNDER_REVIEW', userRole: 'REVIEWER', comment: 'Insufficient detail' })).toBe('REJECTED');
    });

    it('reviewer returns with a comment -> RETURNED_FOR_CHANGES', () => {
      expect(assertTransitionAllowed({ action: 'RETURN_FOR_CHANGES', currentStatus: 'SUBMITTED', userRole: 'REVIEWER', comment: 'Please add a budget' })).toBe('RETURNED_FOR_CHANGES');
    });
  });

  describe('role restrictions (403)', () => {
    it('applicant cannot approve', () => {
      expectRejected({ action: 'APPROVE', currentStatus: 'SUBMITTED', userRole: 'APPLICANT' }, 403);
    });

    it('applicant cannot reject', () => {
      expectRejected({ action: 'REJECT', currentStatus: 'SUBMITTED', userRole: 'APPLICANT', comment: 'no' }, 403);
    });

    it('applicant cannot return for changes', () => {
      expectRejected({ action: 'RETURN_FOR_CHANGES', currentStatus: 'SUBMITTED', userRole: 'APPLICANT', comment: 'no' }, 403);
    });

    it('applicant cannot start review', () => {
      expectRejected({ action: 'START_REVIEW', currentStatus: 'SUBMITTED', userRole: 'APPLICANT' }, 403);
    });

    it('reviewer cannot submit', () => {
      expectRejected({ action: 'SUBMIT', currentStatus: 'DRAFT', userRole: 'REVIEWER' }, 403);
    });
  });

  describe('illegal state transitions (409)', () => {
    it('cannot submit an already-approved application', () => {
      expectRejected({ action: 'SUBMIT', currentStatus: 'APPROVED', userRole: 'APPLICANT' }, 409);
    });

    it('cannot approve a draft', () => {
      expectRejected({ action: 'APPROVE', currentStatus: 'DRAFT', userRole: 'REVIEWER' }, 409);
    });

    it('cannot approve an already-rejected application', () => {
      expectRejected({ action: 'APPROVE', currentStatus: 'REJECTED', userRole: 'REVIEWER' }, 409);
    });

    it('cannot start review of an application that is not submitted', () => {
      expectRejected({ action: 'START_REVIEW', currentStatus: 'UNDER_REVIEW', userRole: 'REVIEWER' }, 409);
    });
  });

  describe('comment requirements (400)', () => {
    it('reject requires a comment', () => {
      expectRejected({ action: 'REJECT', currentStatus: 'SUBMITTED', userRole: 'REVIEWER' }, 400);
    });

    it('reject rejects a whitespace-only comment', () => {
      expectRejected({ action: 'REJECT', currentStatus: 'SUBMITTED', userRole: 'REVIEWER', comment: '   ' }, 400);
    });

    it('return for changes requires a comment', () => {
      expectRejected({ action: 'RETURN_FOR_CHANGES', currentStatus: 'UNDER_REVIEW', userRole: 'REVIEWER', comment: '' }, 400);
    });
  });
});
