import { useState } from 'react';
import { Search, Download, Upload, Bell, Menu, CheckCircle2, RefreshCw } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { toast } from 'sonner';
import { Station, getFuelStatus } from '@/@types';
import { downloadWithAuth } from '@/api/client';
import { canEnterFuel } from '@/utils/permissions';

interface TopbarProps {
  stations: Station[];
  onMobileMenuOpen: () => void;
  onNavigateToStation?: (stationId: string) => void;
  onNavigateToImport?: () => void;
  userRole?: string;
}

const SEEN_ALERTS_KEY = 'fuel:v1:seenAlerts';

/**
 * Identifies an alert by station *and* severity, so a station sliding from yellow to red counts
 * as something new to look at rather than staying silently "already seen".
 */
function alertKey(stationId: string, status: string) {
  return `${stationId}:${status}`;
}

function loadSeenAlerts(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_ALERTS_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

export function Topbar({ stations, onMobileMenuOpen, onNavigateToStation, onNavigateToImport, userRole }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [showAlerts, setShowAlerts] = useState(false);
  const [seenAlerts, setSeenAlerts] = useState<Set<string>>(loadSeenAlerts);

  // Stations needing attention: red (< 10 L) first, then yellow (10–20 L). Stations with no
  // fuel data yet are excluded — "unknown" is not an alert.
  const alerts = stations
    .filter(s => {
      const status = getFuelStatus(s.currentFuel, s.fuelRate);
      return status === 'red' || status === 'yellow';
    })
    .sort((a, b) => {
      const rank = (s: Station) => (getFuelStatus(s.currentFuel, s.fuelRate) === 'red' ? 0 : 1);
      return rank(a) - rank(b) || (a.currentFuel ?? 0) - (b.currentFuel ?? 0);
    });

  // These alerts are derived live from fuel levels, not a message inbox: a low station stays low
  // until someone refuels it. So the badge counts only what hasn't been looked at yet, while the
  // dropdown still lists every station that needs attention.
  const unseenCount = alerts.reduce(
    (n, s) => n + (seenAlerts.has(alertKey(s.id, getFuelStatus(s.currentFuel, s.fuelRate))) ? 0 : 1),
    0
  );

  const openAlerts = () => {
    setShowAlerts(true);
    const next = new Set(seenAlerts);
    for (const s of alerts) next.add(alertKey(s.id, getFuelStatus(s.currentFuel, s.fuelRate)));
    setSeenAlerts(next);
    // Keep only keys still relevant, so the list can't grow without bound as stations recover.
    const live = new Set(alerts.map(s => alertKey(s.id, getFuelStatus(s.currentFuel, s.fuelRate))));
    try {
      localStorage.setItem(SEEN_ALERTS_KEY, JSON.stringify([...next].filter(k => live.has(k))));
    } catch {}
  };

  const results = query.length > 1
    ? stations.filter(s =>
        s.code.toLowerCase().includes(query.toLowerCase()) ||
        s.name.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 5)
    : [];

  const handleRefresh = async () => {
    setSyncing(true);
    await new Promise(r => setTimeout(r, 1500));
    setSyncing(false);
  };

  return (
    <Tooltip.Provider delayDuration={300}>
      <div
        className="flex items-center gap-4 px-4 lg:px-6 py-3 border-b shrink-0"
        style={{ background: 'white', borderColor: '#e2e8f0', height: '60px' }}
      >
        {/* Mobile menu */}
        <button
          type="button"
          className="lg:hidden p-2 rounded-lg transition-colors"
          style={{ color: '#475569' }}
          onClick={onMobileMenuOpen}
        >
          <Menu size={20} />
        </button>

        {/* Search */}
        <div className="flex-1 max-w-sm relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
          <input
            type="text"
            aria-label="Tìm theo mã trạm / tên trạm"
            value={query}
            onChange={e => { setQuery(e.target.value); setShowResults(true); }}
            onBlur={() => setTimeout(() => setShowResults(false), 200)}
            onFocus={() => setShowResults(true)}
            placeholder="Tìm theo mã trạm / tên trạm..."
            className="w-full pl-9 pr-4 py-2 rounded-lg border outline-none"
            style={{
              fontSize: '0.85rem',
              borderColor: '#e2e8f0',
              background: '#f8fafc',
              color: '#1e293b',
            }}
          />
          {showResults && results.length > 0 && (
            <div
              className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-[1200] overflow-hidden"
              style={{ background: 'white', borderColor: '#e2e8f0' }}
            >
              {results.map(s => (
                <button
                  type="button"
                  key={s.id}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ fontSize: '0.85rem', color: '#374151' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  onClick={() => {
                    onNavigateToStation?.(s.id);
                    setQuery('');
                    setShowResults(false);
                  }}
                >
                  <span style={{ color: '#94a3b8', fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.code}</span>
                  <span>{s.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Sync status */}
          <div
            className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: '#f0fdf4', fontSize: '0.8rem', color: '#16a34a' }}
          >
            {syncing
              ? <RefreshCw size={13} className="animate-spin" style={{ color: '#2563eb' }} />
              : <CheckCircle2 size={13} />
            }
            <span style={{ color: syncing ? '#2563eb' : '#16a34a' }}>
              {syncing ? 'Đang đồng bộ...' : 'Đã cập nhật'}
            </span>
          </div>

          {/* Export */}
          <Tooltip.Root>
            <Tooltip.Trigger asChild>
              <button
                type="button"
                onClick={() => downloadWithAuth('export/snapshot', 'fuel-snapshot.xlsx').catch(e => toast.error((e as Error).message))}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border transition"
                style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.85rem', background: 'white' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}
              >
                <Download size={16} />
                <span className="hidden md:inline">Export</span>
              </button>
            </Tooltip.Trigger>
            <Tooltip.Portal>
              <Tooltip.Content className="rounded-lg px-3 py-2 shadow-lg text-sm" style={{ background: '#1e293b', color: 'white', fontSize: '0.8rem' }} sideOffset={5}>
                Export file Excel tổng
                <Tooltip.Arrow style={{ fill: '#1e293b' }} />
              </Tooltip.Content>
            </Tooltip.Portal>
          </Tooltip.Root>

          {/* Import — only for roles that may actually import (same rule as the sidebar's
              "Nhập liệu" group); navigates to the Import Excel page. */}
          {canEnterFuel(userRole) && (
            <button
              type="button"
              onClick={onNavigateToImport}
              className="flex items-center gap-2 px-3 py-2 rounded-lg transition"
              style={{ background: '#2563eb', color: 'white', fontSize: '0.85rem' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1d4ed8'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#2563eb'}
            >
              <Upload size={16} />
              <span className="hidden md:inline">Import</span>
            </button>
          )}

          {/* Notifications — real fuel alerts derived from the stations already loaded */}
          <div className="relative">
            <button
              type="button"
              onClick={() => (showAlerts ? setShowAlerts(false) : openAlerts())}
              aria-label={`Thông báo${unseenCount ? ` (${unseenCount} cảnh báo chưa xem)` : ''}`}
              className="relative p-2 rounded-lg transition-colors"
              style={{ color: '#475569' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            >
              <Bell size={18} />
              {/* Badge counts unseen alerts only, so it clears once they've been read */}
              {unseenCount > 0 && (
                <span
                  className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full flex items-center justify-center"
                  style={{ background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 700 }}
                >
                  {unseenCount > 99 ? '99+' : unseenCount}
                </span>
              )}
            </button>

            {showAlerts && (
              <>
                <div className="fixed inset-0 z-[1190]" onClick={() => setShowAlerts(false)} aria-hidden="true" />
                <div
                  className="absolute right-0 mt-2 rounded-xl border shadow-xl z-[1200] overflow-hidden"
                  style={{ background: 'white', borderColor: '#e2e8f0', width: 'min(320px, calc(100vw - 2rem))' }}
                >
                  <div className="px-4 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div style={{ fontWeight: 600, color: '#0f172a', fontSize: '0.9rem' }}>Cảnh báo nhiên liệu</div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {alerts.length > 0 ? `${alerts.length} trạm cần chú ý` : 'Không có cảnh báo'}
                    </div>
                  </div>

                  {alerts.length === 0 ? (
                    <div className="px-4 py-6 text-center" style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
                      Tất cả trạm đều đủ nhiên liệu.
                    </div>
                  ) : (
                    <div className="max-h-80 overflow-y-auto">
                      {alerts.map(s => {
                        const danger = getFuelStatus(s.currentFuel, s.fuelRate) === 'red';
                        return (
                          <button
                            type="button"
                            key={s.id}
                            onClick={() => { onNavigateToStation?.(s.id); setShowAlerts(false); }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors border-b last:border-b-0"
                            style={{ borderColor: '#f8fafc' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                          >
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ background: danger ? '#dc2626' : '#ca8a04' }}
                            />
                            <span className="flex-1 min-w-0">
                              <span className="block truncate" style={{ fontSize: '0.82rem', color: '#1e293b' }}>{s.name}</span>
                              <span style={{ fontSize: '0.72rem', color: '#94a3b8', fontFamily: 'monospace' }}>{s.code}</span>
                            </span>
                            <span
                              className="shrink-0"
                              style={{ fontSize: '0.8rem', fontWeight: 700, color: danger ? '#dc2626' : '#ca8a04' }}
                            >
                              {s.currentFuel}L
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Avatar */}
          <button
            type="button"
            className="flex items-center justify-center w-8 h-8 rounded-full shrink-0 transition-opacity hover:opacity-80"
            style={{ background: '#2563eb', color: 'white', fontSize: '0.85rem', fontWeight: 700 }}
          >
            A
          </button>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
