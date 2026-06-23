import { useState, useRef, useReducer, useMemo } from 'react';
import { User, Bell, Shield, Database, Save, Camera, ClipboardList, Check, X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import * as Tabs from '@radix-ui/react-tabs';
import type { Station, AdjustmentRequest } from '@/shared/types';
import { listAdjustmentRequests, approveAdjustmentRequest, rejectAdjustmentRequest } from '@/features/stations/api/adjustmentApi';

interface SettingsProps {
  userRole?: string;
  stations?: Station[];
}

function tabTriggerStyle(active: boolean) {
  return {
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
  };
}

const PROFILE_FIELDS = [
  { label: 'Họ và tên',     key: 'name',  type: 'text',  readonly: false },
  { label: 'Email',          key: 'email', type: 'email', readonly: false },
  { label: 'Số điện thoại', key: 'phone', type: 'tel',   readonly: false },
  { label: 'Vai trò',       key: 'role',  type: 'text',  readonly: true  },
];

const NOTIFICATION_ITEMS = [
  { key: 'emailAlert',  label: 'Gửi cảnh báo qua Email', sub: 'Nhận email khi trạm vào trạng thái nguy hiểm' },
  { key: 'smsAlert',    label: 'Gửi cảnh báo qua SMS',   sub: 'Nhận SMS khi trạm cần bổ sung nhiên liệu khẩn cấp' },
  { key: 'redAlert',    label: 'Cảnh báo trạm đỏ',       sub: 'Thông báo khi nhiên liệu < 10L' },
  { key: 'yellowAlert', label: 'Cảnh báo trạm vàng',     sub: 'Thông báo khi nhiên liệu 10–20L' },
  { key: 'dailyReport', label: 'Báo cáo hàng ngày',      sub: 'Gửi tổng kết lúc 8:00 sáng mỗi ngày' },
];

const SYSTEM_INFO_ITEMS = [
  { label: 'Phiên bản',                   value: 'VNPT v2.1.0' },
  { label: 'Cập nhật lần cuối',           value: '12/06/2026' },
  { label: 'Tổng số trạm',               value: '30 trạm' },
  { label: 'Người dùng đang hoạt động',  value: '3 người' },
  { label: 'Dung lượng dữ liệu',         value: '142 MB' },
  { label: 'Môi trường',                  value: 'Production' },
];

const EMPTY_STATIONS: Station[] = [];

type AdjState = {
  requests: AdjustmentRequest[];
  loading: boolean;
  processing: string | null;
  rejectDialog: { open: boolean; target: AdjustmentRequest | null; reason: string };
};
type AdjAction =
  | { type: 'fetched'; requests: AdjustmentRequest[] }
  | { type: 'fetch-error' }
  | { type: 'processing-start'; id: string }
  | { type: 'processing-end' }
  | { type: 'remove'; id: string }
  | { type: 'open-reject'; target: AdjustmentRequest }
  | { type: 'close-reject' }
  | { type: 'reject-reason'; reason: string };

function adjReducer(state: AdjState, action: AdjAction): AdjState {
  switch (action.type) {
    case 'fetched':          return { ...state, requests: action.requests, loading: false };
    case 'fetch-error':      return { ...state, loading: false };
    case 'processing-start': return { ...state, processing: action.id };
    case 'processing-end':   return { ...state, processing: null };
    case 'remove':           return { ...state, requests: state.requests.filter(r => r.id !== action.id) };
    case 'open-reject':      return { ...state, rejectDialog: { open: true, target: action.target, reason: '' } };
    case 'close-reject':     return { ...state, rejectDialog: { ...state.rejectDialog, open: false } };
    case 'reject-reason':    return { ...state, rejectDialog: { ...state.rejectDialog, reason: action.reason } };
    default:                 return state;
  }
}

const REJECT_DIALOG_STYLE = {
  position: 'fixed' as const, top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  background: 'white', borderRadius: '16px', padding: '24px', width: '440px', maxWidth: '90vw', zIndex: 51,
  boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
};

function handleSave() {
  return new Promise<void>(r => setTimeout(r, 600)).then(() => {
    toast.success('Đã lưu cài đặt thành công!');
  });
}

// ── Tab content components ────────────────────────────────────────────────────

type ProfileState = { name: string; email: string; phone: string; role: string };

function ProfileTabContent({ profile, setProfile }: { profile: ProfileState; setProfile: React.Dispatch<React.SetStateAction<ProfileState>> }) {
  return (
    <div className="max-w-2xl space-y-5">
      <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <div className="flex items-center gap-5 mb-6 pb-5 border-b" style={{ borderColor: '#f1f5f9' }}>
          <div className="relative">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: '#2563eb', color: 'white', fontSize: '1.5rem', fontWeight: 700 }}>
              A
            </div>
            <button type="button" className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: '#2563eb', color: 'white' }}>
              <Camera size={11} />
            </button>
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a' }}>{profile.name}</div>
            <div style={{ color: '#64748b', fontSize: '0.85rem' }}>{profile.role}</div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {PROFILE_FIELDS.map(f => (
            <div key={f.key}>
              <label htmlFor={`profile-${f.key}`} className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>{f.label}</label>
              <input
                id={`profile-${f.key}`}
                aria-label={f.label}
                type={f.type}
                value={profile[f.key as keyof ProfileState]}
                readOnly={f.readonly}
                onChange={e => setProfile(p => ({ ...p, [f.key]: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-lg border outline-none"
                style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: f.readonly ? '#f8fafc' : 'white', color: f.readonly ? '#94a3b8' : '#1e293b' }}
                onFocus={e => { if (!f.readonly) { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; } }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t" style={{ borderColor: '#f1f5f9' }}>
          <button type="button" onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all"
            style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
            <Save size={15} /> Lưu thay đổi
          </button>
        </div>
      </div>
    </div>
  );
}

type NotificationsState = { emailAlert: boolean; smsAlert: boolean; redAlert: boolean; yellowAlert: boolean; dailyReport: boolean };

function NotificationsTabContent({ notifications, setNotifications }: { notifications: NotificationsState; setNotifications: React.Dispatch<React.SetStateAction<NotificationsState>> }) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <h4 className="mb-4" style={{ color: '#0f172a' }}>Cài đặt thông báo</h4>
        <div className="space-y-4">
          {NOTIFICATION_ITEMS.map(n => (
            <div key={n.key} className="flex items-center justify-between py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 500, color: '#1e293b' }}>{n.label}</div>
                <div style={{ fontSize: '0.78rem', color: '#94a3b8', marginTop: '2px' }}>{n.sub}</div>
              </div>
              <button
                type="button"
                aria-label={`${n.label}: ${notifications[n.key as keyof NotificationsState] ? 'Bật' : 'Tắt'}`}
                aria-pressed={notifications[n.key as keyof NotificationsState]}
                onClick={() => setNotifications(prev => ({ ...prev, [n.key]: !prev[n.key as keyof NotificationsState] }))}
                className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
                style={{ background: notifications[n.key as keyof NotificationsState] ? '#2563eb' : '#e2e8f0' }}
              >
                <span
                  className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all"
                  style={{ left: notifications[n.key as keyof NotificationsState] ? '22px' : '2px', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }}
                />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-4">
          <button type="button" onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg"
            style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
            <Save size={15} /> Lưu cài đặt
          </button>
        </div>
      </div>
    </div>
  );
}

type ThresholdsState = { yellowMin: number; yellowMax: number; redMax: number; autoExportTime: string };

function ThresholdsTabContent({ thresholds, setThresholds }: { thresholds: ThresholdsState; setThresholds: React.Dispatch<React.SetStateAction<ThresholdsState>> }) {
  return (
    <div className="max-w-xl space-y-4">
      <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <h4 className="mb-4" style={{ color: '#0f172a' }}>Ngưỡng phân loại nhiên liệu</h4>
        <div className="space-y-4">
          <div className="p-4 rounded-xl border" style={{ background: '#fef9c3', borderColor: '#fde68a' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#92400e', marginBottom: '8px' }}>Ngưỡng Vàng (Sắp hết)</div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="threshold-yellow-min" className="block mb-1" style={{ fontSize: '0.78rem', color: '#92400e' }}>Từ (L)</label>
                <input id="threshold-yellow-min" type="number" value={thresholds.yellowMin} min={0}
                  onChange={e => setThresholds(t => ({ ...t, yellowMin: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#fde68a', background: 'white' }} />
              </div>
              <div>
                <label htmlFor="threshold-yellow-max" className="block mb-1" style={{ fontSize: '0.78rem', color: '#92400e' }}>Đến (L)</label>
                <input id="threshold-yellow-max" type="number" value={thresholds.yellowMax} min={0}
                  onChange={e => setThresholds(t => ({ ...t, yellowMax: +e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#fde68a', background: 'white' }} />
              </div>
            </div>
          </div>
          <div className="p-4 rounded-xl border" style={{ background: '#fee2e2', borderColor: '#fca5a5' }}>
            <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#b91c1c', marginBottom: '8px' }}>Ngưỡng Đỏ (Nguy hiểm)</div>
            <div>
              <label htmlFor="threshold-red-max" className="block mb-1" style={{ fontSize: '0.78rem', color: '#b91c1c' }}>Dưới (L)</label>
              <input id="threshold-red-max" type="number" value={thresholds.redMax} min={0}
                onChange={e => setThresholds(t => ({ ...t, redMax: +e.target.value }))}
                className="w-full px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#fca5a5', background: 'white' }} />
            </div>
          </div>
          <div>
            <label htmlFor="threshold-auto-export-time" className="block mb-1.5" style={{ fontSize: '0.85rem', color: '#475569' }}>Giờ export tự động hàng ngày</label>
            <input id="threshold-auto-export-time" type="time" value={thresholds.autoExportTime}
              onChange={e => setThresholds(t => ({ ...t, autoExportTime: e.target.value }))}
              className="px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0' }} />
          </div>
        </div>
        <div className="mt-4">
          <button type="button" onClick={handleSave} className="flex items-center gap-2 px-5 py-2.5 rounded-lg"
            style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
            <Save size={15} /> Lưu ngưỡng
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function Settings({ userRole, stations = EMPTY_STATIONS }: SettingsProps) {
  const [profile, setProfile] = useState(() => ({
    name: 'Nguyễn Văn A',
    email: 'nguyenvana@company.vn',
    phone: '0912 345 678',
    role: 'Quản trị viên',
  }));
  const [notifications, setNotifications] = useState(() => ({
    emailAlert: true,
    smsAlert: false,
    redAlert: true,
    yellowAlert: true,
    dailyReport: true,
  }));
  const [thresholds, setThresholds] = useState(() => ({
    yellowMin: 10,
    yellowMax: 20,
    redMax: 10,
    autoExportTime: '07:00',
  }));

  const [adj, dispatchAdj] = useReducer(adjReducer, userRole, (role): AdjState => ({
    requests: [],
    loading: role === 'admin',
    processing: null,
    rejectDialog: { open: false, target: null, reason: '' },
  }));

  const stationMap = useMemo(() => new Map(stations.map(s => [s.id, s.name])), [stations]);

  const hasFetchedAdjRef = useRef(false);
  if (userRole === 'admin' && !hasFetchedAdjRef.current) {
    hasFetchedAdjRef.current = true;
    listAdjustmentRequests({ status: 'pending' })
      .then(requests => { dispatchAdj({ type: 'fetched', requests }); })
      .catch(() => { toast.error('Lỗi tải danh sách yêu cầu điều chỉnh'); dispatchAdj({ type: 'fetch-error' }); });
  }

  const handleApprove = async (req: AdjustmentRequest) => {
    dispatchAdj({ type: 'processing-start', id: req.id });
    try {
      await approveAdjustmentRequest(req.id);
      toast.success('Đã phê duyệt yêu cầu điều chỉnh.');
      dispatchAdj({ type: 'remove', id: req.id });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi phê duyệt');
    } finally {
      dispatchAdj({ type: 'processing-end' });
    }
  };

  const handleReject = async () => {
    const { target, reason } = adj.rejectDialog;
    if (!target) return;
    if (!reason.trim()) { toast.error('Lý do từ chối là bắt buộc.'); return; }
    dispatchAdj({ type: 'processing-start', id: target.id });
    try {
      await rejectAdjustmentRequest(target.id, reason.trim());
      toast.success('Đã từ chối yêu cầu điều chỉnh.');
      dispatchAdj({ type: 'remove', id: target.id });
      dispatchAdj({ type: 'close-reject' });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi từ chối');
    } finally {
      dispatchAdj({ type: 'processing-end' });
    }
  };

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
            ...(userRole === 'admin' ? [{ value: 'adjustments', label: 'Yêu cầu điều chỉnh', icon: ClipboardList }] : []),
          ].map(tab => (
            <Tabs.Trigger key={tab.value} value={tab.value} asChild>
              <button type="button">
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
          <ProfileTabContent profile={profile} setProfile={setProfile} />
        </Tabs.Content>

        <Tabs.Content value="notifications">
          <NotificationsTabContent notifications={notifications} setNotifications={setNotifications} />
        </Tabs.Content>

        <Tabs.Content value="thresholds">
          <ThresholdsTabContent thresholds={thresholds} setThresholds={setThresholds} />
        </Tabs.Content>

        <Tabs.Content value="system">
          <div className="max-w-xl space-y-4">
            <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
              <h4 className="mb-4" style={{ color: '#0f172a' }}>Thông tin hệ thống</h4>
              <div className="space-y-0">
                {SYSTEM_INFO_ITEMS.map(item => (
                  <div key={item.label} className="flex justify-between py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>{item.label}</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Tabs.Content>

        {userRole === 'admin' && (
          <Tabs.Content value="adjustments">
            <div className="max-w-4xl space-y-4">
              <div className="rounded-xl border p-6" style={{ background: 'white', borderColor: '#e2e8f0' }}>
                <div className="flex items-center gap-2 mb-4">
                  <ClipboardList size={16} style={{ color: '#2563eb' }} />
                  <h4 style={{ color: '#0f172a', margin: 0 }}>Yêu cầu điều chỉnh đang chờ</h4>
                  {adj.requests.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 rounded-full text-xs font-semibold" style={{ background: '#fef3c7', color: '#92400e' }}>
                      {adj.requests.length}
                    </span>
                  )}
                </div>
                {adj.loading ? (
                  <div style={{ color: '#64748b', fontSize: '0.875rem', padding: '2rem 0', textAlign: 'center' }}>Đang tải...</div>
                ) : adj.requests.length === 0 ? (
                  <div style={{ color: '#94a3b8', fontSize: '0.875rem', padding: '2rem 0', textAlign: 'center' }}>
                    Không có yêu cầu điều chỉnh nào đang chờ.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {adj.requests.map(req => (
                      <div key={req.id} className="rounded-lg border p-4" style={{ borderColor: '#e2e8f0' }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#1e293b' }}>
                                {stationMap.get(req.stationId) ?? req.stationId}
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#fef9c3', color: '#92400e', fontWeight: 500 }}>
                                Đang chờ
                              </span>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '4px' }}>
                              Người yêu cầu: <strong style={{ color: '#475569' }}>{req.requestedByName}</strong>
                              {' · '}
                              {new Date(req.createdAt).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' } as Intl.DateTimeFormatOptions)}
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#64748b', marginBottom: '4px' }}>
                              Giá trị mới: <strong style={{ color: '#1e293b' }}>{req.newFuelAdded}L thêm</strong>
                              {' · '}
                              <strong style={{ color: '#1e293b' }}>{req.newHoursRun}h chạy</strong>
                            </div>
                            <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: '4px' }}>Lý do: {req.reason}</div>
                            {req.newNotes && (
                              <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>Ghi chú: {req.newNotes}</div>
                            )}
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            <button
                              type="button"
                              disabled={adj.processing === req.id}
                              onClick={() => handleApprove(req)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                              style={{ background: '#dcfce7', color: '#15803d', opacity: adj.processing === req.id ? 0.5 : 1, cursor: adj.processing === req.id ? 'not-allowed' : 'pointer' }}
                            >
                              <Check size={14} /> Phê duyệt
                            </button>
                            <button
                              type="button"
                              disabled={adj.processing === req.id}
                              onClick={() => dispatchAdj({ type: 'open-reject', target: req })}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium"
                              style={{ background: '#fee2e2', color: '#dc2626', opacity: adj.processing === req.id ? 0.5 : 1, cursor: adj.processing === req.id ? 'not-allowed' : 'pointer' }}
                            >
                              <X size={14} /> Từ chối
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Tabs.Content>
        )}
      </Tabs.Root>

      <Dialog.Root open={adj.rejectDialog.open} onOpenChange={open => !open && dispatchAdj({ type: 'close-reject' })}>
        <Dialog.Portal>
          <Dialog.Overlay style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <Dialog.Content style={REJECT_DIALOG_STYLE}>
            <Dialog.Title style={{ fontWeight: 700, fontSize: '1rem', color: '#0f172a', marginBottom: '8px' }}>
              Từ chối yêu cầu điều chỉnh
            </Dialog.Title>
            <Dialog.Description style={{ fontSize: '0.85rem', color: '#64748b', marginBottom: '16px' }}>
              {adj.rejectDialog.target && `Trạm: ${stationMap.get(adj.rejectDialog.target.stationId) ?? adj.rejectDialog.target.stationId} · ${adj.rejectDialog.target.requestedByName}`}
            </Dialog.Description>
            <div className="mb-4">
              <label htmlFor="reject-reason" style={{ display: 'block', fontSize: '0.82rem', color: '#475569', marginBottom: '6px' }}>
                Lý do từ chối <span style={{ color: '#dc2626' }}>*</span>
              </label>
              <textarea
                id="reject-reason"
                value={adj.rejectDialog.reason}
                onChange={e => dispatchAdj({ type: 'reject-reason', reason: e.target.value })}
                rows={3}
                placeholder="Nhập lý do từ chối..."
                className="w-full px-3 py-2.5 rounded-lg border outline-none resize-none"
                style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', color: '#1e293b' }}
                onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Dialog.Close asChild>
                <button type="button" className="px-4 py-2 rounded-lg text-sm" style={{ background: '#f1f5f9', color: '#475569', fontWeight: 500 }}>
                  Hủy
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={handleReject}
                disabled={!!adj.processing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold"
                style={{ background: '#dc2626', color: 'white', opacity: adj.processing ? 0.6 : 1, cursor: adj.processing ? 'not-allowed' : 'pointer' }}
              >
                <X size={14} /> Từ chối
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
