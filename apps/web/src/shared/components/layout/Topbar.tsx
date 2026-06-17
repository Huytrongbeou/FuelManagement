import { useState } from 'react';
import { Search, Download, Upload, Bell, Menu, CheckCircle2, RefreshCw } from 'lucide-react';
import * as Tooltip from '@radix-ui/react-tooltip';
import { Station } from '@/shared/types';

interface TopbarProps {
  stations: Station[];
  onMobileMenuOpen: () => void;
  onNavigateToStation?: (stationId: string) => void;
}

export function Topbar({ stations, onMobileMenuOpen, onNavigateToStation }: TopbarProps) {
  const [query, setQuery] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [showResults, setShowResults] = useState(false);

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
        className="flex items-center gap-4 px-4 lg:px-6 py-3 border-b flex-shrink-0"
        style={{ background: 'white', borderColor: '#e2e8f0', height: '60px' }}
      >
        {/* Mobile menu */}
        <button
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
              className="absolute top-full left-0 right-0 mt-1 rounded-lg border shadow-lg z-50 overflow-hidden"
              style={{ background: 'white', borderColor: '#e2e8f0' }}
            >
              {results.map(s => (
                <button
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
                className="flex items-center gap-2 px-3 py-2 rounded-lg border transition-all"
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

          {/* Import */}
          <button
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-all"
            style={{ background: '#2563eb', color: 'white', fontSize: '0.85rem' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1d4ed8'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#2563eb'}
          >
            <Upload size={16} />
            <span className="hidden md:inline">Import</span>
          </button>

          {/* Notification */}
          <button
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: '#475569' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
          >
            <Bell size={18} />
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
              style={{ background: '#ef4444' }}
            />
          </button>

          {/* Avatar */}
          <button
            className="flex items-center justify-center w-8 h-8 rounded-full flex-shrink-0 transition-opacity hover:opacity-80"
            style={{ background: '#2563eb', color: 'white', fontSize: '0.85rem', fontWeight: 700 }}
          >
            A
          </button>
        </div>
      </div>
    </Tooltip.Provider>
  );
}
