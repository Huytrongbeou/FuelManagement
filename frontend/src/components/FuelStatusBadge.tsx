const STATUS_CONFIG = {
  green: { label: 'Tốt', classes: 'bg-green-100 text-green-800' },
  yellow: { label: 'Cảnh báo', classes: 'bg-yellow-100 text-yellow-800' },
  red: { label: 'Nguy hiểm', classes: 'bg-red-100 text-red-800' },
  unknown: { label: 'Chưa có dữ liệu', classes: 'bg-gray-100 text-gray-600' },
}

export default function FuelStatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] ?? STATUS_CONFIG.unknown
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${cfg.classes}`}>
      {cfg.label}
    </span>
  )
}
