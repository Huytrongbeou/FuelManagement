export interface BulkUpsertRow {
  station_code: string
  station_name?: string
  generator_name?: string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  current_admin_unit_name?: string | null
  legacy_area_name?: string | null
  operation_area_name?: string | null
  brand_name?: string | null
  model_name?: string | null
  power_kva?: number | null
  fuel_type?: string | null
  consumption_rate?: number | null
  max_capacity?: number | null
}

export interface BulkUpsertResult {
  station_code: string
  station_id: string
  action: 'created' | 'updated'
  warning: string | null
}
