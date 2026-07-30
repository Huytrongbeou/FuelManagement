import { useState, useEffect, useCallback } from 'react';
import { UserPlus, Ban, RotateCcw, Loader2, Pencil, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import {
  getEmployees, createEmployee, updateEmployee, deactivateEmployee, type Employee,
} from '../api/employeeApi';

export function Employees() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [addPhone, setAddPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<{ id: string; name: string; phone: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEmployees(await getEmployees(true));
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi tải danh sách nhân viên');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) { toast.error('Vui lòng nhập tên nhân viên'); return; }
    setSaving(true);
    try {
      await createEmployee({ name: addName.trim(), phone: addPhone.trim() || null });
      toast.success(`Đã thêm nhân viên ${addName.trim()}`);
      setAddName(''); setAddPhone('');
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi thêm nhân viên');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editing) return;
    if (!editing.name.trim()) { toast.error('Tên nhân viên là bắt buộc'); return; }
    setBusyId(editing.id);
    try {
      await updateEmployee(editing.id, { name: editing.name.trim(), phone: editing.phone.trim() || null });
      toast.success('Đã cập nhật nhân viên');
      setEditing(null);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi cập nhật');
    } finally {
      setBusyId(null);
    }
  };

  const handleToggle = async (emp: Employee) => {
    setBusyId(emp.id);
    try {
      if (emp.isActive) await deactivateEmployee(emp.id);
      else await updateEmployee(emp.id, { isActive: true });
      toast.success(emp.isActive ? `Đã ẩn ${emp.name}` : `Đã kích hoạt lại ${emp.name}`);
      await load();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi cập nhật trạng thái');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div>
        <h2 style={{ color: '#0f172a' }}>Nhân viên quản lý</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
          Danh sách nhân viên để gán vào trạm. Đây không phải tài khoản đăng nhập — chỉ là tên để phân công quản lý.
        </p>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-xl border p-4 flex flex-col sm:flex-row gap-3" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        <input
          value={addName}
          onChange={e => setAddName(e.target.value)}
          placeholder="Tên nhân viên *"
          className="flex-1 px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: '#e2e8f0', fontSize: '0.9rem' }}
        />
        <input
          value={addPhone}
          onChange={e => setAddPhone(e.target.value)}
          placeholder="Số điện thoại (tuỳ chọn)"
          className="sm:w-48 px-3 py-2 rounded-lg border outline-none"
          style={{ borderColor: '#e2e8f0', fontSize: '0.9rem' }}
        />
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg"
          style={{ background: saving ? '#93c5fd' : '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={16} />}
          Thêm
        </button>
      </form>

      {/* List */}
      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0' }}>
        {loading ? (
          <div className="px-5 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Đang tải...</div>
        ) : employees.length === 0 ? (
          <div className="px-5 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>
            Chưa có nhân viên nào. Thêm ở trên.
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: '#f1f5f9' }}>
            {employees.map(emp => {
              const busy = busyId === emp.id;
              const isEditing = editing?.id === emp.id;
              return (
                <div key={emp.id} className="flex items-center gap-3 px-5 py-3" style={{ opacity: emp.isActive ? 1 : 0.55 }}>
                  {isEditing ? (
                    <>
                      <input
                        value={editing.name}
                        onChange={e => setEditing({ ...editing, name: e.target.value })}
                        className="flex-1 px-2 py-1.5 rounded border outline-none"
                        style={{ borderColor: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <input
                        value={editing.phone}
                        onChange={e => setEditing({ ...editing, phone: e.target.value })}
                        placeholder="SĐT"
                        className="w-36 px-2 py-1.5 rounded border outline-none"
                        style={{ borderColor: '#e2e8f0', fontSize: '0.85rem' }}
                      />
                      <button type="button" onClick={handleSaveEdit} disabled={busy} className="p-1.5 rounded-lg" style={{ background: '#16a34a', color: 'white' }}>
                        {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                      </button>
                      <button type="button" onClick={() => setEditing(null)} className="p-1.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#64748b' }}>
                        <X size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span style={{ fontWeight: 600, color: '#1e293b', fontSize: '0.9rem' }}>{emp.name}</span>
                          {!emp.isActive && (
                            <span className="px-1.5 py-0.5 rounded" style={{ background: '#fee2e2', color: '#b91c1c', fontSize: '0.68rem', fontWeight: 600 }}>đã ẩn</span>
                          )}
                        </div>
                        {emp.phone && <div style={{ color: '#94a3b8', fontSize: '0.78rem' }}>{emp.phone}</div>}
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditing({ id: emp.id, name: emp.name, phone: emp.phone ?? '' })}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                        style={{ fontSize: '0.8rem', borderColor: '#e2e8f0', color: '#475569', background: 'white' }}
                      >
                        <Pencil size={13} /> Sửa
                      </button>
                      <button
                        type="button"
                        onClick={() => handleToggle(emp)}
                        disabled={busy}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border"
                        style={{ fontSize: '0.8rem', borderColor: emp.isActive ? '#fecaca' : '#bbf7d0', color: emp.isActive ? '#b91c1c' : '#15803d', background: 'white' }}
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : emp.isActive ? <Ban size={13} /> : <RotateCcw size={13} />}
                        {emp.isActive ? 'Ẩn' : 'Kích hoạt'}
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
