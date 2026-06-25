import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { getUser } from '../components/Layout';
import { Application } from '../types';
import StatusBadge from '../components/StatusBadge';
import AuditTrail from '../components/AuditTrail';
import { ErrorState, Loading, SuccessState } from '../components/Feedback';

export default function ApplicationDetail() {
  const { id } = useParams();
  const user = getUser();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data, isLoading, error } = useQuery({ queryKey: ['application', id], queryFn: async () => (await api.get<Application>(`/applications/${id}`)).data });
  const mutation = useMutation({
    mutationFn: async (url: string) => (await api.post(url, {})).data,
    // After submitting, the detail view's actions no longer apply, so return the
    // applicant to their list and refresh both the list and this application.
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['application', id] });
      qc.invalidateQueries({ queryKey: ['my-applications'] });
      navigate('/applicant');
    },
  });
  if (isLoading) return <Loading label="Loading application…" />;
  if (error || !data) return <ErrorState message="Failed to load this application." />;
  const canEdit = user?.role === 'APPLICANT' && ['DRAFT', 'RETURNED_FOR_CHANGES'].includes(data.status);
  return (
    <div className="space-y-4">
      <section className="card space-y-3">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold">{data.title}</h1>
          <StatusBadge status={data.status} />
        </div>
        <p className="text-sm text-slate-500">{data.category} • Amount: {data.amount != null ? Number(data.amount).toLocaleString() : '—'}</p>
        {data.description && <p className="whitespace-pre-line text-slate-700">{data.description}</p>}
        {canEdit && (
          <div className="flex gap-2 pt-1">
            <Link to={`/applicant/applications/${data.id}/edit`} className="btn-secondary">Edit</Link>
            <button onClick={() => mutation.mutate(`/applications/${data.id}/submit`)} disabled={mutation.isPending} className="btn-primary">
              {mutation.isPending ? 'Submitting…' : 'Submit'}
            </button>
          </div>
        )}
        {mutation.isSuccess && <SuccessState message="Application submitted for review." />}
        {mutation.error && <ErrorState message={(mutation.error as any).response?.data?.message || 'Action failed.'} />}
      </section>
      <AuditTrail logs={data.auditLogs} />
    </div>
  );
}
