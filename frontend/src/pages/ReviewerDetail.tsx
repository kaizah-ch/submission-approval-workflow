import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api/client';
import { Application } from '../types';
import StatusBadge from '../components/StatusBadge';
import AuditTrail from '../components/AuditTrail';
import { ErrorState, Loading, SuccessState } from '../components/Feedback';

export default function ReviewerDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const [comment, setComment] = useState('');
  const [commentError, setCommentError] = useState('');
  const { data, isLoading, error } = useQuery({ queryKey: ['application', id], queryFn: async () => (await api.get<Application>(`/applications/${id}`)).data });
  const mutation = useMutation({ mutationFn: async (action: string) => (await api.post(`/reviewer/applications/${id}/${action}`, { comment })).data, onSuccess: () => { setComment(''); setCommentError(''); qc.invalidateQueries({ queryKey: ['application', id] }); } });
  if (isLoading) return <Loading label="Loading application…" />;
  if (error || !data) return <ErrorState message="Failed to load this application." />;
  const canStartReview = data.status === 'SUBMITTED';
  const canDecide = data.status === 'SUBMITTED' || data.status === 'UNDER_REVIEW';
  const act = (action: string, requiresComment: boolean) => {
    if (requiresComment && !comment.trim()) { setCommentError('A comment is required to reject or return.'); return; }
    setCommentError('');
    mutation.mutate(action);
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
              {canStartReview && <button className="btn-secondary" disabled={mutation.isPending} onClick={() => act('under-review', false)}>Start review</button>}
              {canDecide && <button className="btn-primary" disabled={mutation.isPending} onClick={() => act('approve', false)}>Approve</button>}
              {canDecide && <button className="btn-secondary" disabled={mutation.isPending} onClick={() => act('return', true)}>Return for changes</button>}
              {canDecide && <button className="btn-secondary" disabled={mutation.isPending} onClick={() => act('reject', true)}>Reject</button>}
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
    </div>
  );
}
