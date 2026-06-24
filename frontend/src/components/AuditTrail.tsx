import { AuditLog } from '../types';
import { statusLabel } from './StatusBadge';

export default function AuditTrail({ logs }: { logs?: AuditLog[] }) {
  return (
    <section className="card">
      <h2 className="mb-3 text-lg font-semibold">Audit Trail</h2>
      {logs?.length ? (
        <ol className="space-y-3">
          {logs.map((log) => (
            <li key={log.id} className="border-l-4 border-slate-200 pl-3">
              <p className="text-sm">
                <span className="font-medium">{statusLabel[log.oldStatus]}</span> → <span className="font-medium">{statusLabel[log.newStatus]}</span> by {log.performedBy.name}
              </p>
              <p className="text-xs text-slate-500">{new Date(log.createdAt).toLocaleString()}</p>
              {log.comment && <p className="mt-1 text-sm text-slate-700">“{log.comment}”</p>}
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-sm text-slate-500">No transitions yet.</p>
      )}
    </section>
  );
}
