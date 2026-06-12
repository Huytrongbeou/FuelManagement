import { useState } from 'react';
import { X, MapPin, Zap, Droplets, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { Station, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '../types';

interface MapViewProps {
  stations: Station[];
  onViewStation: (id: string) => void;
}

// Vietnam bounding box: lat 8.5–23.5, lng 102–109.5
const LAT_MIN = 8.5, LAT_MAX = 23.5;
const LNG_MIN = 102, LNG_MAX = 109.5;

function latToY(lat: number) {
  return ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * 100;
}
function lngToX(lng: number) {
  return ((lng - LNG_MIN) / (LNG_MAX - LNG_MIN)) * 100;
}

// Simplified Vietnam SVG path
const VIETNAM_PATH = `
M 45,2 L 55,5 L 65,8 L 72,12 L 75,18 L 70,22 L 72,28 L 78,32 L 82,38 L 80,44
L 85,50 L 82,56 L 78,62 L 72,66 L 68,72 L 65,78 L 62,82 L 58,87 L 52,91
L 46,93 L 40,96 L 35,95 L 30,90 L 28,85 L 30,80 L 32,76 L 28,72 L 24,68
L 22,62 L 26,58 L 28,52 L 24,46 L 20,40 L 22,34 L 26,28 L 30,22 L 36,16
L 40,10 L 43,5 Z
`;

export function MapView({ stations, onViewStation }: MapViewProps) {
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const green  = stations.filter(s => getFuelStatus(s.currentFuel) === 'green').length;
  const yellow = stations.filter(s => getFuelStatus(s.currentFuel) === 'yellow').length;
  const red    = stations.filter(s => getFuelStatus(s.currentFuel) === 'red').length;
  const gray   = stations.filter(s => getFuelStatus(s.currentFuel) === 'gray').length;

  const filtered = filterStatus === 'all' ? stations : stations.filter(s => getFuelStatus(s.currentFuel) === filterStatus);

  const statusFilters = [
    { key: 'all',    label: 'Tất cả',          count: stations.length, color: '#475569' },
    { key: 'green',  label: 'Đủ nhiên liệu',   count: green,   color: '#16a34a' },
    { key: 'yellow', label: 'Sắp hết',          count: yellow,  color: '#ca8a04' },
    { key: 'red',    label: 'Nguy hiểm',        count: red,     color: '#dc2626' },
    { key: 'gray',   label: 'Chưa có dữ liệu', count: gray,    color: '#94a3b8' },
  ];

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Side panel */}
      <div className="flex flex-col w-72 flex-shrink-0 border-r overflow-y-auto" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
          <h3 style={{ color: '#0f172a', marginBottom: '12px' }}>Bản đồ trạm</h3>

          {/* Summary */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'Tổng trạm',   value: stations.length, bg: '#f1f5f9', text: '#475569' },
              { label: 'Trạm đỏ',     value: red,             bg: '#fee2e2', text: '#b91c1c' },
              { label: 'Trạm vàng',   value: yellow,          bg: '#fef9c3', text: '#a16207' },
              { label: 'Chưa có DL',  value: gray,            bg: '#f8fafc', text: '#64748b' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: s.bg }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.text, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: '0.7rem', color: s.text + 'cc' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {/* Status filters */}
          <div className="space-y-1">
            {statusFilters.map(f => (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all"
                style={{
                  background: filterStatus === f.key ? f.color + '18' : 'transparent',
                  border: `1px solid ${filterStatus === f.key ? f.color + '40' : 'transparent'}`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ background: f.color }} />
                  <span style={{ fontSize: '0.8rem', color: '#374151' }}>{f.label}</span>
                </div>
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: '0.72rem', fontWeight: 600, background: f.color + '20', color: f.color }}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Station list in panel */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2 space-y-1">
            {filtered.map(s => {
              const status = getFuelStatus(s.currentFuel);
              const c = fuelStatusColor(status);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedStation(s)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: selectedStation?.id === s.id ? '#eff6ff' : 'transparent',
                    border: `1px solid ${selectedStation?.id === s.id ? '#dbeafe' : 'transparent'}`,
                  }}
                  onMouseEnter={e => { if (selectedStation?.id !== s.id) (e.currentTarget as HTMLElement).style.background = '#f8fafc'; }}
                  onMouseLeave={e => { if (selectedStation?.id !== s.id) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.dot }}>
                    <MapPin size={12} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                      {s.currentFuel !== null ? `${s.currentFuel} L` : 'Chưa có dữ liệu'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#e8f0f7' }}>
        {/* Map background grid */}
        <svg width="100%" height="100%" className="absolute inset-0" style={{ opacity: 0.3 }}>
          <defs>
            <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#94a3b8" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>

        {/* Vietnam silhouette */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="h-full opacity-10" style={{ maxHeight: '100%', fill: '#1e40af' }}>
            <path d={VIETNAM_PATH} />
          </svg>
        </div>

        {/* Region labels */}
        {[
          { label: 'Miền Bắc', lat: 21.5, lng: 105.5 },
          { label: 'Miền Trung', lat: 16.5, lng: 107.0 },
          { label: 'Miền Nam', lat: 10.5, lng: 106.5 },
        ].map(r => (
          <div
            key={r.label}
            className="absolute pointer-events-none"
            style={{
              left: `${lngToX(r.lng)}%`,
              top: `${latToY(r.lat)}%`,
              transform: 'translate(-50%, -50%)',
              color: '#94a3b8',
              fontSize: '0.72rem',
              fontWeight: 600,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
            }}
          >
            {r.label}
          </div>
        ))}

        {/* Station markers */}
        {filtered.map(s => {
          const status = getFuelStatus(s.currentFuel);
          const c = fuelStatusColor(status);
          const x = lngToX(s.lng);
          const y = latToY(s.lat);
          const isSelected = selectedStation?.id === s.id;
          return (
            <button
              key={s.id}
              onClick={() => setSelectedStation(s === selectedStation ? null : s)}
              className="absolute transition-all"
              style={{
                left: `${x}%`,
                top: `${y}%`,
                transform: 'translate(-50%, -50%)',
                zIndex: isSelected ? 20 : status === 'red' ? 10 : 5,
              }}
            >
              <div
                className="flex items-center justify-center rounded-full border-2 transition-all"
                style={{
                  width: isSelected ? '36px' : status === 'red' ? '28px' : '22px',
                  height: isSelected ? '36px' : status === 'red' ? '28px' : '22px',
                  background: c.dot,
                  borderColor: 'white',
                  boxShadow: isSelected
                    ? `0 0 0 4px ${c.dot}40, 0 4px 12px ${c.dot}60`
                    : status === 'red'
                    ? `0 0 0 3px ${c.dot}40, 0 2px 8px rgba(0,0,0,0.2)`
                    : `0 2px 6px rgba(0,0,0,0.2)`,
                }}
              >
                <MapPin size={isSelected ? 16 : 10} className="text-white" />
              </div>
              {/* Pulse for red stations */}
              {status === 'red' && !isSelected && (
                <span className="absolute inset-0 rounded-full animate-ping" style={{ background: c.dot + '40' }} />
              )}
            </button>
          );
        })}

        {/* Legend */}
        <div
          className="absolute bottom-4 right-4 rounded-xl p-3 space-y-1.5"
          style={{ background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', minWidth: '150px' }}
        >
          <div style={{ fontSize: '0.72rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>CHÚ GIẢI</div>
          {[
            { color: '#16a34a', label: '> 20 L — Đủ nhiên liệu' },
            { color: '#ca8a04', label: '10–20 L — Sắp hết' },
            { color: '#dc2626', label: '< 10 L — Nguy hiểm' },
            { color: '#94a3b8', label: 'Chưa có dữ liệu' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span style={{ fontSize: '0.72rem', color: '#475569' }}>{item.label}</span>
            </div>
          ))}
        </div>

        {/* Station popup */}
        {selectedStation && (() => {
          const status = getFuelStatus(selectedStation.currentFuel);
          const c = fuelStatusColor(status);
          return (
            <div
              className="absolute top-4 right-4 rounded-xl border shadow-xl overflow-hidden"
              style={{ background: 'white', borderColor: '#e2e8f0', width: '280px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)', zIndex: 30 }}
            >
              <div className="flex items-start justify-between px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', background: c.bg }}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span style={{ fontFamily: 'monospace', fontSize: '0.72rem', color: c.text, background: c.bg + 'dd', padding: '1px 6px', borderRadius: '4px', border: `1px solid ${c.border}` }}>
                      {selectedStation.code}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'white', color: c.text, fontSize: '0.7rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                      {fuelStatusLabel(status)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{selectedStation.name}</div>
                </div>
                <button onClick={() => setSelectedStation(null)} style={{ color: '#94a3b8', marginTop: '2px' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-3 space-y-2">
                <div className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <MapPin size={13} />
                  <span style={{ lineHeight: 1.4 }}>{selectedStation.address}</span>
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <Zap size={13} />
                  <span>{selectedStation.generatorType}</span>
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  <Droplets size={13} />
                  <span style={{ fontWeight: 600, color: c.text }}>
                    {selectedStation.currentFuel !== null ? `${selectedStation.currentFuel} L` : 'Chưa có dữ liệu'}
                  </span>
                  {selectedStation.currentFuel !== null && (
                    <span style={{ color: '#94a3b8' }}>/ {selectedStation.maxCapacity} L</span>
                  )}
                </div>
                <div className="flex items-center gap-2" style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
                  <Clock size={13} />
                  <span>Cập nhật: {selectedStation.lastUpdated ?? 'Chưa có'}</span>
                </div>
                {selectedStation.currentFuel !== null && (
                  <div className="pt-1">
                    <div className="h-2 rounded-full" style={{ background: '#f1f5f9' }}>
                      <div className="h-full rounded-full" style={{
                        width: `${Math.round((selectedStation.currentFuel / selectedStation.maxCapacity) * 100)}%`,
                        background: c.dot,
                      }} />
                    </div>
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t" style={{ borderColor: '#f1f5f9' }}>
                <button
                  onClick={() => onViewStation(selectedStation.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg transition-all"
                  style={{ background: '#2563eb', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1d4ed8'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#2563eb'}
                >
                  <ExternalLink size={13} />
                  Xem lịch sử trạm
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
