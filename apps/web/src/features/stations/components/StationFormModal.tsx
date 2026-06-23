import { useEffect, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X, MapPin, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { GeneratorBrand, GeneratorModel } from '@/shared/types';
import { createStation } from '../api/stationApi';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const CAO_LANH_CENTER: [number, number] = [10.4574, 105.6379];

const DIALOG_CONTENT_STYLE = {
  top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
  background: 'white', borderRadius: '16px', width: '680px', maxWidth: '95vw',
  maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column',
  zIndex: 51, boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
} as const;

const LABEL_STYLE = { fontSize: '0.8rem', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' } as const;
const INPUT_STYLE = { width: '100%', padding: '8px 12px', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '0.875rem', color: '#1e293b', background: 'white', outline: 'none' } as const;

interface Props {
  open: boolean;
  onClose: () => void;
  brands: GeneratorBrand[];
  models: GeneratorModel[];
  onCreated: () => void;
}

interface FormState {
  stationCode: string;
  stationName: string;
  generatorName: string;
  address: string;
  currentAdminUnitName: string;
  legacyAreaName: string;
  operationAreaName: string;
  latitude: string;
  longitude: string;
  brandId: string;
  modelId: string;
  powerKva: string;
  fuelType: 'diesel' | 'gasoline' | 'other';
  consumptionRate: string;
  maxCapacity: string;
  notes: string;
}

const EMPTY: FormState = {
  stationCode: '', stationName: '', generatorName: '', address: '',
  currentAdminUnitName: 'TP. Cao Lãnh', legacyAreaName: '', operationAreaName: '',
  latitude: '', longitude: '',
  brandId: '', modelId: '',
  powerKva: '', fuelType: 'diesel', consumptionRate: '', maxCapacity: '',
  notes: '',
};

// ── Form section sub-components ───────────────────────────────────────────────

interface BasicInfoFieldsProps {
  form: FormState;
  set: (field: keyof FormState, value: string) => void;
}

function BasicInfoFields({ form, set }: BasicInfoFieldsProps) {
  return (
    <section>
      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
        Thông tin cơ bản
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="station-code" style={LABEL_STYLE}>Mã trạm *</label>
          <input id="station-code" style={INPUT_STYLE} placeholder="VD: CL-013" value={form.stationCode} onChange={e => set('stationCode', e.target.value)} required />
        </div>
        <div>
          <label htmlFor="station-name" style={LABEL_STYLE}>Tên trạm *</label>
          <input id="station-name" style={INPUT_STYLE} placeholder="VD: Trạm Phường 11" value={form.stationName} onChange={e => set('stationName', e.target.value)} required />
        </div>
        <div>
          <label htmlFor="generator-name" style={LABEL_STYLE}>Tên máy phát</label>
          <input id="generator-name" style={INPUT_STYLE} placeholder="VD: Máy phát dự phòng A" value={form.generatorName} onChange={e => set('generatorName', e.target.value)} />
        </div>
        <div>
          <label htmlFor="station-address" style={LABEL_STYLE}>Địa chỉ</label>
          <input id="station-address" style={INPUT_STYLE} placeholder="Số nhà, tên đường..." value={form.address} onChange={e => set('address', e.target.value)} />
        </div>
        <div>
          <label htmlFor="admin-unit" style={LABEL_STYLE}>Đơn vị hành chính</label>
          <input id="admin-unit" style={INPUT_STYLE} value={form.currentAdminUnitName} onChange={e => set('currentAdminUnitName', e.target.value)} />
        </div>
        <div>
          <label htmlFor="legacy-area" style={LABEL_STYLE}>Địa bàn cũ</label>
          <input id="legacy-area" style={INPUT_STYLE} placeholder="VD: Phường 11 cũ" value={form.legacyAreaName} onChange={e => set('legacyAreaName', e.target.value)} />
        </div>
        <div className="col-span-2">
          <label htmlFor="operation-area" style={LABEL_STYLE}>Khu vực quản lý nội bộ</label>
          <input id="operation-area" style={INPUT_STYLE} placeholder="VD: Cao Lãnh trung tâm" value={form.operationAreaName} onChange={e => set('operationAreaName', e.target.value)} />
        </div>
      </div>
    </section>
  );
}

interface GeneratorFieldsProps {
  form: FormState;
  brands: GeneratorBrand[];
  filteredModels: GeneratorModel[];
  onBrandChange: (brandId: string) => void;
  onModelChange: (modelId: string) => void;
  set: (field: keyof FormState, value: string) => void;
}

function GeneratorFields({ form, brands, filteredModels, onBrandChange, onModelChange, set }: GeneratorFieldsProps) {
  return (
    <section>
      <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
        Thông số máy phát
      </h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="generator-brand" style={LABEL_STYLE}>Hãng máy</label>
          <select id="generator-brand" style={INPUT_STYLE} value={form.brandId} onChange={e => onBrandChange(e.target.value)}>
            <option value="">— Chọn hãng —</option>
            {brands.flatMap(b => b.active ? [<option key={b.id} value={b.id}>{b.name}</option>] : [])}
          </select>
        </div>
        <div>
          <label htmlFor="generator-model" style={LABEL_STYLE}>Model máy</label>
          <select id="generator-model" style={INPUT_STYLE} value={form.modelId} onChange={e => onModelChange(e.target.value)} disabled={!form.brandId}>
            <option value="">— Chọn model —</option>
            {filteredModels.flatMap(m => m.active ? [<option key={m.id} value={m.id}>{m.modelName}</option>] : [])}
          </select>
        </div>
        <div>
          <label htmlFor="power-kva" style={LABEL_STYLE}>Công suất (kVA)</label>
          <input id="power-kva" style={INPUT_STYLE} type="number" step="any" placeholder="VD: 100" value={form.powerKva} onChange={e => set('powerKva', e.target.value)} />
        </div>
        <div>
          <label htmlFor="fuel-type" style={LABEL_STYLE}>Loại nhiên liệu</label>
          <select id="fuel-type" style={INPUT_STYLE} value={form.fuelType} onChange={e => set('fuelType', e.target.value as 'diesel')}>
            <option value="diesel">Dầu Diesel</option>
            <option value="gasoline">Xăng</option>
            <option value="other">Khác</option>
          </select>
        </div>
        <div>
          <label htmlFor="consumption-rate" style={LABEL_STYLE}>Định mức tiêu hao (L/giờ) *</label>
          <input id="consumption-rate" style={INPUT_STYLE} type="number" step="any" min="0" placeholder="VD: 10.5" value={form.consumptionRate} onChange={e => set('consumptionRate', e.target.value)} required />
        </div>
        <div>
          <label htmlFor="max-capacity" style={LABEL_STYLE}>Dung tích bình tối đa (L) *</label>
          <input id="max-capacity" style={INPUT_STYLE} type="number" step="any" min="0" placeholder="VD: 200" value={form.maxCapacity} onChange={e => set('maxCapacity', e.target.value)} required />
        </div>
        <div className="col-span-2">
          <label htmlFor="station-notes" style={LABEL_STYLE}>Ghi chú</label>
          <textarea id="station-notes" style={{ ...INPUT_STYLE, resize: 'vertical', minHeight: '60px' }} placeholder="Ghi chú thêm..." value={form.notes} onChange={e => set('notes', e.target.value)} />
        </div>
      </div>
    </section>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function StationFormModal({ open, onClose, brands, models, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [showMapPicker, setShowMapPicker] = useState(false);

  const mapDivRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  const set = (field: keyof FormState, value: string) => setForm(f => ({ ...f, [field]: value }));

  const prevOpenRef = useRef(open);
  if (open !== prevOpenRef.current) {
    prevOpenRef.current = open;
    if (open) { setForm(EMPTY); setShowMapPicker(false); }
  }

  const filteredModels = form.brandId ? models.filter(m => m.brandId === form.brandId) : [];

  const handleBrandChange = (brandId: string) => {
    set('brandId', brandId);
    set('modelId', '');
    set('consumptionRate', '');
    set('maxCapacity', '');
  };

  const handleModelChange = (modelId: string) => {
    set('modelId', modelId);
    const model = models.find(m => m.id === modelId);
    if (model) {
      if (model.suggestedRate && !form.consumptionRate) set('consumptionRate', String(model.suggestedRate));
      if (model.suggestedCapacity && !form.maxCapacity) set('maxCapacity', String(model.suggestedCapacity));
      if (model.powerKva && !form.powerKva) set('powerKva', String(model.powerKva));
    }
  };

  useEffect(() => {
    if (!showMapPicker || !mapDivRef.current) return;
    if (mapRef.current) return;

    const initLat = form.latitude ? parseFloat(form.latitude) : CAO_LANH_CENTER[0];
    const initLng = form.longitude ? parseFloat(form.longitude) : CAO_LANH_CENTER[1];

    const map = L.map(mapDivRef.current, { center: [initLat, initLng], zoom: 14 });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap',
      maxZoom: 19,
    }).addTo(map);

    if (form.latitude && form.longitude) {
      const m = L.marker([initLat, initLng], { draggable: true }).addTo(map);
      m.on('dragend', () => {
        const pos = m.getLatLng();
        set('latitude', pos.lat.toFixed(6));
        set('longitude', pos.lng.toFixed(6));
      });
      markerRef.current = m;
    }

    map.on('click', (e: L.LeafletMouseEvent) => {
      const { lat, lng } = e.latlng;
      set('latitude', lat.toFixed(6));
      set('longitude', lng.toFixed(6));
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lng]);
      } else {
        const m = L.marker([lat, lng], { draggable: true }).addTo(map);
        m.on('dragend', () => {
          const pos = m.getLatLng();
          set('latitude', pos.lat.toFixed(6));
          set('longitude', pos.lng.toFixed(6));
        });
        markerRef.current = m;
      }
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  // oxlint-disable-next-line react-doctor/exhaustive-deps -- Leaflet map init reads form coords at open-time only; mapRef.current guards re-init
  }, [showMapPicker]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.stationCode || !form.stationName || !form.consumptionRate || !form.maxCapacity) {
      toast.error('Vui lòng điền đầy đủ các trường bắt buộc (*)');
      return;
    }
    setSaving(true);
    try {
      await createStation({
        stationCode: form.stationCode.trim().toUpperCase(),
        stationName: form.stationName.trim(),
        generatorName: form.generatorName.trim() || null,
        address: form.address.trim() || null,
        currentAdminUnitName: form.currentAdminUnitName.trim() || null,
        legacyAreaName: form.legacyAreaName.trim() || null,
        operationAreaName: form.operationAreaName.trim() || null,
        latitude: form.latitude ? parseFloat(form.latitude) : null,
        longitude: form.longitude ? parseFloat(form.longitude) : null,
        brandId: form.brandId || null,
        modelId: form.modelId || null,
        powerKva: form.powerKva ? parseFloat(form.powerKva) : null,
        fuelType: form.fuelType,
        consumptionRate: parseFloat(form.consumptionRate),
        maxCapacity: parseFloat(form.maxCapacity),
        notes: form.notes.trim() || null,
      });
      toast.success(`Đã tạo trạm ${form.stationCode.toUpperCase()}`);
      onCreated();
      onClose();
    } catch (err) {
      toast.error((err as Error).message || 'Lỗi tạo trạm');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0" style={{ background: 'rgba(0,0,0,0.4)', zIndex: 50 }} />
        <Dialog.Content className="fixed" style={DIALOG_CONTENT_STYLE}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: '#f1f5f9', flexShrink: 0 }}>
            <div>
              <Dialog.Title style={{ fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>Thêm trạm mới</Dialog.Title>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', marginTop: '2px' }}>TP. Cao Lãnh, Đồng Tháp</p>
            </div>
            <Dialog.Close asChild>
              <button type="button" style={{ color: '#94a3b8', padding: '4px' }}><X size={18} /></button>
            </Dialog.Close>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} style={{ overflowY: 'auto', flex: 1 }}>
            <div className="px-6 py-5 space-y-5">
              <BasicInfoFields form={form} set={set} />

              {/* Tọa độ */}
              <section>
                <h4 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>
                  Vị trí trên bản đồ
                </h4>
                <div className="grid grid-cols-2 gap-4 mb-3">
                  <div>
                    <label htmlFor="station-lat" style={LABEL_STYLE}>Vĩ độ (Latitude)</label>
                    <input
                      id="station-lat" style={INPUT_STYLE} type="number" step="any" placeholder="VD: 10.4574"
                      value={form.latitude}
                      onChange={e => {
                        set('latitude', e.target.value);
                        if (markerRef.current && e.target.value && form.longitude) {
                          markerRef.current.setLatLng([parseFloat(e.target.value), parseFloat(form.longitude)]);
                          mapRef.current?.panTo([parseFloat(e.target.value), parseFloat(form.longitude)]);
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label htmlFor="station-lng" style={LABEL_STYLE}>Kinh độ (Longitude)</label>
                    <input
                      id="station-lng" style={INPUT_STYLE} type="number" step="any" placeholder="VD: 105.6379"
                      value={form.longitude}
                      onChange={e => {
                        set('longitude', e.target.value);
                        if (markerRef.current && form.latitude && e.target.value) {
                          markerRef.current.setLatLng([parseFloat(form.latitude), parseFloat(e.target.value)]);
                          mapRef.current?.panTo([parseFloat(form.latitude), parseFloat(e.target.value)]);
                        }
                      }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMapPicker(v => !v)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border mb-2"
                  style={{ fontSize: '0.8rem', color: '#2563eb', borderColor: '#dbeafe', background: '#eff6ff' }}
                >
                  <MapPin size={14} />
                  {showMapPicker ? 'Ẩn bản đồ' : 'Chọn vị trí trên bản đồ'}
                </button>
                {showMapPicker && (
                  <div style={{ borderRadius: '8px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
                    <div style={{ background: '#f8fafc', padding: '6px 10px', fontSize: '0.75rem', color: '#64748b' }}>
                      Click vào bản đồ để đặt vị trí trạm. Kéo marker để điều chỉnh.
                    </div>
                    <div ref={mapDivRef} style={{ height: '240px' }} />
                  </div>
                )}
              </section>

              <GeneratorFields
                form={form}
                brands={brands}
                filteredModels={filteredModels}
                onBrandChange={handleBrandChange}
                onModelChange={handleModelChange}
                set={set}
              />
            </div>

            {/* Footer */}
            <div className="flex justify-end gap-3 px-6 py-4 border-t" style={{ borderColor: '#f1f5f9', flexShrink: 0 }}>
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
                {saving ? 'Đang lưu...' : 'Tạo trạm'}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
