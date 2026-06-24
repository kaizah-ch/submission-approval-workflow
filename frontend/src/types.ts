export type Role = 'APPLICANT' | 'REVIEWER';
export type Status = 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'RETURNED_FOR_CHANGES';
export type AppUser = { id: string; name: string; email: string; role: Role };
export type Application = { id: string; title: string; category: string; description?: string; amount?: string | number; status: Status; ownerId: string; owner?: AppUser; createdAt: string; updatedAt: string; auditLogs?: AuditLog[] };
export type AuditLog = { id: string; oldStatus: Status; newStatus: Status; comment?: string; createdAt: string; performedBy: AppUser };
