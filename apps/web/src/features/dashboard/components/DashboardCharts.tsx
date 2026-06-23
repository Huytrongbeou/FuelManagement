// oxlint-disable-next-line react-doctor/prefer-dynamic-import -- This file IS the React.lazy() chunk; recharts is intentionally loaded here, not in the main bundle
import {
  PieChart, Pie, Cell, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer,
} from 'recharts';

interface PieEntry { name: string; value: number; color: string; }
interface BarEntry { name: string; total: number; updated: number; }

export default function DashboardCharts({ pieData, barData }: {
  pieData: PieEntry[];
  barData: BarEntry[];
}) {
  return (
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
              {pieData.map((entry) => (
                <Cell key={entry.name} fill={entry.color} />
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
  );
}
