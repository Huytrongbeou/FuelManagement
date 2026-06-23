import { useState, useReducer } from 'react';
import { Plus, Edit, ToggleRight, ToggleLeft, Save, X, Search, Globe, AlertTriangle } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import * as AlertDialog from '@radix-ui/react-alert-dialog';
import { toast } from 'sonner';
import { GeneratorBrand, GeneratorModel } from '@/shared/types';
import { createBrand, updateBrand, deactivateBrand, reactivateBrand } from '../api/brandApi';

interface Props {
  brands: GeneratorBrand[];
  models: GeneratorModel[];
  onUpdate: (brands: GeneratorBrand[]) => void;
}

const emptyForm = { name: '', country: '', note: '', active: true };

type DialogState = { open: boolean; editing: GeneratorBrand | null; form: typeof emptyForm; saving: boolean };
type DialogAction =
  | { type: 'open-add' }
  | { type: 'open-edit'; brand: GeneratorBrand }
  | { type: 'close' }
  | { type: 'form-field'; name: string; value: string }
  | { type: 'saving' }
  | { type: 'saved' }
  | { type: 'save-error' };

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'open-add':   return { open: true, editing: null, form: emptyForm, saving: false };
    case 'open-edit':  return { open: true, editing: action.brand, form: { name: action.brand.name, country: action.brand.country, note: action.brand.note ?? '', active: action.brand.active }, saving: false };
    case 'close':      return { ...state, open: false };
    case 'form-field': return { ...state, form: { ...state.form, [action.name]: action.value } };
    case 'saving':     return { ...state, saving: true };
    case 'saved':      return { ...state, saving: false, open: false };
    case 'save-error': return { ...state, saving: false };
    default:           return state;
  }
}

export function GeneratorBrands({ brands, models, onUpdate }: Props) {
  const [query, setQuery] = useState('');
  const [dialog, dispatchDialog] = useReducer(dialogReducer, { open: false, editing: null, form: emptyForm, saving: false });
  const [deactivateTarget, setDeactivateTarget] = useState<GeneratorBrand | null>(null);
  const { open: dialogOpen, editing, form, saving } = dialog;

  const filtered = brands.filter(b =>
    !query || b.name.toLowerCase().includes(query.toLowerCase()) || b.country.toLowerCase().includes(query.toLowerCase())
  );

  const modelCount = (brandId: string) => models.filter(m => m.brandId === brandId && m.active).length;

  const openAdd = () => dispatchDialog({ type: 'open-add' });
  const openEdit = (b: GeneratorBrand) => dispatchDialog({ type: 'open-edit', brand: b });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Vui lòng nhập tên hãng'); return; }
    dispatchDialog({ type: 'saving' });
    try {
      if (editing) {
        const updated = await updateBrand(editing.id, { name: form.name, country: form.country || undefined, note: form.note || undefined });
        onUpdate(brands.map(b => b.id === editing.id ? { ...b, ...updated } : b));
        toast.success(`Đã cập nhật hãng ${form.name}`);
      } else {
        const created = await createBrand({ name: form.name, country: form.country || undefined, note: form.note || undefined });
        onUpdate([...brands, created]);
        toast.success(`Đã thêm hãng ${form.name}`);
      }
      dispatchDialog({ type: 'saved' });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi lưu dữ liệu');
      dispatchDialog({ type: 'save-error' });
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      await deactivateBrand(deactivateTarget.id);
      onUpdate(brands.map(b => b.id === deactivateTarget!.id ? { ...b, active: false } : b));
      toast.success(`Đã vô hiệu hóa hãng ${deactivateTarget.name}`);
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi vô hiệu hóa');
    } finally {
      setDeactivateTarget(null);
    }
  };

  const toggleActive = async (b: GeneratorBrand) => {
    if (b.active) { setDeactivateTarget(b); return; }
    try {
      await reactivateBrand(b.id);
      onUpdate(brands.map(x => x.id === b.id ? { ...x, active: true } : x));
      toast.success(`Đã kích hoạt hãng ${b.name}`);
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi kích hoạt');
    }
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 style={{ color: '#0f172a' }}>Hãng máy phát</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{brands.filter(b => b.active).length} hãng đang sử dụng</p>
        </div>
        <button type="button" onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
          <Plus size={16} /> Thêm hãng
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
        <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tìm hãng..." aria-label="Tìm hãng" className="w-full pl-9 pr-4 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white' }} />
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <table className="w-full" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#f8fafc' }}>
              {['Tên hãng', 'Quốc gia', 'Số model', 'Trạng thái', 'Ghi chú', 'Hành động'].map(h => (
                <th key={h} className="px-4 py-3 text-left border-b" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((b, i) => (
              <tr key={b.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', opacity: b.active ? 1 : 0.6 }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa'}
              >
                <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: '#eff6ff' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#2563eb' }}>{b.name[0]}</span>
                    </div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{b.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <div className="flex items-center gap-1.5" style={{ fontSize: '0.85rem', color: '#475569' }}>
                    <Globe size={13} style={{ color: '#94a3b8' }} />{b.country}
                  </div>
                </td>
                <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <span className="px-2.5 py-1 rounded-lg" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.85rem', fontWeight: 700, fontFamily: 'monospace' }}>{modelCount(b.id)} model</span>
                </td>
                <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: b.active ? '#dcfce7' : '#f1f5f9', color: b.active ? '#16a34a' : '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: b.active ? '#16a34a' : '#94a3b8' }} />
                    {b.active ? 'Đang sử dụng' : 'Vô hiệu'}
                  </span>
                </td>
                <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.8rem', color: '#64748b' }}>{b.note || '—'}</td>
                <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => openEdit(b)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 500 }}>
                      <Edit size={13} /> Sửa
                    </button>
                    <button type="button" onClick={() => toggleActive(b)} className="p-1.5 rounded-lg" title={b.active ? 'Vô hiệu hóa' : 'Kích hoạt'}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      {b.active ? <ToggleRight size={18} style={{ color: '#16a34a' }} /> : <ToggleLeft size={18} style={{ color: '#94a3b8' }} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Không tìm thấy hãng nào.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={open => !open && dispatchDialog({ type: 'close' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-md" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title asChild><h3 style={{ color: '#0f172a' }}>{editing ? 'Sửa hãng máy phát' : 'Thêm hãng máy phát'}</h3></Dialog.Title>
              <Dialog.Close asChild><button type="button" style={{ color: '#94a3b8' }}><X size={20} /></button></Dialog.Close>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              {[
                { label: 'Tên hãng *', key: 'name', placeholder: 'Ví dụ: Cummins' },
                { label: 'Quốc gia / Xuất xứ', key: 'country', placeholder: 'Ví dụ: Mỹ' },
                { label: 'Ghi chú', key: 'note', placeholder: 'Ghi chú về hãng...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>{f.label}</label>
                  <input value={form[f.key as keyof typeof form] as string} onChange={e => dispatchDialog({ type: 'form-field', name: f.key, value: e.target.value })} placeholder={f.placeholder}
                    aria-label={f.label}
                    className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
              ))}
              <div className="flex gap-3 pt-2">
                <Dialog.Close asChild><button type="button" className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>Hủy</button></Dialog.Close>
                <button type="submit" disabled={saving} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg" style={{ background: saving ? '#93c5fd' : '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
                  <Save size={15} />{saving ? 'Đang lưu...' : 'Lưu'}
                </button>
              </div>
            </form>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Deactivate Confirm */}
      <AlertDialog.Root open={!!deactivateTarget} onOpenChange={open => !open && setDeactivateTarget(null)}>
        <AlertDialog.Portal>
          <AlertDialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <AlertDialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl p-6 w-full max-w-sm" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: '#fee2e2' }}><AlertTriangle size={18} style={{ color: '#dc2626' }} /></div>
              <AlertDialog.Title asChild><h4 style={{ color: '#0f172a' }}>Vô hiệu hóa hãng?</h4></AlertDialog.Title>
            </div>
            <AlertDialog.Description asChild>
              <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '16px' }}>
                Hãng <strong>{deactivateTarget?.name}</strong> sẽ bị vô hiệu hóa. Các model thuộc hãng này vẫn được giữ lại nhưng không thể chọn thêm.
              </p>
            </AlertDialog.Description>
            <div className="flex gap-3">
              <AlertDialog.Cancel asChild><button type="button" className="flex-1 py-2.5 rounded-lg border" style={{ borderColor: '#e2e8f0', color: '#475569', fontSize: '0.875rem' }}>Hủy</button></AlertDialog.Cancel>
              <AlertDialog.Action asChild><button type="button" onClick={handleDeactivate} className="flex-1 py-2.5 rounded-lg" style={{ background: '#dc2626', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>Xác nhận</button></AlertDialog.Action>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    </div>
  );
}
