import { getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';

export function FuelBadge({ fuel }: { fuel: number | null }) {
  const status = getFuelStatus(fuel);
  const c = fuelStatusColor(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.text, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {fuelStatusLabel(status)}
    </span>
  );
}
