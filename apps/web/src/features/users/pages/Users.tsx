import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Shield, KeyRound, Ban, RotateCcw, Loader2 } from 'lucide-react';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { toast } from 'sonner';
import {
  getUsers, createUser, updateUser, deactivateUser,
  ROLE_LABELS, type ManagedUser, type UserRole,
} from '../api/userApi';
import { UserFormModal } from '../components/UserFormModal';

const ROLE_STYLE: Record<UserRole, { bg: string; fg: string }> = {
  admin:   { bg: '#ede9fe', fg: '#6d28d9' },
  manager: { bg: '#dbeafe', fg: '#1d4ed8' },
  staff:   { bg: '#f1f5f9', fg: '#475569' },
};

interface Props {
  /** The signed-in admin — used to block self-destructive actions in the UI too. */
  currentUserId?: string;
}

export function Users({ currentUserId }: Props) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [confirmTarget, setConfirmTarget] = useState<ManagedUser | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRoleChange = async (user: ManagedUser, role: UserRole) => {
    if (role === user.role) return;
    setBusyId(user.id);
    try {
      await updateUser(user.id, { role });
      toast.success(`Đã đổi vai trò ${user.username} thành ${ROLE_LABELS[role]}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi đổi vai trò');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggleActive = async (user: ManagedUser) => {
    setBusyId(user.id);
    try {
      if (user.isActive) await deactivateUser(user.id);
      else await updateUser(user.id, { isActive: true });
      toast.success(user.isActive ? `Đã vô hiệu hóa ${user.username}` : `Đã kích hoạt lại ${user.username}`);
      setConfirmTarget(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi cập nhật trạng thái');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 style={{ color: '#0f172a' }}>Quản lý người dùng</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            {users.filter(u => u.isActive).length} tài khoản đang hoạt động / {users.length} tổng
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg"
          style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
        >
          <UserPlus size={16} /> Thêm người dùng
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        {loading ? (
          <div className="px-5 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Đang tải...
          </div>
        ) : users.length === 0 ? (
          <div className="px-5 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Chưa có người dùng nào.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {users.map(u => {
              const isSelf = u.id === currentUserId;
              const busy = busyId === u.id;
              return (
                <div
                  key={u.id}
                  data-testid={`user-row-${u.username}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4"
                  style={{ opacity: u.isActive ? 1 : 0.55 }}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ background: ROLE_STYLE[u.role].bg, color: ROLE_STYLE[u.role].fg, fontWeight: 700 }}
                    >
                      {u.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{u.username}</span>
                        {isSelf && (
                          <span className="px-1.5 py-0.5 rounded" style={{ background: '#f1f5f9', color: '#64748b', fontSize: '0.68rem' }}>
                            bạn
                          </span>
                        )}
                        {!u.isActive && (
                          <span className="px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.68rem', fontWeight: 600 }}>
                            đã vô hiệu hóa
                          </span>
                        )}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                        Tạo ngày {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 flex-wrap">
                    <Shield size={14} style={{ color: '#94a3b8' }} />
                    <select
                      aria-label={`Vai trò của ${u.username}`}
                      data-testid={`user-role-${u.username}`}
                      value={u.role}
                      disabled={isSelf || busy}
                      onChange={e => handleRoleChange(u, e.target.value as UserRole)}
                      className="px-2.5 py-1.5 rounded-lg border outline-none"
                      style={{
                        fontSize: '0.8rem', borderColor: '#e2e8f0', background: 'white',
                        color: '#374151', cursor: isSelf ? 'not-allowed' : 'pointer',
                      }}
                      title={isSelf ? 'Không thể tự đổi vai trò của mình' : undefined}
                    >
                      <option value="admin">Quản trị viên</option>
                      <option value="manager">Quản lý</option>
                      <option value="staff">Nhân viên</option>
                    </select>

                    <button
                      type="button"
                      onClick={() => setEditing(u)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                      style={{ fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                    >
                      <KeyRound size={13} /> Đổi mật khẩu
                    </button>

                    <button
                      type="button"
                      data-testid={`user-toggle-${u.username}`}
                      onClick={() => (u.isActive ? setConfirmTarget(u) : handleToggleActive(u))}
                      disabled={isSelf || busy}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                      style={{
                        fontSize: '0.8rem',
                        borderColor: u.isActive ? '#fecaca' : '#bbf7d0',
                        color: isSelf ? '#cbd5e1' : u.isActive ? '#b91c1c' : '#15803d',
                        background: 'white',
                        cursor: isSelf ? 'not-allowed' : 'pointer',
                      }}
                      title={isSelf ? 'Không thể tự vô hiệu hóa tài khoản của mình' : undefined}
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" />
                        : u.isActive ? <Ban size={13} /> : <RotateCcw size={13} />}
                      {u.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <UserFormModal
        open={addOpen}
        mode="create"
        onClose={() => setAddOpen(false)}
        onSubmit={async ({ username, password, role }) => {
          await createUser({ username, password, role });
          toast.success(`Đã tạo tài khoản ${username}`);
          await load();
        }}
      />

      <UserFormModal
        open={editing !== null}
        mode="password"
        username={editing?.username}
        onClose={() => setEditing(null)}
        onSubmit={async ({ password }) => {
          if (!editing) return;
          await updateUser(editing.id, { password });
          toast.success(`Đã đổi mật khẩu cho ${editing.username}`);
        }}
      />

      <AlertDialog.Root open={confirmTarget !== null} onOpenChange={v => { if (!v) setConfirmTarget(null); }}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
          <AlertDialog.Content
            className="fixed rounded-2xl p-6"
            style={{
              top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 51,
              background: 'white', width: '420px', maxWidth: '92vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
          >
            <AlertDialog.Title style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              Vô hiệu hóa {confirmTarget?.username}?
            </AlertDialog.Title>
            <AlertDialog.Description style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '8px', lineHeight: 1.6 }}>
              Tài khoản sẽ không đăng nhập được nữa. Dữ liệu và lịch sử nhập liệu của họ vẫn được giữ
              nguyên, và bạn có thể kích hoạt lại bất cứ lúc nào.
            </AlertDialog.Description>
            <div className="flex justify-end gap-3 mt-6">
              <AlertDialog.Cancel asChild>
                <button type="button" className="px-4 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', color: '#64748b' }}>
                  Hủy
                </button>
              </AlertDialog.Cancel>
              <button
                type="button"
                onClick={() => confirmTarget && handleToggleActive(confirmTarget)}
                disabled={busyId !== null}
                className="px-4 py-2 rounded-lg"
                style={{ background: '#dc2626', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
              >
                Vô hiệu hóa
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
