import { useState, useRef, useEffect, useMemo } from 'react';
import { ChevronDown, Check, X, Search } from 'lucide-react';
import type { Employee } from '../api/employeeApi';

interface Props {
  employees: Employee[];
  value: string | null;
  onChange: (employeeId: string | null) => void;
  id?: string;
}

const INPUT_STYLE = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: 'white', outline: 'none' } as const;

/**
 * Type-to-search dropdown for picking the managing employee. Filters the (admin-maintained) list
 * as the user types, since that list can grow long. Value is the employee id; null = unassigned.
 */
export function EmployeeSelect({ employees, value, onChange, id }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);

  const selected = employees.find(e => e.id === value) ?? null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const active = employees.filter(e => e.isActive || e.id === value);
    if (!q) return active;
    return active.filter(e => e.name.toLowerCase().includes(q) || (e.phone ?? '').includes(q));
  }, [employees, query, value]);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        id={id}
        onClick={() => { setOpen(v => !v); setQuery(''); }}
        className="flex items-center justify-between"
        style={{ ...INPUT_STYLE, cursor: 'pointer' }}
      >
        <span style={{ color: selected ? '#1e293b' : '#94a3b8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {selected ? selected.name : '— Chưa gán —'}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          {selected && (
            <X
              size={14}
              style={{ color: '#94a3b8' }}
              onClick={e => { e.stopPropagation(); onChange(null); }}
            />
          )}
          <ChevronDown size={15} style={{ color: '#94a3b8' }} />
        </span>
      </button>

      {open && (
        <div
          className="absolute left-0 right-0 mt-1 rounded-lg border shadow-lg overflow-hidden"
          style={{ background: 'white', borderColor: '#e2e8f0', zIndex: 70 }}
        >
          <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: '#f1f5f9' }}>
            <Search size={14} style={{ color: '#94a3b8' }} />
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Gõ tên để tìm..."
              className="flex-1 outline-none"
              style={{ fontSize: '0.85rem', color: '#1e293b' }}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-3 text-center" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                Không tìm thấy nhân viên
              </div>
            ) : (
              filtered.map(e => (
                <button
                  type="button"
                  key={e.id}
                  onClick={() => { onChange(e.id); setOpen(false); }}
                  className="w-full flex items-center justify-between px-3 py-2 text-left transition-colors"
                  style={{ fontSize: '0.85rem', color: '#374151' }}
                  onMouseEnter={ev => (ev.currentTarget as HTMLElement).style.background = '#f8fafc'}
                  onMouseLeave={ev => (ev.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <span className="min-w-0">
                    <span className="block truncate">{e.name}</span>
                    {e.phone && <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{e.phone}</span>}
                  </span>
                  {e.id === value && <Check size={15} style={{ color: '#2563eb' }} />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
