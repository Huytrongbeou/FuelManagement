import { useState } from 'react';
import { Search, ChevronUp, ChevronDown, Eye, Edit, MoreVertical, Droplets, XCircle, AlertTriangle, Plus } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { toast } from 'sonner';
import { Station, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '../types';
import { FuelEntryModal } from './FuelEntryModal';

interface Props {
  stations: Station[];
  onViewStation: (id: string) => void;
  onAddStation?: () => void;
}

function FuelBadge({ fuel }: { fuel: number | null }) {
  const status = getFuelStatus(fuel);
  const c = fuelStatusColor(status);
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: c.bg, color: c.text, fontSize: '0.72rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />{fuelStatusLabel(status)}
    </span>
  );
}

type SortField = 'code' | 'name' | 'currentFuel' | 'lastUpdated';

export function StationList({ stations, onViewStation, onAddStation }: Props) {
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [zoneFilter, setZoneFilter] = useState('all');
  const [sortField, setSortField] = useState<SortField>('code');
  const [sortAsc, setSortAsc] = useState(true);
  const [page, setPage] = useState(1);
  const [fuelModalStation, setFuelModalStation] = useState<Station | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Station | null>(null);
  const [deactivateReason, setDeactivateReason] = useState('');
  const [deactivateConfirmed, setDeactivateConfirmed] = useState(false);
  const perPage = 10;

  const brands = [...new Set(stations.map(s => s.brandName))];
  const zones  = [...new Set(stations.map(s => s.managementZone))];

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else { setSortField(field); setSortAsc(true); }
  };

  const filtered = stations
    .filter(s => s.active)
    .filter(s => {
      if (query && !s.code.toLowerCase().includes(query.toLowerCase()) && !s.name.toLowerCase().includes(query.toLowerCase()) && !s.address.toLowerCase().includes(query.toLowerCase())) return false;
      if (statusFilter !== 'all' && getFuelStatus(s.currentFuel) !== statusFilter) return false;
      if (brandFilter !== 'all' && s.brandName !== brandFilter) return false;
      if (zoneFilter !== 'all' && s.managementZone !== zoneFilter) return false;
      return true;
    })
    .sort((a, b) => {
      const av = sortField === 'currentFuel' ? (a.currentFuel ?? -1) : sortField === 'lastUpdated' ? (a.lastUpdated ?? '') : a[sortField];
      const bv = sortField === 'currentFuel' ? (b.currentFuel ?? -1) : sortField === 'lastUpdated' ? (b.lastUpdated ?? '') : b[sortField];
      return sortAsc ? (av < bv ? -1 : av > bv ? 1 : 0) : (av > bv ? -1 : av < bv ? 1 : 0);
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paged = filtered.slice((page - 1) * perPage, page * perPage);

  const SortIcon = ({ field }: { field: SortField }) => (
    <span className="inline-flex flex-col ml-1" style={{ color: sortField === field ? '#2563eb' : '#cbd5e1' }}>
      <ChevronUp size={10} style={{ marginBottom: -2, opacity: sortField === field && sortAsc ? 1 : 0.4 }} />
      <ChevronDown size={10} style={{ opacity: sortField === field && !sortAsc ? 1 : 0.4 }} />
    </span>
  );

  const handleDeactivate = () => {
    toast.success(`Đã vô hiệu hóa trạm ${deactivateTarget?.code}`);
    setDeactivateTarget(null);
    setDeactivateReason('');
    setDeactivateConfirmed(false);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 style={{ color: '#0f172a' }}>Danh sách trạm</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{stations.filter(s => s.active).length} trạm đang hoạt động</p>
        </div>
        {onAddStation && (
          <button onClick={onAddStation} className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
            <Plus size={16} /> Thêm trạm
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
          <input value={query} onChange={e => { setQuery(e.target.value); setPage(1); }} placeholder="Mã / tên / địa chỉ trạm..." className="pl-9 pr-4 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', width: '220px' }} />
        </div>
        <select value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', color: '#374151' }}>
          <option value="all">Tất cả trạng thái</option>
          <option value="green">Đủ nhiên liệu</option>
          <option value="yellow">Sắp hết</option>
          <option value="red">Nguy hiểm</option>
          <option value="gray">Chưa có dữ liệu</option>
        </select>
        <select value={brandFilter} onChange={e => { setBrandFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', color: '#374151' }}>
          <option value="all">Tất cả hãng</option>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
        <select value={zoneFilter} onChange={e => { setZoneFilter(e.target.value); setPage(1); }} className="px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', color: '#374151' }}>
          <option value="all">Tất cả khu vực</option>
          {zones.map(z => <option key={z} value={z}>{z}</option>)}
        </select>
        {(query || statusFilter !== 'all' || brandFilter !== 'all' || zoneFilter !== 'all') && (
          <button onClick={() => { setQuery(''); setStatusFilter('all'); setBrandFilter('all'); setZoneFilter('all'); setPage(1); }} className="px-3 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', color: '#64748b', background: 'white' }}>
            Xóa lọc
          </button>
        )}
        <div className="ml-auto flex items-center" style={{ color: '#94a3b8', fontSize: '0.8rem' }}>{filtered.length} kết quả</div>
      </div>

      {/* Table */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {[
                  { label: 'Mã trạm',       field: 'code'        as SortField | null },
                  { label: 'Tên trạm',       field: 'name'        as SortField | null },
                  { label: 'Tên máy phát',   field: null },
                  { label: 'Hãng / Model',   field: null },
                  { label: 'Công suất',      field: null },
                  { label: 'NL tồn',         field: 'currentFuel' as SortField | null },
                  { label: 'Trạng thái',     field: null },
                  { label: 'Khu vực QT',     field: null },
                  { label: 'Cập nhật',       field: 'lastUpdated' as SortField | null },
                  { label: 'Hành động',      field: null },
                ].map(col => (
                  <th key={col.label} className="text-left px-4 py-3 border-b" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0', whiteSpace: 'nowrap', cursor: col.field ? 'pointer' : 'default' }}
                    onClick={() => col.field && toggleSort(col.field)}>
                    {col.label}{col.field && <SortIcon field={col.field} />}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paged.length === 0 ? (
                <tr><td colSpan={10} className="px-4 py-12 text-center" style={{ color: '#94a3b8', fontSize: '0.9rem' }}>Không tìm thấy trạm nào.</td></tr>
              ) : paged.map((s, i) => {
                const pct = s.currentFuel !== null ? Math.round((s.currentFuel / s.maxCapacity) * 100) : 0;
                const status = getFuelStatus(s.currentFuel);
                const c = fuelStatusColor(status);
                return (
                  <tr key={s.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                  >
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>{s.code}</span>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{s.name}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '1px' }}>{s.adminUnit}</div>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.82rem', color: '#475569', whiteSpace: 'nowrap' }}>{s.generatorName}</td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{s.brandName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{s.modelName}</div>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <span style={{ fontFamily: 'monospace', fontSize: '0.82rem', fontWeight: 700, color: '#7c3aed' }}>{s.powerKva} kVA</span>
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>
                        {s.currentFuel !== null ? `${s.currentFuel} L` : '—'}
                        <span style={{ fontWeight: 400, color: '#94a3b8', fontSize: '0.8rem' }}> / {s.maxCapacity}L</span>
                      </div>
                      {s.currentFuel !== null && (
                        <div className="h-1.5 rounded-full mt-1" style={{ background: '#f1f5f9', width: '80px' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c.dot }} />
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}><FuelBadge fuel={s.currentFuel} /></td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.78rem', color: '#64748b', whiteSpace: 'nowrap' }}>{s.managementZone}</td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.78rem', color: s.updatedToday ? '#16a34a' : '#94a3b8', whiteSpace: 'nowrap' }}>
                      {s.lastUpdated ?? 'Chưa có'}
                      {s.updatedToday && <span className="ml-1 px-1.5 py-0.5 rounded" style={{ background: '#dcfce7', color: '#16a34a', fontSize: '0.7rem' }}>Hôm nay</span>}
                    </td>
                    <td className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                      <div className="flex items-center gap-2">
                        {/* Primary: Nhập nhiên liệu */}
                        <button onClick={() => setFuelModalStation(s)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors" style={{ background: '#2563eb', color: 'white', fontSize: '0.78rem', fontWeight: 600 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1d4ed8'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#2563eb'}>
                          <Droplets size={12} /> Nhập NL
                        </button>
                        {/* Xem chi tiết */}
                        <button onClick={() => onViewStation(s.id)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 500 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#dbeafe'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}>
                          <Eye size={12} />
                        </button>
                        {/* More actions */}
                        <DropdownMenu.Root>
                          <DropdownMenu.Trigger asChild>
                            <button className="p-1.5 rounded-lg" style={{ color: '#94a3b8' }}
                              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
                              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                              <MoreVertical size={14} />
                            </button>
                          </DropdownMenu.Trigger>
                          <DropdownMenu.Portal>
                            <DropdownMenu.Content className="rounded-xl border shadow-xl py-1 z-50" style={{ background: 'white', borderColor: '#e2e8f0', minWidth: '160px', boxShadow: '0 8px 30px rgba(0,0,0,0.12)' }} sideOffset={5}>
                              <DropdownMenu.Item asChild>
                                <button className="flex items-center gap-2 w-full px-4 py-2.5 text-left" style={{ fontSize: '0.85rem', color: '#374151', outline: 'none' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                                  <Edit size={13} style={{ color: '#64748b' }} /> Chỉnh sửa trạm
                                </button>
                              </DropdownMenu.Item>
                              <DropdownMenu.Separator style={{ height: '1px', background: '#f1f5f9', margin: '4px 0' }} />
                              <DropdownMenu.Item asChild>
                                <button className="flex items-center gap-2 w-full px-4 py-2.5 text-left" style={{ fontSize: '0.85rem', color: '#dc2626', outline: 'none' }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fff5f5'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                                  onClick={() => { setDeactivateTarget(s); setDeactivateReason(''); setDeactivateConfirmed(false); }}>
                                  <XCircle size={13} /> Vô hiệu hóa
                                </button>
                              </DropdownMenu.Item>
                            </DropdownMenu.Content>
                          </DropdownMenu.Portal>
                        </DropdownMenu.Root>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t" style={{ borderColor: '#f1f5f9' }}>
            <span style={{ color: '#94a3b8', fontSize: '0.8rem' }}>Hiển thị {(page - 1) * perPage + 1}–{Math.min(page * perPage, filtered.length)} / {filtered.length}</span>
            <div className="flex items-center gap-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setPage(p)} className="w-8 h-8 rounded-lg flex items-center justify-center"
                  style={{ fontSize: '0.8rem', background: p === page ? '#2563eb' : 'transparent', color: p === page ? 'white' : '#64748b', fontWeight: p === page ? 600 : 400 }}>
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fuel Entry Modal */}
      <FuelEntryModal station={fuelModalStation} open={!!fuelModalStation} onClose={() => setFuelModalStation(null)} />

      {/* Deactivate Dialog */}
      <AlertDialog.Root open={!!deactivateTarget} onOpenChange={open => !open && setDeactivateTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-md" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            {deactivateTarget && (
              <>
                <div className="px-6 pt-6 pb-4 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: '#fee2e2' }}>
                      <AlertTriangle size={18} style={{ color: '#dc2626' }} />
                    </div>
                    <AlertDialog.Title asChild><h3 style={{ color: '#0f172a' }}>Vô hiệu hóa trạm?</h3></AlertDialog.Title>
                  </div>
                  <AlertDialog.Description asChild>
                    <p style={{ color: '#64748b', fontSize: '0.85rem' }}>
                      Trạm <strong>{deactivateTarget.code}</strong> — {deactivateTarget.name} sẽ không còn hiển thị trong danh sách trạm đang hoạt động, dashboard và bản đồ. Dữ liệu lịch sử nhiên liệu vẫn được giữ lại.
                    </p>
                  </AlertDialog.Description>
                </div>
                <div className="px-6 py-4 space-y-4">
                  {/* Station info */}
                  <div className="rounded-xl p-3 grid grid-cols-2 gap-2" style={{ background: '#f8fafc' }}>
                    {[
                      { label: 'Mã trạm', value: deactivateTarget.code },
                      { label: 'Tên trạm', value: deactivateTarget.name },
                      { label: 'Tên máy phát', value: deactivateTarget.generatorName },
                      { label: 'NL tồn', value: deactivateTarget.currentFuel !== null ? `${deactivateTarget.currentFuel} L` : '—' },
                    ].map(item => (
                      <div key={item.label}>
                        <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{item.label}</div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: '#1e293b' }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Lý do vô hiệu hóa</label>
                    <textarea value={deactivateReason} onChange={e => setDeactivateReason(e.target.value)} rows={2} placeholder="Nhập lý do..." className="w-full px-3 py-2 rounded-lg border outline-none resize-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }} />
                  </div>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input type="checkbox" checked={deactivateConfirmed} onChange={e => setDeactivateConfirmed(e.target.checked)} className="mt-0.5" />
                    <span style={{ fontSize: '0.82rem', color: '#64748b' }}>
                      Tôi hiểu rằng trạm sẽ bị vô hiệu hóa nhưng dữ liệu lịch sử vẫn được giữ lại.
                    </span>
                  </label>
                  <div className="flex gap-3">
                    <AlertDialog.Cancel asChild>
                      <button className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>Hủy</button>
                    </AlertDialog.Cancel>
                    <AlertDialog.Action asChild>
                      <button onClick={handleDeactivate} disabled={!deactivateConfirmed} className="flex-1 py-2.5 rounded-lg transition-all" style={{ background: deactivateConfirmed ? '#dc2626' : '#e2e8f0', color: deactivateConfirmed ? 'white' : '#94a3b8', fontSize: '0.875rem', fontWeight: 600, cursor: deactivateConfirmed ? 'pointer' : 'not-allowed' }}>
                        Xác nhận vô hiệu hóa
                      </button>
                    </AlertDialog.Action>
                  </div>
                </div>
              </>
            )}
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
