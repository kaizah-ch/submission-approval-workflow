import { Status } from '../types';

// Full static class strings so Tailwind's content scanner keeps them.
const styles: Record<Status, string> = {
  DRAFT: 'bg-slate-100 text-slate-700 ring-slate-200',
  SUBMITTED: 'bg-blue-100 text-blue-700 ring-blue-200',
  UNDER_REVIEW: 'bg-amber-100 text-amber-700 ring-amber-200',
  APPROVED: 'bg-green-100 text-green-700 ring-green-200',
  REJECTED: 'bg-red-100 text-red-700 ring-red-200',
  RETURNED_FOR_CHANGES: 'bg-purple-100 text-purple-700 ring-purple-200',
};

export const statusLabel: Record<Status, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  UNDER_REVIEW: 'Under review',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  RETURNED_FOR_CHANGES: 'Returned for changes',
};

export default function StatusBadge({ status }: { status: Status }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${styles[status]}`}>
      {statusLabel[status]}
    </span>
  );
}
