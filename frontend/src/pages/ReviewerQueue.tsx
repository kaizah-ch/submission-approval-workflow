import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Application } from '../types';
import StatusBadge, { statusLabel } from '../components/StatusBadge';
import SummaryCards, { SummaryCard } from '../components/SummaryCards';
import { EmptyState, ErrorState, Loading } from '../components/Feedback';

const cards: SummaryCard[] = [
  { label: 'Submitted', statuses: ['SUBMITTED'], color: 'text-blue-600' },
  { label: 'Under review', statuses: ['UNDER_REVIEW'], color: 'text-amber-600' },
  { label: 'Approved', statuses: ['APPROVED'], color: 'text-green-600' },
  { label: 'Rejected', statuses: ['REJECTED'], color: 'text-red-600' },
  { label: 'Returned', statuses: ['RETURNED_FOR_CHANGES'], color: 'text-purple-600' },
];

const filters = ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'RETURNED_FOR_CHANGES'] as const;

export default function ReviewerQueue() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') || '';
  // Search is local state, debounced so we query the server after typing pauses.
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);
  // Counts always reflect the full queue, independent of the active filter/search.
  const all = useQuery({ queryKey: ['reviewer-applications', '', ''], queryFn: async () => (await api.get<Application[]>('/reviewer/applications')).data });
  const { data, isLoading, error } = useQuery({
    queryKey: ['reviewer-applications', status, debouncedSearch],
    queryFn: async () => (await api.get<Application[]>('/reviewer/applications', { params: { ...(status ? { status } : {}), ...(debouncedSearch ? { search: debouncedSearch } : {}) } })).data,
  });
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Reviewer Queue</h1>
        <div className="flex flex-wrap gap-2">
          <input className="input max-w-xs" type="search" placeholder="Search title, applicant, or category" value={search} onChange={(e) => setSearch(e.target.value)} />
          <select className="input max-w-xs" value={status} onChange={(e) => setParams(e.target.value ? { status: e.target.value } : {})}>
            <option value="">All statuses</option>
            {filters.map((f) => <option key={f} value={f}>{statusLabel[f]}</option>)}
          </select>
        </div>
      </div>
      {all.data && <SummaryCards apps={all.data} cards={cards} />}
      {isLoading && <Loading label="Loading queue…" />}
      {error && <ErrorState message="Failed to load the reviewer queue." />}
      {data && (
        data.length === 0 ? (
          <EmptyState
            title="No results"
            hint={
              debouncedSearch
                ? `No applications match “${debouncedSearch}”${status ? ` with status “${statusLabel[status as keyof typeof statusLabel]}”` : ''}.`
                : status
                ? `No applications with status “${statusLabel[status as keyof typeof statusLabel]}”.`
                : 'There are no applications in the queue yet.'
            }
          />
        ) : (
          <div className="grid gap-3">
            {data.map((app) => (
              <Link className="card transition hover:bg-slate-50" key={app.id} to={`/reviewer/${app.id}`}>
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-semibold">{app.title}</h2>
                  <StatusBadge status={app.status} />
                </div>
                <p className="mt-1 text-sm text-slate-500">Owner: {app.owner?.name} • {app.category}</p>
              </Link>
            ))}
          </div>
        )
      )}
    </div>
  );
}
