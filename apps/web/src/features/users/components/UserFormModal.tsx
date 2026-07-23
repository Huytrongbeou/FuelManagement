import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserRole } from '../api/userApi';

/** Kept in step with MIN_PASSWORD_LENGTH in auth-service's user.service.ts. */
const MIN_PASSWORD_LENGTH = 8;

const LABEL_STYLE = { fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' } as const;
const INPUT_STYLE = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: 'white', outline: 'none' } as const;

interface Props {
  open: boolean;
  /** 'create' asks for everything; 'password' only resets an existing account's password. */
  mode: 'create' | 'password';
  username?: string;
  onClose: () => void;
  onSubmit: (values: { username: string; password: string; role: UserRole }) => Promise<void>;
}

export function UserFormModal({ open, mode, username, onClose, onSubmit }: Props) {
  const [form, setForm] = useState({ username: '', password: '', role: 'staff' as UserRole });
  const [saving, setSaving] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setForm({ username: '', password: '', role: 'staff' });
  }

  const isCreate = mode === 'create';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isCreate && !form.username.trim()) {
      toast.error('Vui lòng nhập tên đăng nhập');
      return;
    }
    if (form.password.length < MIN_PASSWORD_LENGTH) {
      toast.error(`Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự`);
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ username: form.username.trim(), password: form.password, role: form.role });
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi lưu người dùng');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
        <Dialog.Content
          className="fixed rounded-2xl"
          style={{
            top: '50%', left: '50%', transform: 'translate(-50%,-50%)', zIndex: 51,
            background: 'white', width: '440px', maxWidth: '94vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f1f5f9' }}>
            <Dialog.Title style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0f172a' }}>
              {isCreate ? 'Thêm người dùng' : `Đổi mật khẩu — ${username ?? ''}`}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button type="button" style={{ color: '#94a3b8', padding: '4px' }}><X size={18} /></button>
            </Dialog.Close>
          </div>

          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {isCreate && (
              <>
                <div>
                  <label htmlFor="new-username" style={LABEL_STYLE}>Tên đăng nhập *</label>
                  <input
                    id="new-username"
                    style={INPUT_STYLE}
                    placeholder="VD: nguyenvana"
                    value={form.username}
                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                    autoComplete="off"
                  />
                </div>
                <div>
                  <label htmlFor="new-role" style={LABEL_STYLE}>Vai trò *</label>
                  <select
                    id="new-role"
                    style={INPUT_STYLE}
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as UserRole }))}
                  >
                    <option value="staff">Nhân viên — chỉ xem</option>
                    <option value="manager">Quản lý — nhập liệu, import</option>
                    <option value="admin">Quản trị viên — toàn quyền</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label htmlFor="new-password" style={LABEL_STYLE}>
                {isCreate ? 'Mật khẩu *' : 'Mật khẩu mới *'}
              </label>
              <input
                id="new-password"
                type="password"
                style={INPUT_STYLE}
                placeholder={`Ít nhất ${MIN_PASSWORD_LENGTH} ký tự`}
                value={form.password}
                onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                autoComplete="new-password"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', color: '#64748b' }}>
                Hủy
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-5 py-2 rounded-lg"
                style={{ background: saving ? '#93c5fd' : '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
              >
                {saving && <Loader2 size={15} className="animate-spin" />}
                {saving ? 'Đang lưu...' : isCreate ? 'Tạo tài khoản' : 'Đổi mật khẩu'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
