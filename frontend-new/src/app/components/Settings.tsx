import { useState } from 'react';
import { User, Bell, Shield, Database, Save, Camera } from 'lucide-react';
import { toast } from 'sonner';
import * as Tabs from '@radix-ui/react-tabs';

export function Settings() {
  const [profile, setProfile] = useState({
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@company.vn',
    phone: '0912 345 678',
    role: 'Quản trị viên',
  });
  const [notifications, setNotifications] = useState({
    emailAlert: true,
    smsAlert: false,
    redAlert: true,
    yellowAlert: true,
    dailyReport: true,
  });
  const [thresholds, setThresholds] = useState({
    yellowMin: 10,
    yellowMax: 20,
    redMax: 10,
    autoExportTime: '07:00',
  });

  const handleSave = async () => {
    await new Promise(r => setTimeout(r, 600));
    toast.success('Đã lưu cài đặt thành công!');
  };

  const tabTriggerStyle = (active: boolean) => ({
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '0.85rem',
    fontWeight: active ? 600 : 400,
    color: active ? '#2563eb' : '#64748b',
    background: active ? '#eff6ff' : 'transparent',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  });

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h2 style={{ color: '#0f172a' }}>Cài đặt & Tài khoản</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Quản lý thông tin cá nhân và cài đặt hệ thống</p>
      </div>

      <Tabs.Root defaultValue="profile">
        <Tabs.List className="flex gap-1 p-1 rounded-xl mb-6" style={{ background: '#f1f5f9', width: 'fit-content' }}>
          {[
            { value: 'profile',       label: 'Tài khoản',     icon: User },
            { value: 'notifications', label: 'Thông báo',     icon: Bell },
            { value: 'thresholds',    label: 'Ngưỡng cảnh báo', icon: Shield },
            { value: 'system',        label: 'Hệ thống',      icon: Database },
          ].map(tab => (
            <Tabs.Trigger key={tab.value} value={tab.value} asChild>
              <button style={{ outline: 'none' }}>
                {({ isSelected }: any) => (
                  <span className="flex items-center gap-1.5" style={tabTriggerStyle(isSelected)}>
                    <tab.icon size={14} />
                    {tab.label}
                  </span>
                )}
              </button>
            </Tabs.Trigger>
          ))}
        </Tabs.List>

        <Tabs.Content value="profile">
          <div className="max-w-2xl space-y-5">
            <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
              {/* Avatar */}
              <div className="flex items-center gap-5 mb-6 pb-5 border-b" style={{ borderColor: '#f1f5f9' }}>
                <div className="relative">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#2563eb', color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>
                    A
                  </div>
                  <button className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#2563eb', color: 'white' }}>
                    <Camera size={11} />
                  </button>
                </div>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{profile.name}</div>
                  <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{profile.role}</div>
                </div>
              </div>

              {/* Form fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Họ và tên',    key: 'name',  type: 'text' },
                  { label: 'Email',         key: 'email', type: 'email' },
                  { label: 'Số điện thoại',key: 'phone', type: 'tel' },
                  { label: 'Vai trò',      key: 'role',  type: 'text', readonly: true },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>{f.label}</label>
                    <input
                      type={f.type}
                      value={profile[f.key as keyof typeof profile]}
                      readOnly={f.readonly}
                      onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg border outline-none"
                      style={{
                        fontSize: '0.875rem',
                        borderColor: '#e2e8f0',
                        background: f.readonly ? '#f8fafc' : 'white',
                        color: f.readonly ? '#94a3b8' : '#1e293b',
                      }}
                      onFocus={e => { if (!f.readonly) { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; } }}
                      onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                    />
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t" style={{ borderColor: '#f1f5f9' }}>
                <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all"
                  style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Save size={15} /> Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="notifications">
          <div className="max-w-xl space-y-4">
            <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
              <h4 className="mb-4" style={{ color: '#0f172a' }}>Cài đặt thông báo</h4>
              <div className="space-y-4">
                {[
                  { key: 'emailAlert',   label: 'Gửi cảnh báo qua Email', sub: 'Nhận email khi trạm vào trạng thái nguy hiểm' },
                  { key: 'smsAlert',     label: 'Gửi cảnh báo qua SMS',   sub: 'Nhận SMS khi trạm cần bổ sung nhiên liệu khẩn cấp' },
                  { key: 'redAlert',     label: 'Cảnh báo trạm đỏ',       sub: 'Thông báo khi nhiên liệu < 10L' },
                  { key: 'yellowAlert',  label: 'Cảnh báo trạm vàng',     sub: 'Thông báo khi nhiên liệu 10–20L' },
                  { key: 'dailyReport',  label: 'Báo cáo hàng ngày',      sub: 'Gửi tổng kết lúc 8:00 sáng mỗi ngày' },
                ].map(n => (
                  <div key={n.key} className="flex items-center justify-between py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div>
                      <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>{n.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{n.sub}</div>
                    </div>
                    <button
                      onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key as keyof typeof prev] }))}
                      className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                      style={{ background: notifications[n.key as keyof typeof notifications] ? '#2563eb' : '#e2e8f0' }}
                    >
                      <span
                        className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                        style={{ left: notifications[n.key as keyof typeof notifications] ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                      />
                    </button>
                  </div>
                ))}
              </div>
              <div className="mt-4">
                <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg"
                  style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Save size={15} /> Lưu cài đặt
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="thresholds">
          <div className="max-w-xl space-y-4">
            <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
              <h4 className="mb-4" style={{ color: '#0f172a' }}>Ngưỡng phân loại nhiên liệu</h4>
              <div className="space-y-4">
                <div className="p-4 rounded-xl border" style={{ background: '#fef9c3', borderColor: '#fde68a' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>Ngưỡng Vàng (Sắp hết)</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block mb-1" style={{ fontSize: '0.78rem', color: '#92400e' }}>Từ (L)</label>
                      <input type="number" value={thresholds.yellowMin} min={0}
                        onChange={e => setThresholds(t => ({ ...t, yellowMin: +e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#fde68a', background: 'white' }} />
                    </div>
                    <div>
                      <label className="block mb-1" style={{ fontSize: '0.78rem', color: '#92400e' }}>Đến (L)</label>
                      <input type="number" value={thresholds.yellowMax} min={0}
                        onChange={e => setThresholds(t => ({ ...t, yellowMax: +e.target.value }))}
                        className="w-full px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#fde68a', background: 'white' }} />
                    </div>
                  </div>
                </div>
                <div className="p-4 rounded-xl border" style={{ background: '#fee2e2', borderColor: '#fca5a5' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b91c1c', marginBottom: '8px' }}>Ngưỡng Đỏ (Nguy hiểm)</div>
                  <div>
                    <label className="block mb-1" style={{ fontSize: '0.78rem', color: '#b91c1c' }}>Dưới (L)</label>
                    <input type="number" value={thresholds.redMax} min={0}
                      onChange={e => setThresholds(t => ({ ...t, redMax: +e.target.value }))}
                      className="w-full px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#fca5a5', background: 'white' }} />
                  </div>
                </div>
                <div>
                  <label className="block mb-1.5" style={{ fontSize: '0.85rem', color: '#475569' }}>Giờ export tự động hàng ngày</label>
                  <input type="time" value={thresholds.autoExportTime}
                    onChange={e => setThresholds(t => ({ ...t, autoExportTime: e.target.value }))}
                    className="px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
                </div>
              </div>
              <div className="mt-4">
                <button onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg"
                  style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Save size={15} /> Lưu ngưỡng
                </button>
              </div>
            </div>
          </div>
        </Tabs.Content>

        <Tabs.Content value="system">
          <div className="max-w-xl space-y-4">
            <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
              <h4 className="mb-4" style={{ color: '#0f172a' }}>Thông tin hệ thống</h4>
              <div className="space-y-0">
                {[
                  { label: 'Phiên bản',           value: 'VNPT v2.1.0' },
                  { label: 'Cập nhật lần cuối',   value: '12/06/2026' },
                  { label: 'Tổng số trạm',         value: '30 trạm' },
                  { label: 'Người dùng đang hoạt động', value: '3 người' },
                  { label: 'Dung lượng dữ liệu',  value: '142 MB' },
                  { label: 'Môi trường',           value: 'Production' },
                ].map(item => (
                  <div key={item.label} className="flex justify-between py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Tabs.Content>
      </Tabs.Root>
    </div>
  );
}
