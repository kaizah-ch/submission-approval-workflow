import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Application } from '../types';
import StatusBadge from '../components/StatusBadge';
import SummaryCards, { SummaryCard } from '../components/SummaryCards';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';

const cards: SummaryCard[] = [
  { label: 'Draft', statuses: ['DRAFT'], color: 'text-slate-700' },
  { label: 'Submitted', statuses: ['SUBMITTED'], color: 'text-blue-600' },
  { label: 'Under review', statuses: ['UNDER_REVIEW'], color: 'text-amber-600' },
  { label: 'Approved', statuses: ['APPROVED'], color: 'text-green-600' },
  { label: 'Rejected / Returned', statuses: ['REJECTED', 'RETURNED_FOR_CHANGES'], color: 'text-purple-600' },
];

export default function ApplicantList() {
  const { data, isLoading, error } = useQuery({ queryKey: ['my-applications'], queryFn: async () => (await api.get<Application[]>('/applications/my')).data });
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">My Applications</h1>
        <Link className="btn-primary" to="/applicant/new">New application</Link>
      </div>
      {isLoading && <Loading label="Loading applications…" />}
      {error && <ErrorState message="Failed to load your applications." />}
      {data && (
        <>
          <SummaryCards apps={data} cards={cards} />
          {data.length === 0 ? (
            <EmptyState
              title="No applications yet"
              hint="Create your first application to get started."
              action={<Link className="btn-primary" to="/applicant/new">New application</Link>}
            />
          ) : (
            <div className="grid gap-3">
              {data.map((app) => (
                <Link key={app.id} className="card transition hover:bg-slate-50" to={`/applicant/${app.id}`}>
                  <div className="flex items-center justify-between gap-3">
                    <h2 className="font-semibold">{app.title}</h2>
                    <StatusBadge status={app.status} />
                  </div>
                  <p className="mt-1 text-sm text-slate-500">{app.category} • Updated {new Date(app.updatedAt).toLocaleString()}</p>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
