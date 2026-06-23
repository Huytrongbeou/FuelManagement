import { useState, useReducer } from 'react';
import { Plus, Edit, ToggleRight, ToggleLeft, Save, X, Search } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';
import { toast } from 'sonner';
import { GeneratorBrand, GeneratorModel, Station, fuelTypeLabel, getFuelStatus, fuelStatusColor, fuelStatusLabel } from '@/shared/types';
import { createModel, updateModel, deactivateModel, reactivateModel } from '../api/modelApi';

interface Props {
  brands: GeneratorBrand[];
  models: GeneratorModel[];
  stations: Station[];
  onUpdate: (models: GeneratorModel[]) => void;
}

const emptyForm = { brandId: '', modelName: '', powerKva: 0, fuelType: 'diesel' as const, suggestedRate: 0, suggestedCapacity: 0, note: '', active: true };

type FilterState = { query: string; brandFilter: string; statusFilter: string };
type FilterAction = { type: 'query' | 'brand' | 'status'; value: string };
function filterReducer(state: FilterState, action: FilterAction): FilterState {
  switch (action.type) {
    case 'query':  return { ...state, query: action.value };
    case 'brand':  return { ...state, brandFilter: action.value };
    case 'status': return { ...state, statusFilter: action.value };
    default:       return state;
  }
}

type DialogState = { open: boolean; editing: GeneratorModel | null; form: typeof emptyForm; saving: boolean };
type DialogAction =
  | { type: 'open-add' }
  | { type: 'open-edit'; model: GeneratorModel }
  | { type: 'close' }
  | { type: 'form-field'; name: string; value: string | number }
  | { type: 'saving' }
  | { type: 'saved' }
  | { type: 'save-error' };

function dialogReducer(state: DialogState, action: DialogAction): DialogState {
  switch (action.type) {
    case 'open-add':   return { open: true, editing: null, form: emptyForm, saving: false };
    case 'open-edit':  return { open: true, editing: action.model, form: { brandId: action.model.brandId, modelName: action.model.modelName, powerKva: action.model.powerKva, fuelType: action.model.fuelType, suggestedRate: action.model.suggestedRate, suggestedCapacity: action.model.suggestedCapacity, note: action.model.note ?? '', active: action.model.active }, saving: false };
    case 'close':      return { ...state, open: false };
    case 'form-field': return { ...state, form: { ...state.form, [action.name]: action.value } };
    case 'saving':     return { ...state, saving: true };
    case 'saved':      return { ...state, saving: false, open: false };
    case 'save-error': return { ...state, saving: false };
    default:           return state;
  }
}

export function GeneratorModels({ brands, models, stations, onUpdate }: Props) {
  const [filters, dispatchFilter] = useReducer(filterReducer, { query: '', brandFilter: 'all', statusFilter: 'all' });
  const [dialog, dispatchDialog] = useReducer(dialogReducer, { open: false, editing: null, form: emptyForm, saving: false });
  const [popupModel, setPopupModel] = useState<GeneratorModel | null>(null);
  const { query, brandFilter, statusFilter } = filters;
  const { open: dialogOpen, editing, form, saving } = dialog;

  const stationCount = (modelId: string) => stations.filter(s => s.modelId === modelId && s.active).length;

  const filtered = models.filter(m => {
    if (query && !m.modelName.toLowerCase().includes(query.toLowerCase()) && !m.brandName.toLowerCase().includes(query.toLowerCase())) return false;
    if (brandFilter !== 'all' && m.brandId !== brandFilter) return false;
    if (statusFilter === 'active' && !m.active) return false;
    if (statusFilter === 'inactive' && m.active) return false;
    return true;
  });

  const openAdd = () => dispatchDialog({ type: 'open-add' });
  const openEdit = (m: GeneratorModel) => dispatchDialog({ type: 'open-edit', model: m });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.brandId || !form.modelName) { toast.error('Vui lòng nhập đầy đủ thông tin'); return; }
    dispatchDialog({ type: 'saving' });
    try {
      if (editing) {
        const updated = await updateModel(editing.id, {
          modelName: form.modelName,
          powerKva: form.powerKva || null,
          fuelType: form.fuelType,
          suggestedConsumptionRate: form.suggestedRate || null,
          suggestedMaxCapacity: form.suggestedCapacity || null,
          note: form.note || null,
        });
        onUpdate(models.map(m => m.id === editing.id ? { ...m, ...updated } : m));
        toast.success(`Đã cập nhật model ${form.modelName}`);
      } else {
        const created = await createModel({
          brandId: form.brandId,
          modelName: form.modelName,
          powerKva: form.powerKva || undefined,
          fuelType: form.fuelType,
          suggestedConsumptionRate: form.suggestedRate || undefined,
          suggestedMaxCapacity: form.suggestedCapacity || undefined,
          note: form.note || undefined,
        });
        onUpdate([...models, created]);
        toast.success(`Đã thêm model ${form.modelName}`);
      }
      dispatchDialog({ type: 'saved' });
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi lưu dữ liệu');
      dispatchDialog({ type: 'save-error' });
    }
  };

  const toggleActive = async (m: GeneratorModel) => {
    try {
      if (m.active) {
        await deactivateModel(m.id);
        onUpdate(models.map(x => x.id === m.id ? { ...x, active: false } : x));
        toast.success(`Đã vô hiệu hóa model ${m.modelName}`);
      } else {
        await reactivateModel(m.id);
        onUpdate(models.map(x => x.id === m.id ? { ...x, active: true } : x));
        toast.success(`Đã kích hoạt model ${m.modelName}`);
      }
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi cập nhật trạng thái');
    }
  };

  const activeBrands = brands.filter(b => b.active);

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 style={{ color: '#0f172a' }}>Model máy phát</h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>{models.filter(m => m.active).length} model đang sử dụng</p>
        </div>
        <button type="button" onClick={openAdd} className="flex items-center gap-2 px-4 py-2.5 rounded-lg" style={{ background: '#2563eb', color: 'white', fontSize: '0.875rem', fontWeight: 600 }}>
          <Plus size={16} /> Thêm model
        </button>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#94a3b8' }} />
          <input value={query} onChange={e => dispatchFilter({ type: 'query', value: e.target.value })} placeholder="Tìm model..." aria-label="Tìm model" className="pl-9 pr-4 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', width: '200px' }} />
        </div>
        <select value={brandFilter} onChange={e => dispatchFilter({ type: 'brand', value: e.target.value })} className="px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', color: '#374151' }}>
          <option value="all">Tất cả hãng</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
        </select>
        <select value={statusFilter} onChange={e => dispatchFilter({ type: 'status', value: e.target.value })} className="px-3 py-2 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: 'white', color: '#374151' }}>
          <option value="all">Tất cả trạng thái</option>
          <option value="active">Đang sử dụng</option>
          <option value="inactive">Vô hiệu</option>
        </select>
      </div>

      <div className="rounded-xl border overflow-hidden" style={{ background: 'white', borderColor: '#e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                {['Hãng', 'Model', 'Công suất', 'Loại NL', 'Định mức gợi ý', 'Dung tích gợi ý', 'Số trạm dùng', 'Trạng thái', 'Hành động'].map(h => (
                  <th key={h} className="px-4 py-3 text-left border-b" style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 600, borderColor: '#e2e8f0', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((m, i) => (
                <tr key={m.id} style={{ background: i % 2 === 0 ? 'white' : '#fafafa', opacity: m.active ? 1 : 0.6 }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'white' : '#fafafa'}
                >
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span className="px-2.5 py-1 rounded-lg" style={{ background: '#f1f5f9', color: '#475569', fontSize: '0.82rem', fontWeight: 600 }}>{m.brandName}</span>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.875rem', fontWeight: 600, color: '#1e293b' }}>{m.modelName}</td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span style={{ fontFamily: 'monospace', fontSize: '0.875rem', fontWeight: 700, color: '#7c3aed' }}>{m.powerKva} kVA</span>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.82rem', color: '#475569' }}>{fuelTypeLabel(m.fuelType)}</td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.82rem', color: '#475569' }}>{m.suggestedRate} L/h</td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9', fontSize: '0.82rem', color: '#475569' }}>{m.suggestedCapacity} L</td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <button type="button" onClick={() => setPopupModel(m)} className="px-2 py-0.5 rounded-full" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer' }}>
                      {stationCount(m.id)} trạm
                    </button>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: m.active ? '#dcfce7' : '#f1f5f9', color: m.active ? '#16a34a' : '#64748b', fontSize: '0.75rem', fontWeight: 600 }}>
                      <span className="w-1.5 h-1.5 rounded-full" style={{ background: m.active ? '#16a34a' : '#94a3b8' }} />
                      {m.active ? 'Đang dùng' : 'Vô hiệu'}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 border-b" style={{ borderColor: '#f1f5f9' }}>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => openEdit(m)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg" style={{ background: '#eff6ff', color: '#2563eb', fontSize: '0.78rem', fontWeight: 500 }}>
                        <Edit size={13} /> Sửa
                      </button>
                      <button type="button" onClick={() => toggleActive(m)} className="p-1.5 rounded-lg" onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f1f5f9'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        {m.active ? <ToggleRight size={18} style={{ color: '#16a34a' }} /> : <ToggleLeft size={18} style={{ color: '#94a3b8' }} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Không tìm thấy model nào.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stations popup */}
      <Dialog.Root open={!!popupModel} onOpenChange={open => !open && setPopupModel(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <Dialog.Title className="sr-only">Trạm dùng model {popupModel?.modelName}</Dialog.Title>
            <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#f1f5f9' }}>
              <div>
                <h3 style={{ color: '#0f172a', marginBottom: '2px' }}>Trạm dùng model {popupModel?.modelName}</h3>
                <p style={{ color: '#64748b', fontSize: '0.8rem' }}>{popupModel?.brandName} · {popupModel?.powerKva} kVA</p>
              </div>
              <Dialog.Close asChild>
                <button type="button" style={{ color: '#94a3b8' }}><X size={20} /></button>
              </Dialog.Close>
            </div>
            <div className="p-5">
              {popupModel && (() => {
                const modelStations = stations.filter(s => s.modelId === popupModel.id && s.active);
                if (modelStations.length === 0) {
                  return <div className="py-8 text-center" style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Không có trạm nào đang dùng model này.</div>;
                }
                return (
                  <div className="space-y-2">
                    {modelStations.map(s => {
                      const st = getFuelStatus(s.currentFuel);
                      const c = fuelStatusColor(st);
                      return (
                        <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-lg border" style={{ borderColor: '#e2e8f0', background: '#f8fafc' }}>
                          <div className="flex items-center gap-3">
                            <span style={{ fontFamily: 'monospace', fontSize: '0.78rem', color: '#64748b', background: '#f1f5f9', padding: '2px 8px', borderRadius: '4px' }}>{s.code}</span>
                            <span style={{ fontSize: '0.85rem', color: '#1e293b', fontWeight: 500 }}>{s.name}</span>
                          </div>
                          <div className="flex items-center gap-3">
                            <span style={{ fontSize: '0.82rem', color: '#475569' }}>
                              {s.currentFuel !== null ? `${s.currentFuel} L` : 'Chưa có'}
                            </span>
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full" style={{ background: c.bg, color: c.text, fontSize: '0.75rem', fontWeight: 600, border: `1px solid ${c.border}` }}>
                              <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
                              {fuelStatusLabel(st)}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>

      {/* Add/Edit Dialog */}
      <Dialog.Root open={dialogOpen} onOpenChange={open => !open && dispatchDialog({ type: 'close' })}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50" style={{ background: 'rgba(0,0,0,0.5)' }} />
          <Dialog.Content aria-describedby={undefined} className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ background: 'white', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#f1f5f9' }}>
              <Dialog.Title asChild><h3 style={{ color: '#0f172a' }}>{editing ? 'Sửa model máy phát' : 'Thêm model máy phát'}</h3></Dialog.Title>
              <Dialog.Close asChild><button type="button" style={{ color: '#94a3b8' }}><X size={20} /></button></Dialog.Close>
            </div>
            <form onSubmit={handleSave} className="p-6 space-y-4">
              <div>
                <label htmlFor="gen-model-brand" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Hãng máy *</label>
                <select id="gen-model-brand" value={form.brandId} onChange={e => dispatchDialog({ type: 'form-field', name: 'brandId', value: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}>
                  <option value="">-- Chọn hãng --</option>
                  {activeBrands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor="gen-model-name" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Tên model *</label>
                <input id="gen-model-name" value={form.modelName} onChange={e => dispatchDialog({ type: 'form-field', name: 'modelName', value: e.target.value })} placeholder="Ví dụ: C100D5" className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="gen-model-power-kva" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Công suất (kVA)</label>
                  <input id="gen-model-power-kva" type="number" min={0} value={form.powerKva || ''} onChange={e => dispatchDialog({ type: 'form-field', name: 'powerKva', value: +e.target.value })} placeholder="100" className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label htmlFor="gen-model-fuel-type" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Loại nhiên liệu</label>
                  <select id="gen-model-fuel-type" value={form.fuelType} onChange={e => dispatchDialog({ type: 'form-field', name: 'fuelType', value: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}>
                    <option value="diesel">Dầu Diesel</option>
                    <option value="gasoline">Xăng</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="gen-model-suggested-rate" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Định mức gợi ý (L/giờ)</label>
                  <input id="gen-model-suggested-rate" type="number" min={0} step={0.5} value={form.suggestedRate || ''} onChange={e => dispatchDialog({ type: 'form-field', name: 'suggestedRate', value: +e.target.value })} placeholder="10" className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
                <div>
                  <label htmlFor="gen-model-suggested-capacity" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Dung tích gợi ý (L)</label>
                  <input id="gen-model-suggested-capacity" type="number" min={0} value={form.suggestedCapacity || ''} onChange={e => dispatchDialog({ type: 'form-field', name: 'suggestedCapacity', value: +e.target.value })} placeholder="200" className="w-full px-3 py-2.5 rounded-lg border outline-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                    onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                    onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
                </div>
              </div>
              <div>
                <label htmlFor="gen-model-note" className="block mb-1.5" style={{ fontSize: '0.82rem', color: '#475569' }}>Ghi chú</label>
                <textarea id="gen-model-note" value={form.note} onChange={e => dispatchDialog({ type: 'form-field', name: 'note', value: e.target.value })} rows={2} className="w-full px-3 py-2.5 rounded-lg border outline-none resize-none" style={{ fontSize: '0.875rem', borderColor: '#e2e8f0', background: '#f8fafc' }}
                  onFocus={e => { e.target.style.borderColor = '#2563eb'; e.target.style.boxShadow = '0 0 0 3px rgba(37,99,235,0.1)'; }}
                  onBlur={e => { e.target.style.borderColor = '#e2e8f0'; e.target.style.boxShadow = 'none'; }} />
              </div>
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
    </div>
  );
}
