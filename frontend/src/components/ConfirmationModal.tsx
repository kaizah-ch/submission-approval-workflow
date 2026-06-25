import { ReactNode } from 'react';

type ConfirmationModalProps = {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel: string;
  confirmClassName?: string;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export default function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel,
  confirmClassName = 'btn-primary',
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div className="card w-full max-w-md space-y-4" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-slate-600">{message}</p>
        <div className="flex justify-end gap-2">
          <button className="btn-secondary" onClick={onCancel} disabled={loading}>Cancel</button>
          <button className={confirmClassName} onClick={onConfirm} disabled={loading}>{loading ? 'Working…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
