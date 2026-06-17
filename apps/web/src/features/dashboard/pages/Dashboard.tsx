import { useState } from 'react';
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from 'recharts';
import {
  MapPin, AlertTriangle, CheckCircle, HelpCircle, TrendingUp,
  Clock, Activity, Fuel, Filter
} from 'lucide-react';
import { motion } from 'motion/react';
import { Station, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';

interface DashboardProps {
  stations: Station[];
  onViewStation: (id: string) => void;
}

const COLORS_PIE = ['#16a34a', '#ca8a04', '#dc2626', '#94a3b8'];

function StatCard({ title, value, sub, icon: Icon, color, delay = 0 }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ size?: number }>; color: string; delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.4 }}
      className="rounded-xl p-5 border"
      style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: color + '18' }}>
          <Icon size={20} style={{ color }} />
        </div>
      </div>
      <div style={{ fontSize: '1.75rem', fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>{value}</div>
      <div style={{ color: '#64748b', fontSize: '0.85rem', marginTop: '4px' }}>{title}</div>
      {sub && <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>{sub}</div>}
    </motion.div>
  );
}

function FuelBadge({ status }: { status: ReturnType<typeof getFuelStatus> }) {
  const c = fuelStatusColor(status);
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: c.bg, color: c.text, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.dot }} />
      {fuelStatusLabel(status)}
    </span>
  );
}

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

  const timeFilters = [
    { key: 'today', label: 'Hôm nay' },
    { key: 'week',  label: 'Tuần' },
    { key: 'month', label: 'Tháng' },
    { key: 'year',  label: 'Năm' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 style={{ color: '#0f172a' }}>Tổng quan hệ thống</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Cập nhật: 12/06/2026 08:30</p>
        </div>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: '#f1f5f9' }}>
          {timeFilters.map(f => (
            <button
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
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Pie chart */}
        <div className="rounded-xl border p-5" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h4 className="mb-4" style={{ color: '#0f172a' }}>Phân bổ trạng thái nhiên liệu</h4>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                isAnimationActive={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`pie-sector-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <RechartsTooltip
                formatter={(value: number, name: string) => [`${value} trạm`, name]}
                contentStyle={{ fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-2 space-y-1.5">
            {pieData.map(d => (
              <div key={d.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: d.color }} />
                  <span style={{ fontSize: '0.8rem', color: '#475569' }}>{d.name}</span>
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>{d.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bar chart */}
        <div className="lg:col-span-2 rounded-xl border p-5" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
          <h4 className="mb-4" style={{ color: '#0f172a' }}>Tổng nhiên liệu tồn theo tháng (Lít)</h4>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={barData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <RechartsTooltip
                formatter={(v: number) => [`${v} L`]}
                contentStyle={{ fontSize: '0.8rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}
              />
              <Bar dataKey="total" fill="#2563eb" radius={[6, 6, 0, 0]} name="Tổng NL tồn" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

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
                  <FuelBadge status={status} />
                  <button
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
              const status = getFuelStatus(s.currentFuel);
              return (
                <div key={s.id} className="flex items-center gap-3 px-5 py-3 group">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: fuelStatusColor(status).bg }}
                  >
                    <MapPin size={14} style={{ color: fuelStatusColor(status).dot }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                      {s.lastUpdated} · {s.currentFuel !== null ? `${s.currentFuel} L` : '—'}
                    </div>
                  </div>
                  <FuelBadge status={status} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
