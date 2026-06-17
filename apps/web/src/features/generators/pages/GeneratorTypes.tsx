import { useState } from 'react';
import { Plus, Edit, ToggleLeft, ToggleRight, Save, X, Cpu } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { GeneratorType } from '@/shared/types';

interface GeneratorTypesProps {
  types: GeneratorType[];
  onUpdate: (types: GeneratorType[]) => void;
}

const emptyForm: Omit<GeneratorType, 'id'> = { name: '', fuelRate: 0, note: '', active: true };

export function GeneratorTypes({ types, onUpdate }: GeneratorTypesProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<GeneratorType | null>(null);
  const [form, setForm] = useState<Omit<GeneratorType, 'id'>>(emptyForm);
  const [saving, setSaving] = useState(false);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (t: GeneratorType) => {
    setEditing(t);
    setForm({ name: t.name, fuelRate: t.fuelRate, note: t.note ?? '', active: t.active });
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.fuelRate) {
      toast.error('Vui lòng nhập đầy đủ thông tin');
      return;
    }
    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    if (editing) {
      onUpdate(types.map(t => t.id === editing.id ? { ...t, ...form } : t));
      toast.success('Đã cập nhật loại máy phát!');
    } else {
      onUpdate([...types, { id: `gt${Date.now()}`, ...form }]);
      toast.success('Đã thêm loại máy phát mới!');
    }
    setSaving(false);
    setDialogOpen(false);
  };

  const toggleActive = (t: GeneratorType) => {
    onUpdate(types.map(x => x.id === t.id ? { ...x, active: !x.active } : x));
    toast.success(`Đã ${t.active ? 'vô hiệu hóa' : 'kích hoạt'} ${t.name}`);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 style={{ color: '#0f172a' }}>Quản lý loại máy phát</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{types.length} loại máy phát trong hệ thống</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all"
          style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1d4ed8'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#2563eb'}
        >
          <Plus size={16} /> Thêm loại máy
        </button>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Loại máy phát', 'Định mức (L/giờ)', 'Ghi chú', 'Trạng thái', 'Hành động'].map(h => (
                  <th key={h} className="px-4 py-3 text-left border-b" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0', whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {types.map((t, i) => (
                <tr key={t.id}
                  style={{ background: i % 2 === 0 ? 'white' : '#fafafa', opacity: t.active ? 1 : 0.55 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                >
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
                        <Cpu size={14} style={{ color: '#2563eb' }} />
                      </div>
                      <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{t.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span className="px-2.5 py-1 rounded-lg" style={{ background: '#f0f7ff', color: '#2563eb', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>
                      {t.fuelRate} L/h
                    </span>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>
                    {t.note || '—'}
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{
                      background: t.active ? '#dcfce7' : '#f1f5f9',
                      color: t.active ? '#16a34a' : '#64748b',
                      fontSize: '0.75rem', fontWeight: 600,
                    }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: t.active ? '#16a34a' : '#94a3b8' }} />
                      {t.active ? 'Đang dùng' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEdit(t)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors"
                        style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 500 }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#dbeafe'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#eff6ff'}
                      >
                        <Edit size={13} /> Sửa
                      </button>
                      <button
                        onClick={() => toggleActive(t)}
                        className="p-1.5 rounded-lg transition-colors"
                        style={{ color: t.active ? '#94a3b8' : '#16a34a' }}
                        title={t.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                      >
                        {t.active ? <ToggleRight size={18} style={{ color: '#16a34a' }} /> : <ToggleLeft size={18} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-md" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title asChild>
                <h3 style={{ color: '#0f172a' }}>{editing ? 'Sửa loại máy phát' : 'Thêm loại máy phát'}</h3>
              </Dialog.Title>
              <Dialog.Close asChild>
                <button style={{ color: '#94a3b8' }}><X size={20} /></button>
              </Dialog.Close>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label className="block mb-1.5" style={{ fontSize: '0.85rem', color: '#475569' }}>Tên loại máy phát *</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ví dụ: Cummins 100kVA"
                  className="w-full px-3 py-2.5 rounded-lg border outline-none"
                  style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontSize: '0.85rem', color: '#475569' }}>Định mức tiêu hao (L/giờ) *</label>
                <input
                  type="number"
                  min={0}
                  step={0.5}
                  value={form.fuelRate || ''}
                  onChange={e => setForm(f => ({ ...f, fuelRate: parseFloat(e.target.value) || 0 }))}
                  placeholder="Ví dụ: 10"
                  className="w-full px-3 py-2.5 rounded-lg border outline-none"
                  style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div>
                <label className="block mb-1.5" style={{ fontSize: '0.85rem', color: '#475569' }}>Ghi chú</label>
                <textarea
                  value={form.note}
                  onChange={e => setForm(f => ({ ...f, note: e.target.value }))}
                  placeholder="Ghi chú về loại máy phát..."
                  rows={3}
                  className="w-full px-3 py-2.5 rounded-lg border outline-none resize-none"
                  style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <Dialog.Close asChild>
                  <button type="button" className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>
                    Hủy
                  </button>
                </Dialog.Close>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg transition-all"
                  style={{ background: saving ? '#93c5fd' : '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}
                >
                  <Save size={15} />
                  {saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
