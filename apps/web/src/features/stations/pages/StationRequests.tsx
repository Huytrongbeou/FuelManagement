import { useState, useEffect, useCallback } from 'react';
import { MapPin, Check, X, Clock, Loader2, RefreshCw } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { toast } from 'sonner';
import {
  getStationRequests, approveStationRequest, rejectStationRequest,
  type StationRequest,
} from '../api/stationRequestApi';

const STATUS_STYLE: Record<string, { bg: string; fg: string; label: string }> = {
  pending:   { bg: '#fef3c7', fg: '#92400e', label: 'Chờ duyệt' },
  approving: { bg: '#fef3c7', fg: '#92400e', label: 'Đang xử lý' },
  approved:  { bg: '#dcfce7', fg: '#15803d', label: 'Đã duyệt' },
  rejected:  { bg: '#fee2e2', fg: '#b91c1c', label: 'Từ chối' },
};

interface Props {
  /** Refreshes the station list after an approval turns a proposal into a real station. */
  onStationsChanged: () => void;
}

export function StationRequests({ onStationsChanged }: Props) {
  const [requests, setRequests] = useState<StationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<StationRequest | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRequests(await getStationRequests());
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi tải danh sách đề xuất');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleApprove = async (req: StationRequest) => {
    setBusyId(req.id);
    try {
      const result = await approveStationRequest(req.id);
      toast.success(`Đã duyệt và tạo trạm ${result.station.stationCode}`);
      onStationsChanged();
      await load();
    } catch (err) {
      // A 409 here means another reviewer approved it first — reload so the screen tells the truth.
      toast.error((err as Error).message || 'Lỗi duyệt đề xuất');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget) return;
    setBusyId(rejectTarget.id);
    try {
      await rejectStationRequest(rejectTarget.id, rejectReason);
      toast.success(`Đã từ chối đề xuất ${rejectTarget.stationCode}`);
      setRejectTarget(null);
      setRejectReason('');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi từ chối đề xuất');
      await load();
    } finally {
      setBusyId(null);
    }
  };

  const pending = requests.filter(r => r.status === 'pending' || r.status === 'approving');
  const handled = requests.filter(r => r.status === 'approved' || r.status === 'rejected');

  const renderCard = (r: StationRequest) => {
    const style = STATUS_STYLE[r.status] ?? STATUS_STYLE.pending;
    const isOpen = r.status === 'pending' || r.status === 'approving';
    const busy = busyId === r.id;
    return (
      <div key={r.id} data-testid={`request-row-${r.stationCode}`} className="px-5 py-4 flex flex-col lg:flex-row lg:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: 'monospace', fontSize: '0.8rem', color: '#64748b' }}>{r.stationCode}</span>
            <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{r.stationName}</span>
            <span className="px-2 py-0.5 rounded-full" style={{ background: style.bg, color: style.fg, fontSize: '0.7rem', fontWeight: 600 }}>
              {style.label}
            </span>
          </div>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '3px' }}>
            {r.requestedBy} đề xuất · {new Date(r.requestedAt).toLocaleString('vi-VN')}
            {r.latitude != null && r.longitude != null && (
              <> · <MapPin size={11} style={{ display: 'inline' }} /> {Number(r.latitude).toFixed(5)}, {Number(r.longitude).toFixed(5)}</>
            )}
          </div>
          <div style={{ color: '#64748b', fontSize: '0.75rem', marginTop: '2px' }}>
            {Number(r.consumptionRate)} L/giờ · bình {Number(r.maxCapacity)} L · tồn đầu {Number(r.initialFuel)} L
            {r.address ? ` · ${r.address}` : ''}
          </div>
          {r.status === 'rejected' && r.rejectionReason && (
            <div style={{ color: '#b91c1c', fontSize: '0.75rem', marginTop: '3px' }}>
              Lý do: {r.rejectionReason}
            </div>
          )}
          {r.status === 'approved' && r.reviewedBy && (
            <div style={{ color: '#15803d', fontSize: '0.75rem', marginTop: '3px' }}>
              Duyệt bởi {r.reviewedBy}
            </div>
          )}
        </div>

        {isOpen && (
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-testid={`request-approve-${r.stationCode}`}
              onClick={() => handleApprove(r)}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg"
              style={{ background: '#16a34a', color: 'white', fontSize: '0.8rem', fontWeight: 600 }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} Duyệt
            </button>
            <button
              type="button"
              data-testid={`request-reject-${r.stationCode}`}
              onClick={() => { setRejectTarget(r); setRejectReason(''); }}
              disabled={busy}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg border"
              style={{ borderColor: '#fecaca', color: '#b91c1c', background: 'white', fontSize: '0.8rem' }}
            >
              <X size={14} /> Từ chối
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 style={{ color: '#0f172a' }}>Duyệt đề xuất trạm</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {pending.length} đề xuất đang chờ duyệt
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ fontSize: '0.85rem', borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
        >
          <RefreshCw size={15} /> Tải lại
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <div className="flex items-center gap-2 px-5 py-3 border-b" style={{ borderColor: '#f1f5f9', background: '#fffbeb' }}>
          <Clock size={15} style={{ color: '#ca8a04' }} />
          <h4 style={{ color: '#0f172a', fontSize: '0.9rem' }}>Chờ duyệt</h4>
        </div>
        {loading ? (
          <div className="px-5 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Đang tải...</div>
        ) : pending.length === 0 ? (
          <div className="px-5 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Không có đề xuất nào đang chờ.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>{pending.map(renderCard)}</div>
        )}
      </div>

      {handled.length > 0 && (
        <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
          <div className="px-5 py-3 border-b" style={{ borderColor: '#f1f5f9' }}>
            <h4 style={{ color: '#0f172a', fontSize: '0.9rem' }}>Đã xử lý</h4>
          </div>
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>{handled.map(renderCard)}</div>
        </div>
      )}

      <AlertDialog.Root open={rejectTarget !== null} onOpenChange={v => { if (!v) setRejectTarget(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <AlertDialog.Content
            className="fixed rounded-2xl p-6"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 51,
              background: 'white', width: '440px', maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <AlertDialog.Title style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Từ chối đề xuất {rejectTarget?.stationCode}?
            </AlertDialog.Title>
            <AlertDialog.Description style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px' }}>
              Người đề xuất sẽ thấy lý do này. Mã trạm sẽ được giải phóng để đề xuất lại.
            </AlertDialog.Description>
            <textarea
              id="reject-reason"
              aria-label="Lý do từ chối"
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="VD: Trùng với trạm CL-005 đã có"
              className="w-full mt-4 px-3 py-2 rounded-lg border outline-none"
              style={{ borderColor: '#e2e8f0', fontSize: '0.85rem', minHeight: '70px', resize: 'vertical' }}
            />
            <div className="flex justify-end gap-3 mt-4">
              <AlertDialog.Cancel asChild>
                <button type="button" className="px-4 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', color: '#64748b' }}>
                  Hủy
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={handleReject}
                disabled={busyId !== null || !rejectReason.trim()}
                className="px-4 py-2 rounded-lg"
                style={{
                  background: rejectReason.trim() ? '#dc2626' : '#e2e8f0',
                  color: rejectReason.trim() ? 'white' : '#94a3b8',
                  fontSize: '0.875rem', fontWeight: 600,
                }}
              >
                Từ chối
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
