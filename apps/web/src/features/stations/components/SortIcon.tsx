import { ChevronUp, ChevronDown } from 'lucide-react';

type SortField = 'code' | 'name' | 'currentFuel' | 'lastUpdated';

export function SortIcon({ field, sortField, sortAsc }: { field: SortField; sortField: SortField; sortAsc: boolean }) {
  return (
    <span className="inline-flex flex-col ml-1" style={{ color: sortField === field ? '#2563eb' : '#cbd5e1' }}>
      <ChevronUp size={10} style={{ marginBottom: -2, opacity: sortField === field && sortAsc ? 1 : 0.4 }} />
      <ChevronDown size={10} style={{ opacity: sortField === field && !sortAsc ? 1 : 0.4 }} />
    </span>
  );
}
