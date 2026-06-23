import { m } from 'motion/react';

export function StatCard({ title, value, sub, icon: Icon, color, delay = 0 }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ size?: number }>; color: string; delay?: number;
}) {
  return (
    <m.div
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
    </m.div>
  );
}
