import { Application, Status } from '../types';

export type SummaryCard = { label: string; statuses: Status[]; color: string };

export default function SummaryCards({ apps, cards }: { apps: Application[]; cards: SummaryCard[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {cards.map((card) => {
        const count = apps.filter((a) => card.statuses.includes(a.status)).length;
        return (
          <div key={card.label} className="card flex flex-col gap-1 p-4">
            <span className={`text-2xl font-bold ${card.color}`}>{count}</span>
            <span className="text-sm text-slate-600">{card.label}</span>
          </div>
        );
      })}
    </div>
  );
}
