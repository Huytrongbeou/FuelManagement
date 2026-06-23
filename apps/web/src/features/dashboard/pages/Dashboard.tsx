import { useState, lazy, Suspense } from 'react';
const DashboardCharts = lazy(() => import('../components/DashboardCharts'));
import {
  MapPin, AlertTriangle, CheckCircle, HelpCircle, TrendingUp,
  Clock, Activity, Fuel, Filter
} from 'lucide-react';
import { LazyMotion, domAnimation } from 'motion/react';
import { Station, getFuelStatus, fuelStatusColor } from '@/shared/types';
import { FuelBadge } from '@/features/stations/components/FuelBadge';
import { StatCard } from '../components/StatCard';

interface DashboardProps {
  stations: Station[];
  onViewStation: (id: string) => void;
}

const COLORS_PIE = ['#16a34a', '#ca8a04', '#dc2626', '#94a3b8'];

const TIME_FILTERS = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'week',  label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year',  label: 'Năm' },
];

export function Dashboard({ stations, onViewStation }: DashboardProps) {
  const [timeFilter, setTimeFilter] = useState('today');

  const green  = stations.filter(s => getFuelStatus(s.currentFuel) === 'green').length;
  const yellow = stations.filter(s => getFuelStatus(s.currentFuel) === 'yellow').length;
  const red    = stations.filter(s => getFuelStatus(s.currentFuel) === 'red').length;
  const gray   = stations.filter(s => getFuelStatus(s.currentFuel) === 'gray').length;
  const noCoords = stations.filter(s => s.lat === null || s.lng === null).length;
  const totalFuel = stations.reduce((acc, s) => acc + (s.currentFuel ?? 0), 0);
  const updatedToday = stations.filter(s => s.updatedToday).length;

  const pieData = [
    { name: 'Đủ nhiên liệu',  value: green,  color: '#16a34a' },
    { name: 'Sắp hết',        value: yellow, color: '#ca8a04' },
    { name: 'Nguy hiểm',      value: red,    color: '#dc2626' },
    { name: 'Chưa có dữ liệu',value: gray,   color: '#94a3b8' },
  ];

  const barData = [
    { name: 'T1', total: 820, updated: 24 },
    { name: 'T2', total: 932, updated: 26 },
    { name: 'T3', total: 901, updated: 28 },
    { name: 'T4', total: 1134, updated: 25 },
    { name: 'T5', total: 1290, updated: 27 },
    { name: 'T6', total: totalFuel, updated: updatedToday },
  ];

  const lowFuelStations = stations
    .filter(s => getFuelStatus(s.currentFuel) === 'red' || getFuelStatus(s.currentFuel) === 'yellow')
    .sort((a, b) => (a.currentFuel ?? 0) - (b.currentFuel ?? 0))
    .slice(0, 6);

  const recentUpdates = stations
    .filter(s => s.lastUpdated)
    .sort((a, b) => (b.lastUpdated ?? '').localeCompare(a.lastUpdated ?? ''))
    .slice(0, 6);


  return (
    <LazyMotion features={domAnimation}>
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 style={{ color: '#0f172a' }}>Tổng quan hệ thống</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Cập nhật: 12/06/2026 08:30</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f1f5f9' }}>
          {TIME_FILTERS.map(f => (
            <button
              type="button"
              key={f.key}
              onClick={() => setTimeFilter(f.key)}
              className="px-3 py-1.5 rounded-lg transition-all"
              style={{
                fontSize: '0.8rem',
                fontWeight: timeFilter === f.key ? 600 : 400,
                background: timeFilter === f.key ? 'white' : 'transparent',
                color: timeFilter === f.key ? '#0f172a' : '#64748b',
                boxShadow: timeFilter === f.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-4">
        <StatCard title="Tổng số trạm"        value={stations.length}   icon={MapPin}       color="#2563eb" delay={0}    />
        <StatCard title="Tổng NL tồn (L)"   value={totalFuel}         icon={Fuel}         color="#0891b2" delay={0.05} sub={`TB ${Math.round(totalFuel / stations.length)} L/trạm`} />
        <StatCard title="Trạm xanh"         value={green}             icon={CheckCircle}  color="#16a34a" delay={0.1}  />
        <StatCard title="Trạm vàng"         value={yellow}            icon={AlertTriangle} color="#ca8a04" delay={0.15} />
        <StatCard title="Trạm đỏ"           value={red}               icon={AlertTriangle} color="#dc2626" delay={0.2}  />
        <StatCard title="Chưa có dữ liệu"   value={gray}              icon={HelpCircle}   color="#94a3b8" delay={0.25} />
        <StatCard title="Cập nhật hôm nay"  value={updatedToday}      icon={Clock}        color="#7c3aed" delay={0.3}  sub={`${stations.length - updatedToday} chưa cập nhật`} />
        <StatCard title="Chưa có tọa độ"    value={noCoords}          icon={HelpCircle}   color="#ea580c" delay={0.35} sub="Không hiển thị trên bản đồ" />
      </div>

      {/* Charts + tables row */}
      <Suspense fallback={<div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8' }}>Đang tải biểu đồ…</div>}>
        <DashboardCharts pieData={pieData} barData={barData} />
      </Suspense>

      {/* Low fuel + recent updates */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low fuel stations */}
        <div className="rounded-xl border" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: '#dc2626' }} />
              <h4 style={{ color: '#0f172a' }}>Trạm nhiên liệu thấp</h4>
            </div>
            <span className="px-2.5 py-1 rounded-full" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.75rem', fontWeight: 600 }}>
              {lowFuelStations.length} trạm
            </span>
          </div>
          <div className="divide-y" style={{ divideColor: '#f8fafc' }}>
            {lowFuelStations.map(s => {
              const status = getFuelStatus(s.currentFuel);
              const pct = s.currentFuel !== null ? Math.round((s.currentFuel / s.maxCapacity) * 100) : 0;
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span style={{ fontFamily: 'monospace', fontSize: '0.75rem', color: '#94a3b8' }}>{s.code}</span>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: '#f1f5f9', maxWidth: '100px' }}>
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: status === 'red' ? '#dc2626' : '#ca8a04' }} />
                      </div>
                      <span style={{ fontSize: '0.75rem', color: '#64748b' }}>{s.currentFuel}L / {s.maxCapacity}L</span>
                    </div>
                  </div>
                  <FuelBadge fuel={s.currentFuel} />
                  <button
                    type="button"
                    onClick={() => onViewStation(s.id)}
                    className="opacity-0 group-hover:opacity-100 px-2.5 py-1 rounded-lg transition-all"
                    style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.75rem' }}
                  >
                    Xem
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Recent updates */}
        <div className="rounded-xl border" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <div className="flex items-center gap-2 px-5 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
            <Activity size={18} style={{ color: '#2563eb' }} />
            <h4 style={{ color: '#0f172a' }}>Cập nhật gần đây</h4>
          </div>
          <div className="divide-y" style={{ divideColor: '#f8fafc' }}>
            {recentUpdates.map(s => {
              const c = fuelStatusColor(getFuelStatus(s.currentFuel));
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: c.bg }}
                  >
                    <MapPin size={14} style={{ color: c.dot }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {s.lastUpdated} · {s.currentFuel !== null ? `${s.currentFuel} L` : '—'}
                    </div>
                  </div>
                  <FuelBadge fuel={s.currentFuel} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
    </LazyMotion>
  );
}
