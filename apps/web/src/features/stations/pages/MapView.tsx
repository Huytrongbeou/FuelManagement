import { useEffect, useRef, useState } from 'react';
import { X, Droplets, Clock, ExternalLink, AlertTriangle } from 'lucide-react';
import { Station, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix Leaflet default icon paths (broken in bundlers)
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

// Cao Lãnh city center
const CAO_LANH_CENTER: [number, number] = [10.4574, 105.6379];
const DEFAULT_ZOOM = 13;

function makeMarkerIcon(color: string, size: number = 12) {
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:${size * 2}px; height:${size * 2}px;
        background:${color};
        border:3px solid white;
        border-radius:50%;
        box-shadow:0 2px 6px rgba(0,0,0,0.35);
        display:flex; align-items:center; justify-content:center;
      "></div>`,
    iconSize: [size * 2, size * 2],
    iconAnchor: [size, size],
    popupAnchor: [0, -size],
  });
}

function makePulseIcon(color: string) {
  return L.divIcon({
    className: '',
    html: `
      <div style="position:relative;width:28px;height:28px">
        <div style="
          position:absolute;inset:0;
          background:${color}40;
          border-radius:50%;
          animation:ping 1s cubic-bezier(0,0,.2,1) infinite;
        "></div>
        <div style="
          position:absolute;inset:4px;
          background:${color};
          border:3px solid white;
          border-radius:50%;
          box-shadow:0 2px 6px rgba(0,0,0,0.35);
        "></div>
      </div>
      <style>@keyframes ping{0%{transform:scale(1);opacity:.7}100%{transform:scale(2.2);opacity:0}}</style>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
  });
}

interface Props {
  stations: Station[];
  onViewStation: (id: string) => void;
}

export function MapView({ stations, onViewStation }: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const mapDivRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<L.Marker[]>([]);
  const [selectedStation, setSelectedStation] = useState<Station | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');

  const green  = stations.filter(s => getFuelStatus(s.currentFuel) === 'green').length;
  const yellow = stations.filter(s => getFuelStatus(s.currentFuel) === 'yellow').length;
  const red    = stations.filter(s => getFuelStatus(s.currentFuel) === 'red').length;
  const gray   = stations.filter(s => getFuelStatus(s.currentFuel) === 'gray').length;

  const filtered = filterStatus === 'all'
    ? stations
    : stations.filter(s => getFuelStatus(s.currentFuel) === filterStatus);

  // Init map
  useEffect(() => {
    if (!mapDivRef.current || mapRef.current) return;
    const map = L.map(mapDivRef.current, {
      center: CAO_LANH_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    filtered.forEach(s => {
      if (s.lat === null || s.lng === null) return;
        const status = getFuelStatus(s.currentFuel);
        const c = fuelStatusColor(status);
        const icon = status === 'red' ? makePulseIcon(c.dot) : makeMarkerIcon(c.dot, status === 'gray' ? 9 : 11);
        const marker = L.marker([s.lat!, s.lng!], { icon }).addTo(map);
        marker.on('click', () => setSelectedStation(prev => prev?.id === s.id ? null : s));
        markersRef.current.push(marker);
      });

    return () => {
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
    };
  }, [filtered, filterStatus]);

  const statusFilters = [
    { key: 'all',    label: 'Tất cả',          count: stations.length, color: '#475569' },
    { key: 'green',  label: 'Đủ nhiên liệu',   count: green,   color: '#16a34a' },
    { key: 'yellow', label: 'Sắp hết',          count: yellow,  color: '#ca8a04' },
    { key: 'red',    label: 'Nguy hiểm',        count: red,     color: '#dc2626' },
    { key: 'gray',   label: 'Chưa có dữ liệu', count: gray,    color: '#94a3b8' },
  ];

  const noCoords = stations.filter(s => s.lat === null || s.lng === null).length;

  return (
    <div className="flex h-full" style={{ height: 'calc(100vh - 60px)' }}>
      {/* Side panel */}
      <div className="flex flex-col w-72 flex-shrink-0 border-r overflow-y-auto" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <div className="px-4 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
          <h3 style={{ color: '#0f172a', marginBottom: '4px' }}>Bản đồ trạm</h3>
          <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '12px' }}>TP. Cao Lãnh, Đồng Tháp</p>

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'Tổng trạm',  value: stations.length, bg: '#f1f5f9', text: '#475569' },
              { label: 'Nguy hiểm',  value: red,             bg: '#fee2e2', text: '#b91c1c' },
              { label: 'Sắp hết',    value: yellow,          bg: '#fef9c3', text: '#a16207' },
              { label: 'Chưa có DL', value: gray,            bg: '#f8fafc', text: '#64748b' },
            ].map(s => (
              <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ background: s.bg }}>
                <div style={{ fontSize: '1.4rem', fontWeight: 700, color: s.text, lineHeight: 1.1 }}>{s.value}</div>
                <div style={{ fontSize: '0.75rem', color: s.text + 'cc' }}>{s.label}</div>
              </div>
            ))}
          </div>

          {noCoords > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg mb-3" style={{ background: '#fef9c3', border: '1px solid #fde047' }}>
              <AlertTriangle size={13} style={{ color: '#a16207', flexShrink: 0 }} />
              <span style={{ fontSize: '0.75rem', color: '#a16207' }}>{noCoords} trạm chưa có tọa độ</span>
            </div>
          )}

          <div className="space-y-1">
            {statusFilters.map(f => (
              <button
                type="button"
                key={f.key}
                onClick={() => { setFilterStatus(f.key); setSelectedStation(null); }}
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
                <span className="px-2 py-0.5 rounded-full" style={{ fontSize: '0.75rem', fontWeight: 600, background: f.color + '20', color: f.color }}>
                  {f.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Station list */}
        <div className="flex-1 overflow-y-auto">
          <div className="px-2 py-2 space-y-1">
            {filtered.map(s => {
              const status = getFuelStatus(s.currentFuel);
              const c = fuelStatusColor(status);
              const hasCoords = s.lat !== null && s.lng !== null;
              return (
                <button
                  type="button"
                  key={s.id}
                  onClick={() => {
                    setSelectedStation(s);
                    if (hasCoords && mapRef.current) {
                      mapRef.current.setView([s.lat!, s.lng!], 15, { animate: true });
                    }
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all"
                  style={{
                    background: selectedStation?.id === s.id ? '#eff6ff' : 'transparent',
                    border: `1px solid ${selectedStation?.id === s.id ? '#dbeafe' : 'transparent'}`,
                    opacity: hasCoords ? 1 : 0.6,
                  }}
                >
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: c.dot }}>
                    <span style={{ color: 'white', fontSize: '0.75rem', fontWeight: 700 }}>{s.code.replace('CL-', '')}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {hasCoords
                        ? (s.currentFuel !== null ? `${s.currentFuel} L` : 'Chưa có dữ liệu')
                        : 'Chưa có tọa độ'}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        <div ref={mapDivRef} style={{ width: '100%', height: '100%' }} />

        {/* Station popup */}
        {selectedStation && (() => {
          const status = getFuelStatus(selectedStation.currentFuel);
          const c = fuelStatusColor(status);
          return (
            <div
              className="absolute top-4 right-4 rounded-xl border shadow-xl overflow-hidden"
              style={{ background: 'white', borderColor: '#e2e8f0', width: '280px', zIndex: 1000 }}
            >
              <div className="flex items-start justify-between px-4 py-3 border-b" style={{ borderColor: '#f1f5f9', background: c.bg }}>
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: c.text, background: 'white', padding: '1px 6px', borderRadius: '4px', border: `1px solid ${c.border}` }}>
                      {selectedStation.code}
                    </span>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: 'white', color: c.text, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                      {fuelStatusLabel(status)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#1e293b' }}>{selectedStation.name}</div>
                </div>
                <button type="button" onClick={() => setSelectedStation(null)} style={{ color: '#94a3b8' }}>
                  <X size={16} />
                </button>
              </div>
              <div className="px-4 py-3 space-y-2">
                {selectedStation.address && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{selectedStation.address}</div>
                )}
                {selectedStation.brandName && (
                  <div style={{ fontSize: '0.8rem', color: '#64748b' }}>
                    {selectedStation.brandName} {selectedStation.modelName}
                  </div>
                )}
                <div className="flex items-center gap-2" style={{ fontSize: '0.8rem' }}>
                  <Droplets size={13} style={{ color: c.dot }} />
                  <span style={{ fontWeight: 600, color: c.text }}>
                    {selectedStation.currentFuel !== null ? `${selectedStation.currentFuel} L` : 'Chưa có dữ liệu'}
                  </span>
                  {selectedStation.currentFuel !== null && (
                    <span style={{ color: '#94a3b8' }}>/ {selectedStation.maxCapacity} L</span>
                  )}
                </div>
                {selectedStation.currentFuel !== null && (
                  <div className="h-2 rounded-full" style={{ background: '#f1f5f9' }}>
                    <div className="h-full rounded-full" style={{
                      width: `${Math.min(100, Math.round((selectedStation.currentFuel / selectedStation.maxCapacity) * 100))}%`,
                      background: c.dot,
                    }} />
                  </div>
                )}
                <div className="flex items-center gap-2" style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                  <Clock size={12} />
                  <span>Cập nhật: {selectedStation.lastUpdated
                    ? new Date(selectedStation.lastUpdated).toLocaleDateString('vi-VN')
                    : 'Chưa có'}</span>
                </div>
                {(selectedStation.lat === null || selectedStation.lng === null) && (
                  <div className="flex items-center gap-2 px-2 py-1.5 rounded" style={{ background: '#fef9c3', fontSize: '0.75rem', color: '#a16207' }}>
                    <AlertTriangle size={12} />
                    Chưa có tọa độ — không hiển thị trên bản đồ
                  </div>
                )}
              </div>
              <div className="px-4 py-3 border-t" style={{ borderColor: '#f1f5f9' }}>
                <button
                  type="button"
                  onClick={() => onViewStation(selectedStation.id)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg"
                  style={{ background: '#2563eb', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}
                >
                  <ExternalLink size={13} />
                  Xem lịch sử trạm
                </button>
              </div>
            </div>
          );
        })()}

        {/* Legend */}
        <div
          className="absolute rounded-xl p-3 space-y-1.5"
          style={{ bottom: '24px', left: '16px', background: 'white', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', zIndex: 1000 }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, marginBottom: '6px' }}>CHÚ GIẢI</div>
          {[
            { color: '#16a34a', label: '> 20 L — Đủ nhiên liệu' },
            { color: '#ca8a04', label: '10–20 L — Sắp hết' },
            { color: '#dc2626', label: '< 10 L — Nguy hiểm' },
            { color: '#94a3b8', label: 'Chưa có dữ liệu' },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: item.color }} />
              <span style={{ fontSize: '0.75rem', color: '#475569' }}>{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
