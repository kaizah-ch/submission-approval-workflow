import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Application } from '../types';
import StatusBadge from '../components/StatusBadge';
import AuditTrail from '../components/AuditTrail';
import ConfirmationModal from '../components/ConfirmationModal';
import { ErrorState, Loading, SuccessState } from '../components/Feedback';

// Confirmation copy and styling for each reviewer action.
type ActionConfig = {
  action: string;
  requiresComment: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  confirmClassName?: string;
};

const ACTIONS: Record<string, ActionConfig> = {
  'under-review': {
    action: 'under-review',
    requiresComment: false,
    title: 'Start review',
    message: 'Move this application to Under Review?',
    confirmLabel: 'Start review',
  },
  approve: {
    action: 'approve',
    requiresComment: false,
    title: 'Approve request',
    message: 'Approve this application? This will mark the request as approved.',
    confirmLabel: 'Approve request',
  },
  return: {
    action: 'return',
    requiresComment: true,
    title: 'Return for changes',
    message: 'Return this application to the applicant for changes? Your comment will be visible in the audit trail.',
    confirmLabel: 'Return for changes',
  },
  reject: {
    action: 'reject',
    requiresComment: true,
    title: 'Reject request',
    message: 'Reject this application? This action will mark the request as rejected and record your comment.',
    confirmLabel: 'Reject request',
    confirmClassName: 'btn bg-red-600 text-white hover:bg-red-700',
  },
};

export default function ReviewerDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const [pending, setPending] = useState<ActionConfig | null>(null);
  const { data, isLoading, error } = useQuery({ queryKey: ['application', id], queryFn: async () => (await api.get<Application>(`/applications/${id}`)).data });
  const mutation = useMutation({
    mutationFn: async (action: string) => (await api.post(`/reviewer/applications/${id}/${action}`, { comment })).data,
    onSuccess: () => {
      setComment('');
      setCommentError('');
      setPending(null);
      qc.invalidateQueries({ queryKey: ['application', id] });
      qc.invalidateQueries({ queryKey: ['reviewer-applications'] });
      navigate('/reviewer');
    },
  });
  if (isLoading) return <Loading label="Loading application…" />;
  if (error || !data) return <ErrorState message="Failed to load this application." />;
  const canStartReview = data.status === 'SUBMITTED';
  const canDecide = data.status === 'SUBMITTED' || data.status === 'UNDER_REVIEW';
  // Require a comment for reject/return before the modal even opens.
  const requestAction = (key: string) => {
    const config = ACTIONS[key];
    if (config.requiresComment && !comment.trim()) { setCommentError('A comment is required to reject or return.'); return; }
    setCommentError('');
    setPending(config);
  };
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-sm text-slate-500">{data.category} • Owner: {data.owner?.name} • Amount: {data.amount != null ? Number(data.amount).toLocaleString() : '—'}</p>
        {data.description && <p className="whitespace-pre-line text-slate-700">{data.description}</p>}
        {canStartReview || canDecide ? (
          <div className="space-y-3 pt-1">
            <textarea className="input" rows={3} placeholder="Comment (required to reject or return)" value={comment} onChange={(e) => setComment(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              {canStartReview && <button className="btn-secondary" disabled={mutation.isPending} onClick={() => requestAction('under-review')}>Start review</button>}
              {canDecide && <button className="btn-primary" disabled={mutation.isPending} onClick={() => requestAction('approve')}>Approve</button>}
              {canDecide && <button className="btn-secondary" disabled={mutation.isPending} onClick={() => requestAction('return')}>Return for changes</button>}
              {canDecide && <button className="btn-secondary" disabled={mutation.isPending} onClick={() => requestAction('reject')}>Reject</button>}
            </div>
            {commentError && <ErrorState message={commentError} />}
            {mutation.isSuccess && <SuccessState message="Decision recorded." />}
            {mutation.error && <ErrorState message={(mutation.error as any).response?.data?.message || 'Action failed.'} />}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No actions available at this stage.</p>
        )}
      </section>
      <AuditTrail logs={data.auditLogs} />
      <ConfirmationModal
        open={pending !== null}
        title={pending?.title ?? ''}
        message={pending?.message ?? ''}
        confirmLabel={pending?.confirmLabel ?? 'Confirm'}
        confirmClassName={pending?.confirmClassName}
        loading={mutation.isPending}
        onConfirm={() => pending && mutation.mutate(pending.action)}
        onCancel={() => setPending(null)}
      />
    </div>
  );
}
